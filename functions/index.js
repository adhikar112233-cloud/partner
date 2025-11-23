
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
app.use(cors({ origin: true }));

// Parse JSON with rawBody for webhooks
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Robust Firebase Initialization
let db;
try {
    if (!admin.apps.length) {
        admin.initializeApp({
             credential: admin.credential.applicationDefault(),
        });
    }
    db = admin.firestore();
    console.log("Firebase Admin initialized successfully.");
} catch (error) {
    console.error("Firebase initialization failed:", error.message);
    console.log("Server will start in degraded mode. DB features may fail.");
}

// Health Check
app.get('/', (req, res) => {
    res.status(200).send(`API is running. DB Status: ${db ? 'Connected' : 'Disconnected'}`);
});

const getCollectionNameForCollab = (collabType) => {
    const collectionMap = {
      direct: 'collaboration_requests',
      campaign: 'campaign_applications',
      ad_slot: 'ad_slot_requests',
      banner_booking: 'banner_booking_requests',
      membership: null,
      boost_profile: null,
      boost_campaign: null,
      boost_banner: null,
    };
    return collectionMap[collabType] || null;
};

// Helper to get Payment Settings safely
const getPaymentSettings = async () => {
    let settings = {
        activePaymentGateway: process.env.ACTIVE_PAYMENT_GATEWAY || 'razorpay',
        paymentGatewayApiId: process.env.CASHFREE_ID || '',
        paymentGatewayApiSecret: process.env.CASHFREE_SECRET || '',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_RiFI4JfUCt7mQ9',
        razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    };

    if (db) {
        try {
            const doc = await db.collection('settings').doc('platform').get();
            if (doc.exists) {
                const data = doc.data();
                settings = {
                    activePaymentGateway: data.activePaymentGateway || settings.activePaymentGateway,
                    paymentGatewayApiId: data.paymentGatewayApiId || settings.paymentGatewayApiId,
                    paymentGatewayApiSecret: data.paymentGatewayApiSecret || settings.paymentGatewayApiSecret,
                    razorpayKeyId: data.razorpayKeyId || settings.razorpayKeyId,
                    razorpayKeySecret: data.razorpayKeySecret || settings.razorpayKeySecret,
                };
            }
        } catch (error) {
            console.error("Error fetching settings from DB:", error.message);
        }
    }
    return settings;
};

const fulfillOrder = async (orderId, transactionData, paymentGatewayDetails) => {
    if (!db) {
        console.error("Cannot fulfill order: DB connection missing.");
        return;
    }
    
    console.log(`Fulfilling order: ${orderId}`);
    const transactionRef = db.collection("transactions").doc(orderId);
    
    try {
        const docSnap = await transactionRef.get();
        if (!docSnap.exists) {
             console.error(`Transaction ${orderId} not found.`);
             return;
        }
        
        if (docSnap.data().status === 'completed') {
            console.log(`Order ${orderId} already completed.`);
            return;
        }

        const batch = db.batch();
        const txData = docSnap.data();
        
        // Update transaction status
        batch.update(transactionRef, {
            status: "completed",
            paymentGatewayDetails: paymentGatewayDetails || {},
        });

        const { collabType, relatedId, userId, coinsUsed } = txData;

        // 1. Deduct Coins if used (Atomic decrement)
        if (coinsUsed && coinsUsed > 0) {
            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, {
                coins: admin.firestore.FieldValue.increment(-coinsUsed)
            });
            console.log(`Deducting ${coinsUsed} coins from user ${userId}`);
        }

        // 2. Fulfillment Logic
        if (collabType === 'membership') {
             const userRef = db.collection('users').doc(userId);
             const plan = relatedId;
             const now = admin.firestore.Timestamp.now();
             let expiryDate = new Date(now.toDate());
             
             switch (plan) {
                 case 'basic': expiryDate.setMonth(expiryDate.getMonth() + 1); break;
                 case 'pro': expiryDate.setMonth(expiryDate.getMonth() + 6); break;
                 case 'premium': expiryDate.setFullYear(expiryDate.getFullYear() + 1); break;
                 case 'pro_10':
                 case 'pro_20':
                 case 'pro_unlimited':
                     expiryDate.setFullYear(expiryDate.getFullYear() + 1); break;
                 default: expiryDate.setMonth(expiryDate.getMonth() + 1); break;
             }
     
             const updateData = {
                 'membership.plan': plan,
                 'membership.isActive': true,
                 'membership.startsAt': now,
                 'membership.expiresAt': admin.firestore.Timestamp.fromDate(expiryDate),
             };
             
             // Use update to ensure nested fields are updated correctly via dot notation
             batch.update(userRef, updateData);
             
             // If influencer, verify active status
             const userDoc = await userRef.get();
             if (userDoc.exists && userDoc.data().role === 'influencer') {
                 const influencerRef = db.collection('influencers').doc(userId);
                 batch.set(influencerRef, { membershipActive: true }, { merge: true });
             }

        } else if (collabType && collabType.startsWith('boost_')) {
             const boostType = collabType.split('_')[1];
             const targetId = relatedId;
             
             if (boostType && targetId) {
                 const days = 7;
                 const now = new Date();
                 const expiresAt = new Date();
                 expiresAt.setDate(now.getDate() + days);
     
                 const boostRef = db.collection('boosts').doc();
                 batch.set(boostRef, {
                     userId: userId,
                     plan: boostType,
                     expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                     createdAt: admin.firestore.FieldValue.serverTimestamp(),
                     targetId: targetId,
                     targetType: boostType,
                 });
                 
                 let targetCollection = null;
                 if (boostType === 'campaign') targetCollection = 'campaigns';
                 else if (boostType === 'banner') targetCollection = 'banner_ads';
                 else if (boostType === 'profile') {
                     const userDoc = await db.collection('users').doc(userId).get();
                     if (userDoc.exists) {
                         const userRole = userDoc.data().role;
                         if (userRole === 'influencer') targetCollection = 'influencers';
                         if (userRole === 'livetv') targetCollection = 'livetv_channels';
                     }
                 }
                 
                 if (targetCollection) {
                     batch.set(db.collection(targetCollection).doc(targetId), { isBoosted: true }, { merge: true });
                 }
             }
        } else {
             const collectionName = getCollectionNameForCollab(collabType);
             if (collectionName && relatedId) {
                 const collabRef = db.collection(collectionName).doc(relatedId);
                 // Check if document exists before update to prevent crash
                 const collabDoc = await collabRef.get();
                 if (collabDoc.exists) {
                     batch.update(collabRef, {
                         status: 'in_progress',
                         paymentStatus: 'paid'
                     });
                 } else {
                     console.error(`Related collaboration document ${relatedId} not found in ${collectionName}`);
                 }
             }
        }

        await batch.commit();
        console.log(`Order ${orderId} fulfillment successful.`);

    } catch (e) {
        console.error(`Fulfillment failed for ${orderId}:`, e);
    }
};

const createOrderHandler = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send({ message: 'Method Not Allowed' });

    if (!db) return res.status(503).send({ message: 'Service Unavailable: Database not connected' });

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).send({ message: 'Unauthorized' });

    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userId = decodedToken.uid;
    } catch (error) {
        return res.status(403).send({ message: 'Invalid Token' });
    }

    // coinsUsed and returnUrl are passed from frontend. amount passed should be the final amount (gateway amount)
    const { amount, purpose, relatedId, collabId, collabType, phone, gateway: preferredGateway, coinsUsed, returnUrl } = req.body;

    if (!relatedId || !collabType) {
        return res.status(400).send({ message: 'Missing fields' });
    }

    // Ensure coinsUsed is a valid number, default to 0
    const coinsToDeduct = coinsUsed ? Number(coinsUsed) : 0;

    // Check User Coin Balance if coins are used
    if (coinsToDeduct > 0) {
        const userDoc = await db.collection('users').doc(userId).get();
        const userCoins = userDoc.data().coins || 0;
        
        if (userCoins < coinsToDeduct) {
            return res.status(400).send({ message: 'Insufficient coin balance' });
        }
        if (coinsToDeduct > 100) {
            return res.status(400).send({ message: 'Maximum 100 coins allowed per transaction' });
        }
    }

    let orderAmount = parseFloat(amount);
    // Allow 0 amount only if coins are used
    if (isNaN(orderAmount) || orderAmount < 0) return res.status(400).send({ message: 'Invalid amount' });
    if (orderAmount === 0 && coinsToDeduct <= 0) return res.status(400).send({ message: 'Invalid amount' });

    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
        // Handle Wallet-Only Payment (Full coverage by coins)
        if (orderAmount === 0 && coinsToDeduct > 0) {
            const transactionData = {
                userId,
                type: 'payment',
                description: purpose || 'Wallet Payment',
                relatedId,
                collabId: collabId || null,
                collabType,
                amount: 0,
                coinsUsed: coinsToDeduct,
                status: 'pending', // Initially pending, immediately fulfilled
                transactionId: orderId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                paymentGateway: 'wallet',
            };
            
            await db.collection('transactions').doc(orderId).set(transactionData);
            
            // Fulfill immediately
            await fulfillOrder(orderId, transactionData, { gateway: 'wallet' });
            
            return res.status(200).send({
                success: true,
                order_id: orderId,
                amount: 0,
                currency: "INR",
                gateway: 'wallet',
                id: orderId 
            });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return res.status(404).send({ message: 'User not found' });
        
        const userData = userDoc.data();
        const customerPhone = phone || userData.mobileNumber || "9999999999";
        const customerEmail = userData.email || "noemail@example.com";

        const settings = await getPaymentSettings();
        
        const gateway = (preferredGateway === 'razorpay' || preferredGateway === 'cashfree') 
            ? preferredGateway 
            : (settings.activePaymentGateway || 'razorpay');

        console.log(`Creating order ${orderId} via ${gateway} for amount ${orderAmount}, coins used: ${coinsToDeduct}`);

        // Create pending transaction with coinsUsed field
        // NOTE: We will update providerOrderId AFTER getting it from gateway, but within this function
        const transactionData = {
            userId,
            type: 'payment',
            description: purpose || 'Payment',
            relatedId,
            collabId: collabId || null,
            collabType,
            amount: orderAmount, // The actual money paid
            coinsUsed: coinsToDeduct, // The coins to deduct on success
            status: 'pending',
            transactionId: orderId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            paymentGateway: gateway,
        };
        
        await db.collection('transactions').doc(orderId).set(transactionData);

        if (gateway === 'razorpay') {
            // RAZORPAY
            const KEY_ID = settings.razorpayKeyId;
            const KEY_SECRET = settings.razorpayKeySecret;

            if (!KEY_ID || !KEY_SECRET) throw new Error('Razorpay credentials missing in settings');

            const authHeader = 'Basic ' + Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64');
            const razorpayAmount = Math.round(orderAmount * 100); // to paise

            const response = await fetch("https://api.razorpay.com/v1/orders", {
                method: "POST",
                headers: {
                    "Authorization": authHeader,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amount: razorpayAmount,
                    currency: "INR",
                    receipt: orderId,
                    notes: { purpose: purpose || 'Payment', customer_id: userId, internal_order_id: orderId }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.description || 'Razorpay Error');

            // CRITICAL: Update transaction with providerOrderId immediately so verification works
            await db.collection('transactions').doc(orderId).update({
                providerOrderId: data.id
            });

            return res.status(200).send({
                gateway: 'razorpay',
                order_id: data.id, // Razorpay ID
                internal_order_id: orderId, // Our DB ID
                key_id: KEY_ID,
                amount: data.amount,
                currency: data.currency,
                coinsUsed: coinsToDeduct,
                id: data.id 
            });

        } else {
            // CASHFREE
            const CASHFREE_ID = settings.paymentGatewayApiId;
            const CASHFREE_SECRET = settings.paymentGatewayApiSecret;

            if (!CASHFREE_ID || !CASHFREE_SECRET) throw new Error('Cashfree credentials missing in settings');

            const isSandbox = CASHFREE_ID.toUpperCase().startsWith("TEST");
            const baseUrl = isSandbox ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";
            
            // Build the Notify URL pointing to this function instance
            const projectID = process.env.GCLOUD_PROJECT || 'bigyapon2-cfa39';
            const notifyUrl = `https://us-central1-${projectID}.cloudfunctions.net/api/cashfree-webhook`;

            // Use provided returnUrl from client to handle dynamic environments (dev/prod), 
            // fallback to generic root URL if missing.
            const finalReturnUrl = returnUrl || `https://www.bigyapon.com/?order_id={order_id}`;

            const response = await fetch(baseUrl, {
                method: "POST",
                headers: {
                    "x-api-version": "2023-08-01",
                    "x-client-id": CASHFREE_ID,
                    "x-client-secret": CASHFREE_SECRET,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    order_id: orderId,
                    order_amount: orderAmount,
                    order_currency: "INR",
                    order_note: purpose || 'Payment',
                    customer_details: {
                        customer_id: "CUST_" + userId.substring(0, 10),
                        customer_email: customerEmail,
                        customer_phone: customerPhone.replace(/\D/g, '').slice(-10),
                        customer_name: userData.name ? userData.name.substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, '') : "Customer",
                    },
                    order_meta: {
                        return_url: finalReturnUrl,
                        notify_url: notifyUrl
                    }
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Cashfree Error');

            // CRITICAL: Update transaction with providerOrderId immediately
            await db.collection('transactions').doc(orderId).update({
                providerOrderId: data.payment_session_id
            });

            return res.status(200).send({ 
                gateway: 'cashfree',
                payment_session_id: data.payment_session_id,
                environment: isSandbox ? 'sandbox' : 'production',
                id: data.payment_session_id,
                coinsUsed: coinsToDeduct
            });
        }

    } catch (error) {
        console.error(`Create Order Error (${orderId}):`, error.message);
        return res.status(500).send({ message: error.message });
    }
};

const verifyRazorpayHandler = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send({ message: 'Method Not Allowed' });

    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return res.status(400).send({ message: 'Missing verification details' });
    }

    try {
        const settings = await getPaymentSettings();
        const secret = settings.razorpayKeySecret;
        if (!secret) return res.status(500).send({ message: 'Server config error' });

        const generatedSignature = crypto.createHmac('sha256', secret)
            .update(razorpayOrderId + "|" + razorpayPaymentId)
            .digest('hex');

        if (generatedSignature === razorpaySignature) {
             const transactionRef = db.collection("transactions").doc(orderId);
             const transactionDoc = await transactionRef.get();
             
             if (transactionDoc.exists) {
                 await fulfillOrder(orderId, transactionDoc.data(), {
                     gateway: 'razorpay',
                     razorpayPaymentId,
                     razorpayOrderId
                 });
                 return res.status(200).send({ success: true });
             } else {
                 return res.status(404).send({ message: 'Order not found' });
             }
        } else {
             return res.status(400).send({ message: 'Invalid signature' });
        }
    } catch (error) {
        console.error("Verification error:", error);
        return res.status(500).send({ message: 'Verification failed' });
    }
};

// Cashfree Webhook Handler
const cashfreeWebhookHandler = async (req, res) => {
    console.log("Received Cashfree Webhook:", JSON.stringify(req.body));
    try {
        const data = req.body.data;
        
        if (!data || !data.order || !data.payment) {
             console.warn("Ignored Cashfree webhook: missing data/order/payment", req.body);
             return res.status(200).send('Ignored');
        }

        const orderId = data.order.order_id;
        const paymentStatus = data.payment.payment_status;

        if (paymentStatus === 'SUCCESS') {
             console.log(`Webhook: Order ${orderId} SUCCESS`);
             
             if (!db) { 
                 console.error("DB not ready for webhook"); 
                 return res.status(500).send('DB Error'); 
             }
             
             const transactionRef = db.collection("transactions").doc(orderId);
             const docSnap = await transactionRef.get();
             
             if (docSnap.exists()) {
                 await fulfillOrder(orderId, docSnap.data(), {
                     gateway: 'cashfree',
                     webhook: true,
                     payment_group: data.payment.payment_group,
                     payment_method: data.payment.payment_method,
                     cf_payment_id: data.payment.cf_payment_id
                 });
             } else {
                 console.error(`Transaction ${orderId} not found via webhook`);
             }
        } else {
             console.log(`Webhook: Order ${orderId} status ${paymentStatus}`);
        }

        res.status(200).send('OK');
    } catch (e) {
        console.error("Cashfree Webhook Error:", e);
        res.status(500).send('Error');
    }
};

const verifyOrderHandler = async (req, res) => {
    if (!db) return res.status(503).send({ message: 'DB Disconnected' });
    
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).send({ message: 'Unauthorized' });

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const { orderId } = req.params;

        const transactionRef = db.collection("transactions").doc(orderId);
        const transactionDoc = await transactionRef.get();

        if (!transactionDoc.exists) return res.status(404).send({ message: 'Order not found.' });
        
        const transactionData = transactionDoc.data();
        // Security check: ensure the user requesting verification owns the transaction
        if (transactionData.userId !== decoded.uid) return res.status(403).send({ message: 'Forbidden.' });
        
        // If completed, just return PAID. If pending, try to verify with Gateway API.
        if (transactionData.status === 'pending') {
             const settings = await getPaymentSettings();

             // CASHFREE LOGIC
             if (transactionData.paymentGateway === 'cashfree') {
                 const CASHFREE_ID = settings.paymentGatewayApiId;
                 const CASHFREE_SECRET = settings.paymentGatewayApiSecret;
                 
                 if (CASHFREE_ID && CASHFREE_SECRET) {
                     const isSandbox = CASHFREE_ID.toUpperCase().startsWith("TEST");
                     const baseUrl = isSandbox ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";
                     
                     try {
                         console.log(`Fetching verification from Cashfree for ${orderId}`);
                         const response = await fetch(`${baseUrl}/${orderId}`, {
                             headers: {
                                "x-api-version": "2023-08-01",
                                "x-client-id": CASHFREE_ID,
                                "x-client-secret": CASHFREE_SECRET,
                             }
                         });
                         
                         if (response.ok) {
                             const gatewayData = await response.json();
                             if (gatewayData.order_status === 'PAID') {
                                 await fulfillOrder(orderId, transactionData, gatewayData);
                                 return res.status(200).send({ order_id: orderId, order_status: 'PAID' });
                             }
                         }
                     } catch (e) { console.error("Cashfree verify fetch error", e); }
                 }
             }

             // RAZORPAY LOGIC
             if (transactionData.paymentGateway === 'razorpay' && transactionData.providerOrderId) {
                 const KEY_ID = settings.razorpayKeyId;
                 const KEY_SECRET = settings.razorpayKeySecret;

                 if (KEY_ID && KEY_SECRET) {
                     const authHeader = 'Basic ' + Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64');
                     try {
                         console.log(`Fetching verification from Razorpay for ${orderId}`);
                         const response = await fetch(`https://api.razorpay.com/v1/orders/${transactionData.providerOrderId}`, {
                             headers: { "Authorization": authHeader }
                         });
                         if (response.ok) {
                             const data = await response.json();
                             // Razorpay order status: created, attempted, paid
                             // Check if amount_paid matches (or is greater due to overpayment/currency)
                             if (data.status === 'paid' || (data.amount_paid > 0 && data.amount_paid >= data.amount)) {
                                 await fulfillOrder(orderId, transactionData, {
                                     gateway: 'razorpay',
                                     razorpayOrderId: data.id,
                                     verifiedViaApi: true
                                 });
                                 return res.status(200).send({ order_id: orderId, order_status: 'PAID' });
                             }
                         }
                     } catch (e) { console.error("Razorpay verify fetch error", e); }
                 }
             }
        }

        return res.status(200).send({
            order_id: orderId,
            order_status: transactionData.status === 'completed' ? 'PAID' : 'PENDING',
        });

    } catch (error) {
        console.error(`Verify Error (${req.params.orderId}):`, error);
        return res.status(500).send({ message: error.message });
    }
};

const processPayoutHandler = async (req, res) => {
    if (!db) return res.status(503).send({ message: 'DB Disconnected' });
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) return res.status(401).send({ message: 'Unauthorized' });

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const adminDoc = await db.collection('users').doc(decoded.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'staff') {
             return res.status(403).send({ message: 'Forbidden' });
        }

        const { payoutRequestId } = req.body;
        const payoutRef = db.collection('payout_requests').doc(payoutRequestId);
        
        // Simulate processing
        await payoutRef.update({ status: 'processing' });
        res.status(200).send({ success: true });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

const applyReferralHandler = async (req, res) => {
    const { userId, code } = req.body;
    console.log(`[Referral] Request received: User ${userId} applying code ${code}`);

    if (!userId || !code) return res.status(400).send({ message: "Missing userId or code" });

    try {
        const usersRef = db.collection('users');
        const referrerQuery = await usersRef.where('referralCode', '==', code).limit(1).get();
        
        if (referrerQuery.empty) {
            return res.status(400).send({ message: "Invalid referral code." });
        }
        
        const referrerDoc = referrerQuery.docs[0];
        const referrerId = referrerDoc.id;
        
        if (referrerId === userId) {
             return res.status(400).send({ message: "You cannot refer yourself." });
        }

        await db.runTransaction(async (t) => {
            const userRef = usersRef.doc(userId);
            const userDoc = await t.get(userRef);
            
            if (!userDoc.exists) throw new Error("User not found");
            if (userDoc.data().referredBy) throw new Error("User already referred");

            // Update Referrer
            const referrerData = referrerDoc.data();
            const newReferrerCoins = (referrerData.coins || 0) + 50;
            t.update(referrerDoc.ref, { coins: newReferrerCoins });

            // Update User
            const userData = userDoc.data();
            const newUserCoins = (userData.coins || 0) + 20;
            t.update(userRef, { 
                coins: newUserCoins,
                referredBy: code,
                referralAppliedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 1. Referrer Transaction Record
            const txRef1 = db.collection('transactions').doc();
            t.set(txRef1, {
                userId: referrerId,
                type: 'referral',
                description: `Reward for referring ${userData.name || 'User'}`,
                relatedId: userId,
                amount: 50,
                status: 'completed',
                transactionId: txRef1.id,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isCredit: true,
                currency: 'COINS'
            });
            
            // 2. Referee Transaction Record
            const txRef2 = db.collection('transactions').doc();
            t.set(txRef2, {
                userId: userId,
                type: 'referral',
                description: `Welcome bonus for using code ${code}`,
                relatedId: referrerId,
                amount: 20,
                status: 'completed',
                transactionId: txRef2.id,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isCredit: true,
                currency: 'COINS'
            });

            // 3. Audit Record
            const referralRef = db.collection('referrals').doc();
            t.set(referralRef, {
                referrerUid: referrerId,
                referredUid: userId,
                referrerCode: code,
                awarded: true,
                referrerCoins: 50,
                referredCoins: 20,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        return res.status(200).send({ success: true });

    } catch (error) {
        console.error(`[Referral] Error: ${error.message}`);
        return res.status(500).send({ message: error.message });
    }
};

// Define Routes
app.post('/create-order', createOrderHandler);
app.post('/verify-razorpay', verifyRazorpayHandler);
app.get('/verify-order/:orderId', verifyOrderHandler);
app.post('/process-payout', processPayoutHandler);
app.post('/apply-referral', applyReferralHandler);
app.post('/cashfree-webhook', cashfreeWebhookHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

exports.api = app;
