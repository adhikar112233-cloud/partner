
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

// Helper to calculate membership expiry dates
const getExpiryDate = (planId) => {
    const now = new Date();
    // Monthly plans
    if (['basic'].includes(planId)) { 
        return new Date(now.setMonth(now.getMonth() + 1));
    }
    // 6-Month plans
    if (['pro'].includes(planId)) { 
        return new Date(now.setMonth(now.getMonth() + 6));
    }
    // Default 1 Year (Premium, Brand Plans: pro_10, pro_20, pro_unlimited)
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

// ------------------------------------------------------------------
// 1. Create Payment Endpoint
// ------------------------------------------------------------------
app.post('/', async (req, res) => {
    try {
        const { 
            amount, 
            phone, 
            customerId, 
            collabType, 
            relatedId, 
            collabId, 
            userId, 
            description, 
            coinsUsed 
        } = req.body;
        
        // Validate required fields
        if (amount === undefined || !phone) {
            return res.status(400).json({ message: "Missing required fields (amount, phone)" });
        }

        // Fetch Platform Settings for API Credentials from Firestore
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        if (!appId || !secretKey) {
            return res.status(500).json({ message: "Payment gateway configuration missing. Please configure keys in Admin Panel." });
        }

        // Determine API Environment based on App ID prefix (Standard Cashfree practice)
        // TEST prefix = Sandbox, No prefix = Production
        const isTest = appId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

        // Create a unique Order ID
        const orderId = "ORDER-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        
        // Store order intent in Firestore immediately
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

        // Handle Full Coin Redemption (Zero Amount Payment)
        if (Number(amount) === 0) {
             return res.json({
                success: true,
                orderId: orderId,
                paymentSessionId: "COIN-REDEMPTION", // Dummy session ID
                message: "Paid with coins",
                amount: 0
            });
        }

        // Determine Return URL dynamically based on the request origin (Vercel or Localhost)
        const origin = req.headers.origin || 'https://bigyapon.com';
        const returnUrl = `${origin}/success?order_id=${orderId}`;

        // Prepare Cashfree API Payload (API Version 2023-08-01)
        const payload = {
            order_id: orderId,
            order_amount: Number(amount),
            order_currency: "INR",
            customer_details: {
                customer_id: customerId || "guest",
                customer_phone: String(phone)
            },
            order_meta: {
                return_url: returnUrl
            },
            order_tags: {
                collabType: String(collabType),
                userId: String(userId)
            }
        };

        // Call Cashfree Create Order API
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
            console.error("Cashfree API Error:", data);
            res.status(400).json({ message: data.message || "Payment Gateway Error" });
        }

    } catch (error) {
        console.error("Create Payment Function Error:", error);
        res.status(500).json({ message: error.message || "Internal Server Error" });
    }
});

// ------------------------------------------------------------------
// 2. Verify Order & Fulfill Service Endpoint
// ------------------------------------------------------------------
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    
    try {
        // Retrieve order details from Firestore
        const orderRef = db.collection('pending_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ message: "Order not found in records." });
        }

        const orderData = orderDoc.data();
        let status = 'PENDING';
        let gatewayDetails = {};

        // 2a. Verify Status with Gateway (Skip if amount is 0)
        if (orderData.amount === 0) {
            status = 'PAID';
        } else {
            const settingsDoc = await db.doc('settings/platform').get();
            const settings = settingsDoc.data() || {};
            const appId = settings.paymentGatewayApiId;
            const secretKey = settings.paymentGatewayApiSecret;
            const isTest = appId && appId.includes("TEST");
            const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";

            try {
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
                    status = data.order_status; // PAID, ACTIVE, EXPIRED, etc.
                    gatewayDetails = data;
                }
            } catch (err) {
                console.error("Error contacting payment gateway:", err);
            }
        }

        // 2b. Process Fulfillment if Status is PAID
        if (status === 'PAID') {
            // Check if already processed to prevent duplicate transactions
            if (orderData.status === 'COMPLETED') {
                return res.json({ order_status: 'PAID', message: "Order already processed." });
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

            // C. Fulfill Specific Service
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

                // Also update influencer profile mirror if exists
                const infRef = db.collection('influencers').doc(userId);
                const infDoc = await infRef.get();
                if(infDoc.exists) {
                    batch.update(infRef, { membershipActive: true });
                }

            } else if (collabType === 'boost_profile') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 // Log Boost
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, {
                     userId,
                     plan: 'profile',
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                     createdAt: admin.firestore.FieldValue.serverTimestamp(),
                     targetId: userId,
                     targetType: 'profile'
                 });

                 // Update User Profile
                 const userDoc = await db.collection('users').doc(userId).get();
                 if (userDoc.exists) {
                     const role = userDoc.data().role;
                     if (role === 'influencer') {
                         batch.update(db.collection('influencers').doc(userId), { isBoosted: true });
                     } else if (role === 'livetv') {
                         batch.update(db.collection('livetv_channels').doc(userId), { isBoosted: true });
                     } else if (role === 'banneragency') {
                         const adsQuery = await db.collection('banner_ads').where('agencyId', '==', userId).get();
                         adsQuery.docs.forEach(doc => batch.update(doc.ref, { isBoosted: true }));
                     }
                 }

            } else if (collabType === 'boost_campaign') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, { userId, plan: 'campaign', expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), createdAt: admin.firestore.FieldValue.serverTimestamp(), targetId: relatedId, targetType: 'campaign' });
                 
                 const campRef = db.collection('campaigns').doc(relatedId);
                 batch.update(campRef, { isBoosted: true });

            } else if (collabType === 'boost_banner') {
                 const days = 7;
                 const expiresAt = new Date();
                 expiresAt.setDate(expiresAt.getDate() + days);
                 
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, { userId, plan: 'banner', expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), createdAt: admin.firestore.FieldValue.serverTimestamp(), targetId: relatedId, targetType: 'banner' });
                 
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

            // Commit all updates atomically
            await batch.commit();

            // Mark order as COMPLETED in pending_orders to prevent re-processing
            await orderRef.update({ status: 'COMPLETED' });
        }

        // Return the final status to the client
        res.json({ order_status: status });

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Internal Server Error during verification." });
    }
});

// Export the Express app as a Firebase Cloud Function
exports.createpayment = functions.https.onRequest(app);
