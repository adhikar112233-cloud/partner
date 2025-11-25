
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Helper to calculate expiry
const getExpiryDate = (planId) => {
    const now = new Date();
    if (['basic'].includes(planId)) { // 1 Month
        return new Date(now.setMonth(now.getMonth() + 1));
    }
    if (['pro'].includes(planId) && !planId.includes('_')) { // Creator Pro 6 Months
        return new Date(now.setMonth(now.getMonth() + 6));
    }
    // Default 1 Year (Premium, Brand Plans)
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

// 1. Create Payment (Handled at root of function URL)
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description } = req.body;
        
        // Basic validation
        if (amount === undefined || !phone) return res.status(400).json({ message: "Missing required fields" });

        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        const baseUrl = appId?.startsWith("TEST") ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

        const orderId = "ORDER-" + Date.now();
        
        // Store pending order in Firestore to track context
        await db.collection('pending_orders').doc(orderId).set({
            userId: userId || customerId,
            amount,
            collabType,
            relatedId: relatedId || 'unknown',
            collabId: collabId || 'unknown',
            description: description || 'Payment',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'PENDING'
        });

        // If amount is 0 (full coin redemption), skip gateway
        if (amount === 0) {
             return res.json({
                success: true,
                orderId: orderId,
                paymentSessionId: null, // Signal frontend to skip SDK
                message: "Paid with coins"
            });
        }

        const payload = {
            order_id: orderId,
            order_amount: amount,
            order_currency: "INR",
            customer_details: {
                customer_id: customerId,
                customer_phone: phone
            },
            order_meta: {
                return_url: `${req.headers.origin || 'https://bigyapon.com'}/success.html?order_id=${orderId}`
            },
            order_tags: {
                collabType: collabType,
                userId: userId
            }
        };

        // Call Cashfree
        const response = await fetch(`${baseUrl}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': appId,
                'x-client-secret': secretKey,
                'x-api-version': '2023-08-01'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok) {
            res.json({
                success: true,
                paymentSessionId: data.payment_session_id,
                orderId: orderId,
                environment: appId?.startsWith("TEST") ? "sandbox" : "production"
            });
        } else {
            console.error("Cashfree Error:", data);
            res.status(400).json({ message: data.message || "Gateway Error" });
        }

    } catch (error) {
        console.error("Create Payment Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// 2. Verify Order & Fulfill
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    console.log(`Verifying order: ${orderId}`);

    try {
        const orderRef = db.collection('pending_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ message: "Order context not found" });
        }

        const orderData = orderDoc.data();
        let status = 'PENDING';
        let gatewayDetails = {};

        // If amount was 0, it's a wallet transaction, auto-approve
        if (orderData.amount === 0) {
            status = 'PAID';
        } else {
            // Verify with Gateway
            const settingsDoc = await db.doc('settings/platform').get();
            const settings = settingsDoc.data() || {};
            const appId = settings.paymentGatewayApiId;
            const secretKey = settings.paymentGatewayApiSecret;
            const baseUrl = appId?.startsWith("TEST") ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

            const response = await fetch(`${baseUrl}/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'x-client-id': appId,
                    'x-client-secret': secretKey,
                    'x-api-version': '2023-08-01'
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                // In development/emulator, allow skipping verification if headers missing
                console.warn("Gateway verification failed, check credentials.");
                return res.status(400).json({ message: "Failed to verify with gateway" });
            }
            
            status = data.order_status;
            gatewayDetails = data;
        }

        if (status === 'PAID') {
            // Check if already processed to avoid duplicates
            if (orderData.status === 'COMPLETED') {
                return res.json({ order_status: 'PAID', message: "Already processed" });
            }

            const { userId, collabType, relatedId, amount, description, collabId } = orderData;

            // A. Create Transaction Record
            const txRef = db.collection('transactions').doc(orderId);
            await txRef.set({
                transactionId: orderId,
                userId: userId,
                amount: amount,
                type: 'payment',
                status: 'completed',
                description: description,
                relatedId: relatedId || 'N/A',
                collabId: collabId || 'N/A',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                paymentGatewayDetails: gatewayDetails
            }, { merge: true });

            // B. Update User/Membership/Collaboration
            if (collabType === 'membership') {
                const planId = relatedId;
                const expiresAt = getExpiryDate(planId);
                
                // Update User Membership
                await db.collection('users').doc(userId).update({
                    'membership.plan': planId,
                    'membership.isActive': true,
                    'membership.startsAt': admin.firestore.FieldValue.serverTimestamp(),
                    'membership.expiresAt': admin.firestore.Timestamp.fromDate(expiresAt)
                });

                // If influencer, update public profile
                const userSnap = await db.collection('users').doc(userId).get();
                if (userSnap.exists && userSnap.data().role === 'influencer') {
                    await db.collection('influencers').doc(userId).set({
                        membershipActive: true
                    }, { merge: true });
                }
            } else if (collabType === 'boost_profile') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 await db.collection('boosts').add({
                     userId,
                     plan: 'profile',
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                     createdAt: admin.firestore.FieldValue.serverTimestamp(),
                     targetId: userId,
                     targetType: 'profile'
                 });
                 
                 const userSnap = await db.collection('users').doc(userId).get();
                 const collectionName = userSnap.data().role === 'influencer' ? 'influencers' : 'livetv_channels';
                 if (['influencer', 'livetv'].includes(userSnap.data().role)) {
                     await db.collection(collectionName).doc(userId).set({ isBoosted: true }, { merge: true });
                 }
            }
            
            // Mark Order as Completed locally
            await orderRef.update({ status: 'COMPLETED' });
        }

        res.json({ order_status: status });

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// IMPORTANT: The export name must match the URL slug.
exports.createpayment = functions.https.onRequest(app);
