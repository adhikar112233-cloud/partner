const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Helper: Calculate Expiry Date for Memberships
const getExpiryDate = (planId) => {
    const now = new Date();
    if (['basic'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 1));
    if (['pro'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 6));
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

// ------------------------------------------------------------------
// 1. CREATE ORDER (The app asks this function to start a payment)
// ------------------------------------------------------------------
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description, coinsUsed } = req.body;
        
        // 1. Get your Cashfree Keys from the Database (Admin Panel Settings)
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        if (!appId || !secretKey) {
            // Fallback for testing if keys aren't in DB yet
            console.warn("Cashfree keys missing in Firestore settings.");
            return res.status(500).json({ message: "Payment Gateway not configured in Admin Settings." });
        }

        // 2. Check if keys are for TEST (Sandbox) or LIVE (Production)
        const isTest = appId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

        // 3. Create a unique Order ID
        const orderId = "ORDER-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        
        // 4. Save the order intent
        await db.collection('pending_orders').doc(orderId).set({
            userId: userId || customerId,
            amount: Number(amount),
            coinsUsed: Number(coinsUsed) || 0,
            collabType: collabType || 'direct',
            relatedId: relatedId || 'unknown',
            collabId: collabId || 'unknown',
            description: description || 'Payment',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'PENDING'
        });

        // 5. Handle 0 Amount (Paid fully by coins)
        if (Number(amount) === 0) {
             return res.json({ success: true, orderId: orderId, paymentSessionId: "COIN-ONLY", message: "Paid with coins" });
        }

        // 6. Talk to Cashfree to get a Session ID
        const fetch = require("node-fetch"); 
        
        const payload = {
            order_id: orderId,
            order_amount: Number(amount),
            order_currency: "INR",
            customer_details: {
                customer_id: customerId || "guest",
                customer_phone: String(phone)
            },
            order_meta: {
                // This return_url is handled by the frontend mostly, but required by API
                return_url: `https://bigyapon.com/payment?order_id=${orderId}`
            }
        };

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
        
        if (response.ok && data.payment_session_id) {
            res.json({
                success: true,
                paymentSessionId: data.payment_session_id,
                orderId: orderId,
                environment: isTest ? "sandbox" : "production"
            });
        } else {
            console.error("Cashfree Error:", data);
            res.status(400).json({ message: data.message || "Cashfree Error" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// ------------------------------------------------------------------
// 2. VERIFY ORDER (The app asks this function: "Did they pay?")
// ------------------------------------------------------------------
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderRef = db.collection('pending_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) return res.status(404).json({ message: "Order not found." });

        const orderData = orderDoc.data();
        let status = orderData.status;

        // If already completed, return success immediately
        if (status === 'COMPLETED') {
             return res.json({ order_status: 'PAID' });
        }

        // Logic check
        if (orderData.amount === 0) {
            status = 'PAID';
        } else {
            // Get Keys again
            const settingsDoc = await db.doc('settings/platform').get();
            const settings = settingsDoc.data() || {};
            const appId = settings.paymentGatewayApiId;
            const secretKey = settings.paymentGatewayApiSecret;
            
            if(appId && secretKey) {
                const isTest = appId.includes("TEST");
                const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
                
                const fetch = require("node-fetch");
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
                    status = data.order_status; // PAID, ACTIVE, etc.
                }
            }
        }

        // If Paid, Deliver the Service (Update Database)
        if (status === 'PAID' && orderData.status !== 'COMPLETED') {
            const batch = db.batch();
            const { userId, collabType, relatedId, description } = orderData;

            // 1. Record Transaction
            const transactionRef = db.collection('transactions').doc(orderId);
            batch.set(transactionRef, {
                transactionId: orderId,
                userId: userId,
                amount: orderData.amount,
                type: 'payment',
                status: 'completed',
                description: description || 'Payment',
                relatedId: relatedId || '',
                collabId: orderData.collabId || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                paymentGatewayDetails: {
                    source: 'cashfree',
                    referenceId: orderId
                }
            });

            // 2. Handle specific services
            if (collabType === 'membership') {
                const userRef = db.collection('users').doc(userId);
                batch.update(userRef, {
                    'membership.isActive': true,
                    'membership.plan': relatedId,
                    'membership.expiresAt': admin.firestore.Timestamp.fromDate(getExpiryDate(relatedId))
                });
                
                // Also update influencer profile if exists
                const infRef = db.collection('influencers').doc(userId);
                const infDoc = await infRef.get();
                if (infDoc.exists) {
                    batch.update(infRef, { membershipActive: true });
                }
            } 
            else if (collabType === 'boost_profile') {
                const boostRef = db.collection('boosts').doc();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                
                batch.set(boostRef, {
                    userId,
                    plan: 'profile',
                    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    targetId: relatedId,
                    targetType: 'profile'
                });
                
                // Attempt to update influencer or live tv channel
                const infRef = db.collection('influencers').doc(relatedId);
                const tvRef = db.collection('livetv_channels').doc(relatedId);
                
                // Ideally we check existence, but for speed we can just try update in a transaction or optimistic
                // Since we are in a batch, we need to know which doc. Assuming influencer for now or relying on frontend logic mapping.
                // Actually, safer to just let frontend refresh see the boost active. 
                // But to show 'Boosted' badge we need isBoosted: true on profile.
                const infDoc = await infRef.get();
                if (infDoc.exists) {
                    batch.update(infRef, { isBoosted: true });
                } else {
                    const tvDoc = await tvRef.get();
                    if(tvDoc.exists) batch.update(tvRef, { isBoosted: true });
                }
            }
            else if (collabType === 'direct' || collabType === 'campaign' || collabType === 'ad_slot' || collabType === 'banner_booking') {
                // Update the collaboration status to paid
                // Need to know the collection name based on type. 
                // relatedId is usually the document ID of the request.
                let collectionName = '';
                if (collabType === 'direct') collectionName = 'collaboration_requests';
                if (collabType === 'campaign') collectionName = 'campaign_applications';
                if (collabType === 'ad_slot') collectionName = 'ad_slot_requests';
                if (collabType === 'banner_booking') collectionName = 'banner_booking_requests';
                
                if (collectionName) {
                    const collabRef = db.collection(collectionName).doc(relatedId);
                    // We update paymentStatus to 'paid' and status to 'in_progress' if it was 'agreement_reached'
                    batch.update(collabRef, { 
                        paymentStatus: 'paid',
                        status: 'in_progress' 
                    });
                }
            }
            
            await batch.commit();
            await orderRef.update({ status: 'COMPLETED' });
        }

        res.json({ order_status: status });

    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: "Verify Error" });
    }
});

exports.createpayment = functions.https.onRequest(app);
