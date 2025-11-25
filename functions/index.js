
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const https = require('https');
const PaytmChecksum = require('paytmchecksum');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
app.use(cors({ origin: true }));
// Explicitly handle OPTIONS requests
app.options('*', cors({ origin: true }));

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
        activePaymentGateway: 'paytm',
        paymentGatewayApiId: '',
        paymentGatewayApiSecret: '',
        paytmMid: '',
        paytmMerchantKey: '',
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
                    paytmMid: data.paytmMid || settings.paytmMid,
                    paytmMerchantKey: data.paytmMerchantKey || settings.paytmMerchantKey,
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
             
             batch.set(userRef, updateData, { merge: true });
             
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

    // Use 'method' as per user request to select gateway
    // Accepting customerId specifically as requested by user snippet
    let { amount, purpose, relatedId, collabId, collabType, phone, gateway, method, coinsUsed, orderId: clientOrderId, userId: reqUserId, customerId } = req.body;
    
    // Fallback to customerId if userId is not provided directly
    let userId = reqUserId || customerId;

    // If userId not in body, try to get from token
    if (!userId) {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (idToken) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (error) {
                // Token invalid
            }
        }
    }

    if (!userId) return res.status(401).send({ message: 'Unauthorized: No User ID' });

    // Normalize gateway selection using 'method' or 'gateway'
    let preferredGateway = gateway || method;
    if (preferredGateway) preferredGateway = preferredGateway.toLowerCase();

    // Provide defaults if missing
    if (!collabType) collabType = 'direct'; 
    if (!relatedId) relatedId = 'unknown';

    // Check User Coin Balance if coins are used
    if (coinsUsed && coinsUsed > 0) {
        const userDoc = await db.collection('users').doc(userId).get();
        const userCoins = userDoc.data().coins || 0;
        
        if (userCoins < coinsUsed) {
            return res.status(400).send({ message: 'Insufficient coin balance' });
        }
        if (coinsUsed > 100) {
            return res.status(400).send({ message: 'Maximum 100 coins allowed per transaction' });
        }
    }

    let orderAmount = parseFloat(amount);
    // Allow 0 amount only if coins are used
    if (isNaN(orderAmount) || orderAmount < 0) return res.status(400).send({ message: 'Invalid amount' });
    if (orderAmount === 0 && (!coinsUsed || coinsUsed <= 0)) return res.status(400).send({ message: 'Invalid amount' });

    const orderId = clientOrderId || `order_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
        // Handle Wallet-Only Payment (Full coverage by coins)
        if (orderAmount === 0 && coinsUsed > 0) {
            const transactionData = {
                userId,
                type: 'payment',
                description: purpose || 'Wallet Payment',
                relatedId,
                collabId: collabId || null,
                collabType,
                amount: 0,
                coinsUsed: coinsUsed,
                status: 'pending',
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
        
        // Determine final gateway
        const activeGateway = (preferredGateway && (preferredGateway === 'paytm' || preferredGateway === 'cashfree'))
            ? preferredGateway 
            : (settings.activePaymentGateway || 'paytm');

        console.log(`Creating order ${orderId} via ${activeGateway} for amount ${orderAmount}`);

        // Create pending transaction
        await db.collection('transactions').doc(orderId).set({
            userId,
            type: 'payment',
            description: purpose || 'Payment',
            relatedId,
            collabId: collabId || null,
            collabType,
            amount: orderAmount,
            coinsUsed: coinsUsed || 0,
            status: 'pending',
            transactionId: orderId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            paymentGateway: activeGateway,
        });

        // Determine correct base URL based on region
        const region = process.env.FUNCTION_REGION || 'asia-south1';
        const projectId = process.env.GCLOUD_PROJECT;
        const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/createPayment`;

        if (activeGateway === 'paytm') {
            const MID = settings.paytmMid;
            const MKEY = settings.paytmMerchantKey;

            if (!MID || !MKEY) throw new Error('Paytm credentials missing in settings');

            const paytmParams = {};
            paytmParams.body = {
                "requestType": "Payment",
                "mid": MID,
                "websiteName": "DEFAULT",
                "orderId": orderId,
                "callbackUrl": `${functionUrl}/verify-order/${orderId}`,
                "txnAmount": {
                    "value": orderAmount.toString(),
                    "currency": "INR",
                },
                "userInfo": {
                    "custId": userId,
                    "mobile": customerPhone,
                    "email": customerEmail
                },
            };

            const checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), MKEY);
            paytmParams.head = {
                "signature": checksum
            };

            const post_data = JSON.stringify(paytmParams);

            const requestPromise = new Promise((resolve, reject) => {
                const options = {
                    hostname: 'securegw.paytm.in',
                    port: 443,
                    path: `/theia/api/v1/initiateTransaction?mid=${MID}&orderId=${orderId}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': post_data.length
                    }
                };

                const apiReq = https.request(options, (apiRes) => {
                    let responseData = "";
                    apiRes.on('data', (chunk) => { responseData += chunk; });
                    apiRes.on('end', () => { 
                        try {
                            resolve(JSON.parse(responseData)); 
                        } catch (e) {
                            console.error("Paytm Response Parse Error. Raw:", responseData);
                            reject(new Error("Invalid JSON response from Paytm"));
                        }
                    });
                });

                apiReq.on('error', (e) => { reject(e); });
                apiReq.write(post_data);
                apiReq.end();
            });

            const response = await requestPromise;
            
            if (response.body && response.body.txnToken) {
                return res.status(200).send({
                    gateway: 'paytm',
                    txnToken: response.body.txnToken,
                    order_id: orderId,
                    amount: orderAmount,
                    internal_order_id: orderId,
                    mid: MID
                });
            } else {
                console.error("Paytm Init Failed:", response);
                throw new Error(response.body?.resultInfo?.resultMsg || 'Paytm Initiation Failed');
            }

        } else {
            // CASHFREE
            const CASHFREE_ID = settings.paymentGatewayApiId;
            const CASHFREE_SECRET = settings.paymentGatewayApiSecret;

            if (!CASHFREE_ID || !CASHFREE_SECRET) throw new Error('Cashfree credentials missing in settings');

            const isSandbox = CASHFREE_ID.toUpperCase().startsWith("TEST");
            const baseUrl = isSandbox ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";

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
                        // Using the origin from request if available, else fallback
                        return_url: (req.headers.origin || "https://www.bigyapon.com") + `/payment-success?order_id=${orderId}`,
                        notify_url: `${functionUrl}/verify-order/${orderId}`
                    }
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Cashfree Error');

            return res.status(200).send({ 
                gateway: 'cashfree',
                payment_session_id: data.payment_session_id,
                paymentSessionId: data.payment_session_id, // Add alias for camelCase convenience
                environment: isSandbox ? 'sandbox' : 'production',
                id: data.payment_session_id,
                payment_link: data.payment_link,
                coinsUsed: coinsUsed || 0,
                cf: data
            });
        }

    } catch (error) {
        console.error(`Create Order Error (${orderId}):`, error.message);
        return res.status(500).send({ message: error.message });
    }
};

const verifyOrderHandler = async (req, res) => {
    if (!db) return res.status(503).send({ message: 'DB Disconnected' });
    
    const orderId = req.params.orderId || req.body.orderId || req.body.order_id;
    
    try {
        if (!orderId) return res.status(400).send({ message: 'Missing Order ID' });

        const transactionRef = db.collection("transactions").doc(orderId);
        const transactionDoc = await transactionRef.get();

        if (!transactionDoc.exists) return res.status(404).send({ message: 'Order not found.' });
        
        const transactionData = transactionDoc.data();
        const settings = await getPaymentSettings();

        // Paytm Verification
        if (transactionData.status === 'pending' && transactionData.paymentGateway === 'paytm') {
             const MID = settings.paytmMid;
             const MKEY = settings.paytmMerchantKey;

             if (MID && MKEY) {
                 const paytmParams = {};
                 paytmParams.body = { "mid": MID, "orderId": orderId };

                 const checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), MKEY);
                 paytmParams.head = { "signature": checksum };

                 const post_data = JSON.stringify(paytmParams);

                 const requestPromise = new Promise((resolve, reject) => {
                     const options = {
                         hostname: 'securegw.paytm.in',
                         port: 443,
                         path: '/v3/order/status',
                         method: 'POST',
                         headers: {
                             'Content-Type': 'application/json',
                             'Content-Length': post_data.length
                         }
                     };

                     const apiReq = https.request(options, (apiRes) => {
                         let responseData = "";
                         apiRes.on('data', (chunk) => { responseData += chunk; });
                         apiRes.on('end', () => { 
                             try {
                                resolve(JSON.parse(responseData)); 
                             } catch(e) {
                                reject(new Error("Failed to parse Paytm verify response"));
                             }
                         });
                     });
                     apiReq.on('error', (e) => { reject(e); });
                     apiReq.write(post_data);
                     apiReq.end();
                 });

                 const response = await requestPromise;
                 if (response.body && response.body.resultInfo && response.body.resultInfo.resultStatus === 'TXN_SUCCESS') {
                     await fulfillOrder(orderId, transactionData, response.body);
                     return res.status(200).send({ order_id: orderId, order_status: 'PAID' });
                 }
             }
        }
        
        // Cashfree Verification
        else if (transactionData.status === 'pending' && transactionData.paymentGateway === 'cashfree') {
             const CASHFREE_ID = settings.paymentGatewayApiId;
             const CASHFREE_SECRET = settings.paymentGatewayApiSecret;
             
             if (CASHFREE_ID && CASHFREE_SECRET) {
                 const isSandbox = CASHFREE_ID.toUpperCase().startsWith("TEST");
                 const baseUrl = isSandbox ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";
                 
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
             }
        }

        const freshDoc = await transactionRef.get();
        return res.status(200).send({
            order_id: orderId,
            order_status: freshDoc.data().status === 'completed' ? 'PAID' : 'PENDING',
        });

    } catch (error) {
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
        await payoutRef.update({ status: 'processing' });
        res.status(200).send({ success: true });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

const applyReferralHandler = async (req, res) => {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).send({ message: "Missing userId or code" });

    try {
        const usersRef = db.collection('users');
        const referrerQuery = await usersRef.where('referralCode', '==', code).limit(1).get();
        
        if (referrerQuery.empty) return res.status(400).send({ message: "Invalid referral code." });
        
        const referrerDoc = referrerQuery.docs[0];
        if (referrerDoc.id === userId) return res.status(400).send({ message: "You cannot refer yourself." });

        await db.runTransaction(async (t) => {
            const userRef = usersRef.doc(userId);
            const userDoc = await t.get(userRef);
            
            if (!userDoc.exists) throw new Error("User not found");
            if (userDoc.data().referredBy) throw new Error("User already referred");

            t.update(referrerDoc.ref, { coins: (referrerDoc.data().coins || 0) + 50 });
            t.update(userRef, { coins: (userDoc.data().coins || 0) + 20, referredBy: code, referralAppliedAt: admin.firestore.FieldValue.serverTimestamp() });

            const txRef1 = db.collection('transactions').doc();
            t.set(txRef1, { userId: referrerDoc.id, type: 'referral', description: 'Referral Reward', relatedId: userId, amount: 50, status: 'completed', transactionId: txRef1.id, timestamp: admin.firestore.FieldValue.serverTimestamp(), isCredit: true, currency: 'COINS' });
            
            const txRef2 = db.collection('transactions').doc();
            t.set(txRef2, { userId: userId, type: 'referral', description: `Welcome bonus for using code ${code}`, relatedId: referrerDoc.id, amount: 20, status: 'completed', transactionId: txRef2.id, timestamp: admin.firestore.FieldValue.serverTimestamp(), isCredit: true, currency: 'COINS' });
        });

        return res.status(200).send({ success: true });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

const setPaymentGatewayHandler = async (req, res) => {
    const { gateway } = req.body;
    try {
        if (!db) return res.status(503).send({ message: "DB not connected" });
        await db.collection('settings').doc('platform').set({ activePaymentGateway: gateway }, { merge: true });
        return res.status(200).send({ success: true, active: gateway });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
};

const getActiveGatewayHandler = async (req, res) => {
    try {
        const settings = await getPaymentSettings();
        res.status(200).send({ active: settings.activePaymentGateway || 'paytm' });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Define Routes
app.post('/createOrder', createOrderHandler);
// Handle root request as well to match the specific URL provided
app.post('/', createOrderHandler); 

app.get('/verify-order/:orderId', verifyOrderHandler);
app.post('/verify-order/:orderId', verifyOrderHandler);
app.post('/process-payout', processPayoutHandler);
app.post('/apply-referral', applyReferralHandler);
app.post('/setPaymentGateway', setPaymentGatewayHandler);
app.get('/getActiveGateway', getActiveGatewayHandler);

// Export the API
// Matches URL https://asia-south1-bigyapon2-cfa39.cloudfunctions.net/createPayment
exports.createPayment = functions.region('asia-south1').https.onRequest(app);
