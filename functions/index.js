
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

// Helper to calculate expiry for memberships
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

// 1. Create Payment (Root endpoint)
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description, coinsUsed } = req.body;
        
        // Validate required fields
        if (amount === undefined || !phone) return res.status(400).json({ message: "Missing required fields" });

        // Fetch Payment Gateway Settings
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        // Determine API Environment
        const isTest = appId && appId.startsWith("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

        const orderId = "ORDER-" + Date.now();
        
        // Store pending order in Firestore
        await db.collection('pending_orders').doc(orderId).set({
            userId: userId || customerId,
            amount,
            coinsUsed: coinsUsed || 0,
            collabType,
            relatedId: relatedId || 'unknown',
            collabId: collabId || 'unknown',
            description: description || 'Payment',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'PENDING'
        });

        // Handle full coin redemption (zero amount)
        if (amount === 0) {
             return res.json({
                success: true,
                orderId: orderId,
                paymentSessionId: null, // No session needed
                message: "Paid with coins"
            });
        }

        // Prepare Cashfree Payload
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

        // Call Cashfree API
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
                environment: isTest ? "sandbox" : "production"
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

// 2. Verify Order & Fulfill Service
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    
    try {
        const orderRef = db.collection('pending_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ message: "Order not found" });
        }

        const orderData = orderDoc.data();
        let status = 'PENDING';
        let gatewayDetails = {};

        // Bypass gateway check for zero-amount orders (Wallet payments)
        if (orderData.amount === 0) {
            status = 'PAID';
        } else {
            const settingsDoc = await db.doc('settings/platform').get();
            const settings = settingsDoc.data() || {};
            const appId = settings.paymentGatewayApiId;
            const secretKey = settings.paymentGatewayApiSecret;
            const baseUrl = (appId && appId.startsWith("TEST")) ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

            const response = await fetch(`${baseUrl}/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'x-client-id': appId,
                    'x-client-secret': secretKey,
                    'x-api-version': '2023-08-01'
                }
            });

            if (response.ok) {
                const data = await response.json();
                status = data.order_status;
                gatewayDetails = data;
            } else {
                console.warn("Gateway verification failed for order:", orderId);
            }
        }

        // Process Fulfillment if PAID
        if (status === 'PAID') {
            if (orderData.status === 'COMPLETED') {
                return res.json({ order_status: 'PAID', message: "Already processed" });
            }

            const { userId, collabType, relatedId, amount, description, collabId, coinsUsed } = orderData;

            const batch = db.batch();

            // A. Create Transaction Record
            const txRef = db.collection('transactions').doc(orderId);
            batch.set(txRef, {
                transactionId: orderId,
                userId: userId,
                amount: amount,
                coinsUsed: coinsUsed || 0,
                type: 'payment',
                status: 'completed',
                description: description,
                relatedId: relatedId || 'N/A',
                collabId: collabId || 'N/A',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                paymentGatewayDetails: gatewayDetails
            });

            // B. Deduct Coins if used
            if (coinsUsed > 0) {
                const userRef = db.collection('users').doc(userId);
                batch.update(userRef, {
                    coins: admin.firestore.FieldValue.increment(-coinsUsed)
                });
            }

            // C. Fulfill Service based on Type
            if (collabType === 'membership') {
                const planId = relatedId;
                const expiresAt = getExpiryDate(planId);
                const userRef = db.collection('users').doc(userId);
                
                batch.update(userRef, {
                    'membership.plan': planId,
                    'membership.isActive': true,
                    'membership.startsAt': admin.firestore.FieldValue.serverTimestamp(),
                    'membership.expiresAt': admin.firestore.Timestamp.fromDate(expiresAt)
                });

            } else if (collabType === 'boost_profile') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, {
                     userId,
                     plan: 'profile',
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                     createdAt: admin.firestore.FieldValue.serverTimestamp(),
                     targetId: userId,
                     targetType: 'profile'
                 });

            } else if (collabType === 'boost_campaign') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, { 
                     userId, 
                     plan: 'campaign', 
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), 
                     createdAt: admin.firestore.FieldValue.serverTimestamp(), 
                     targetId: relatedId, 
                     targetType: 'campaign' 
                 });
                 
                 const campRef = db.collection('campaigns').doc(relatedId);
                 batch.update(campRef, { isBoosted: true });

            } else if (collabType === 'boost_banner') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, { 
                     userId, 
                     plan: 'banner', 
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), 
                     createdAt: admin.firestore.FieldValue.serverTimestamp(), 
                     targetId: relatedId, 
                     targetType: 'banner' 
                 });
                 
                 const bannerRef = db.collection('banner_ads').doc(relatedId);
                 batch.update(bannerRef, { isBoosted: true });

            } else if (collabType === 'direct') {
                const reqRef = db.collection('collaboration_requests').doc(relatedId);
                batch.update(reqRef, { paymentStatus: 'paid', status: 'in_progress' });

            } else if (collabType === 'campaign') {
                const appRef = db.collection('campaign_applications').doc(relatedId);
                batch.update(appRef, { paymentStatus: 'paid', status: 'in_progress' });

            } else if (collabType === 'ad_slot') {
                const reqRef = db.collection('ad_slot_requests').doc(relatedId);
                batch.update(reqRef, { paymentStatus: 'paid', status: 'in_progress' });

            } else if (collabType === 'banner_booking') {
                const reqRef = db.collection('banner_booking_requests').doc(relatedId);
                batch.update(reqRef, { paymentStatus: 'paid', status: 'in_progress' });
            }

            await batch.commit();

            // Post-batch secondary updates (non-transactional safety)
            if (collabType === 'membership') {
                 const infRef = db.collection('influencers').doc(userId);
                 const infDoc = await infRef.get();
                 if (infDoc.exists) {
                     await infRef.update({ membershipActive: true });
                 }
            }
            if (collabType === 'boost_profile') {
                const uDoc = await db.collection('users').doc(userId).get();
                if (uDoc.exists) {
                    const role = uDoc.data().role;
                    if (role === 'influencer') {
                        await db.collection('influencers').doc(userId).update({ isBoosted: true }).catch(()=>{});
                    } else if (role === 'livetv') {
                        await db.collection('livetv_channels').doc(userId).update({ isBoosted: true }).catch(()=>{});
                    }
                }
            }

            // Mark order processed in pending table
            await orderRef.update({ status: 'COMPLETED' });
        }

        res.json({ order_status: status });

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Export the function
exports.createpayment = functions.https.onRequest(app);
