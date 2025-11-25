const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Helper: Calculate Expiry Date based on plan
const getExpiryDate = (planId) => {
    const now = new Date();
    if (['basic'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 1));
    if (['pro'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 6));
    // Default or Premium is 1 year
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

// --- CORE LOGIC: Process a Successful Payment ---
// This is called by both the Frontend Check and the Webhook
async function processPaymentSuccess(orderId) {
    console.log(`Processing payment for Order ID: ${orderId}`);
    
    const orderRef = db.collection('pending_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
        console.log("Order not found in database.");
        return { success: false, message: "Order not found" };
    }

    const orderData = orderDoc.data();

    // If already paid, stop here
    if (orderData.status === 'COMPLETED') {
        console.log("Order already marked as COMPLETED.");
        return { success: true, message: "Already completed" };
    }

    const batch = db.batch();
    const { userId, collabType, relatedId, description, amount, collabId } = orderData;

    // 1. Create Transaction Record
    const transactionRef = db.collection('transactions').doc(orderId);
    batch.set(transactionRef, {
        transactionId: orderId,
        userId: userId,
        amount: amount,
        type: 'payment',
        status: 'completed',
        description: description || 'Payment',
        relatedId: relatedId || '',
        collabId: collabId || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        paymentGatewayDetails: {
            source: 'cashfree',
            referenceId: orderId,
            via: 'automated'
        }
    });

    // 2. Activate Services based on Type
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
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 Days Boost
        batch.set(boostRef, {
            userId,
            plan: 'profile',
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            targetId: relatedId,
            targetType: 'profile'
        });
        // Mark profile as boosted
        const infRef = db.collection('influencers').doc(relatedId);
        const tvRef = db.collection('livetv_channels').doc(relatedId);
        const infDoc = await infRef.get();
        if (infDoc.exists) {
            batch.update(infRef, { isBoosted: true });
        } else {
            const tvDoc = await tvRef.get();
            if(tvDoc.exists) batch.update(tvRef, { isBoosted: true });
        }
    }
    else if (collabType === 'boost_campaign') {
        const boostRef = db.collection('boosts').doc();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        batch.set(boostRef, {
            userId,
            plan: 'campaign',
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            targetId: relatedId,
            targetType: 'campaign'
        });
        const campRef = db.collection('campaigns').doc(relatedId);
        const campDoc = await campRef.get();
        if (campDoc.exists) {
            batch.update(campRef, { isBoosted: true });
        }
    }
    else if (collabType === 'boost_banner') {
        const boostRef = db.collection('boosts').doc();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        batch.set(boostRef, {
            userId,
            plan: 'banner',
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            targetId: relatedId,
            targetType: 'banner'
        });
        const banRef = db.collection('banner_ads').doc(relatedId);
        const banDoc = await banRef.get();
        if (banDoc.exists) {
            batch.update(banRef, { isBoosted: true });
        }
    }
    else if (['direct', 'campaign', 'ad_slot', 'banner_booking'].includes(collabType)) {
        let collectionName = '';
        if (collabType === 'direct') collectionName = 'collaboration_requests';
        if (collabType === 'campaign') collectionName = 'campaign_applications';
        if (collabType === 'ad_slot') collectionName = 'ad_slot_requests';
        if (collabType === 'banner_booking') collectionName = 'banner_booking_requests';
        
        if (collectionName) {
            const collabRef = db.collection(collectionName).doc(relatedId);
            batch.update(collabRef, { 
                paymentStatus: 'paid',
                status: 'in_progress' 
            });
        }
    }
    
    // 3. Mark Order as Completed
    batch.update(orderRef, { status: 'COMPLETED' });

    await batch.commit();
    console.log("Database updated successfully.");
    return { success: true, status: 'PAID' };
}

// --- ENDPOINT 1: Create Payment Order ---
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description, coinsUsed, returnUrl } = req.body;
        
        // Get Keys from Firestore
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        if (!appId || !secretKey) {
            return res.status(500).json({ message: "Payment Gateway keys missing in Admin Settings." });
        }

        const isTest = appId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
        const orderId = "ORDER-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        
        // Save pending order
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

        // Handle 0 amount (coin redemption)
        if (Number(amount) === 0) {
             await processPaymentSuccess(orderId); // Auto-complete
             return res.json({ success: true, orderId: orderId, paymentSessionId: "COIN-ONLY", message: "Paid with coins" });
        }

        // Handle Cashfree API
        // Use the provided returnUrl (from frontend) or fallback to a default
        const finalReturnUrl = returnUrl ? `${returnUrl}?order_id=${orderId}` : `https://bigyapon.com/?order_id=${orderId}`;

        const payload = {
            order_id: orderId,
            order_amount: Number(amount),
            order_currency: "INR",
            customer_details: {
                customer_id: customerId || "guest",
                customer_phone: String(phone)
            },
            order_meta: {
                return_url: finalReturnUrl
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
            console.error("Cashfree Init Error:", data);
            res.status(400).json({ message: data.message || "Cashfree Error" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 2: Verify Order (Frontend Calls This) ---
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        // 1. Check if already completed in our DB
        const orderDoc = await db.collection('pending_orders').doc(orderId).get();
        if (!orderDoc.exists) return res.status(404).json({ message: "Order not found." });
        
        if (orderDoc.data().status === 'COMPLETED') {
             return res.json({ order_status: 'PAID' });
        }

        // 2. If not, ask Cashfree status
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        let status = "PENDING";

        if(appId && secretKey) {
            const isTest = appId.includes("TEST");
            const baseUrl = isTest ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
            
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
            }
        }

        // 3. If Cashfree says PAID, update our DB
        if (status === 'PAID') {
            await processPaymentSuccess(orderId);
        }

        res.json({ order_status: status });

    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: "Verify Error" });
    }
});

// --- ENDPOINT 3: WEBHOOK (Cashfree Calls This) ---
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        console.log("Webhook Payload:", JSON.stringify(data));

        // Check for Payment Success Webhook (Cashfree V3 Format)
        if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderId = data.data?.order?.order_id;
            const paymentStatus = data.data?.payment?.payment_status;

            if (orderId && paymentStatus === "SUCCESS") {
                console.log(`Webhook: Payment Success for ${orderId}`);
                await processPaymentSuccess(orderId);
            }
        }

        // Always return 200 to Cashfree
        res.status(200).send('OK');
    } catch (error) {
        console.error("Webhook Logic Error:", error);
        // Still return 200 to prevent Cashfree retries if it's a logic error on our side
        res.status(200).send('Error processed');
    }
});

exports.createpayment = functions.https.onRequest(app);