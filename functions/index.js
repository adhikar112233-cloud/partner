
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
// This is called AFTER verification is passed
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

// --- Helper: Verify Order Status with Cashfree ---
async function verifyCashfreeStatus(orderId) {
    try {
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        if (!appId || !secretKey) return null;

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
            return data.order_status;
        }
    } catch (error) {
        console.error("Cashfree Verification Error:", error);
    }
    return null;
}

// --- ENDPOINT 1: Create Payment Order ---
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description, coinsUsed, returnUrl } = req.body;
        
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

        if (Number(amount) === 0) {
             await processPaymentSuccess(orderId);
             return res.json({ success: true, orderId: orderId, paymentSessionId: "COIN-ONLY", message: "Paid with coins" });
        }

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
        // 1. Check Local DB
        const orderDoc = await db.collection('pending_orders').doc(orderId).get();
        if (!orderDoc.exists) return res.status(404).json({ message: "Order not found." });
        
        if (orderDoc.data().status === 'COMPLETED') {
             return res.json({ order_status: 'PAID' });
        }

        // 2. Check Cashfree (Source of Truth)
        const status = await verifyCashfreeStatus(orderId);

        // 3. Sync DB
        if (status === 'PAID') {
            await processPaymentSuccess(orderId);
        }

        res.json({ order_status: status || "PENDING" });

    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: "Verify Error" });
    }
});

// --- ENDPOINT 3: WEBHOOK (Cashfree Calls This) ---
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        // console.log("Webhook Payload:", JSON.stringify(data));

        // 1. Acknowledge Receipt Immediately
        res.status(200).send('OK');

        // 2. Verify and Process
        if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderId = data.data?.order?.order_id;
            
            if (orderId) {
                // Security Check: Verify status directly with Cashfree before trusting the webhook
                const actualStatus = await verifyCashfreeStatus(orderId);
                
                if (actualStatus === 'PAID') {
                    console.log(`Webhook Verified: Payment Success for ${orderId}`);
                    await processPaymentSuccess(orderId);
                } else {
                    console.warn(`Webhook Warning: Received success webhook for ${orderId}, but API status is ${actualStatus}`);
                }
            }
        }
    } catch (error) {
        console.error("Webhook Logic Error:", error);
        if (!res.headersSent) {
             res.status(200).send('Error processed');
        }
    }
});

// --- ENDPOINT 4: Initiate Payout (Admin Action) ---
app.post('/initiate-payout', async (req, res) => {
    try {
        const { payoutId, collection } = req.body;
        const collectionName = collection || 'payout_requests'; 

        // 1. Get Settings & Credentials
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.payoutClientId;
        const clientSecret = settings.payoutClientSecret;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ message: "Payout keys missing in Admin Settings." });
        }

        // 2. Get Payout Request Data
        const docRef = db.collection(collectionName).doc(payoutId);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            return res.status(404).json({ message: "Payout request not found" });
        }
        const payoutData = docSnap.data();
        
        if (payoutData.status === 'completed') {
            return res.status(400).json({ message: "Payout already completed" });
        }

        // 3. Parse Details (Bank or UPI)
        let transferMode = '';
        let beneficiaryDetails = {};
        // Handle daily payout structure vs standard payout structure
        const amount = payoutData.amount || payoutData.approvedAmount;

        if (payoutData.upiId) {
            transferMode = 'upi';
            beneficiaryDetails = {
                vpa: payoutData.upiId,
                phone: '9999999999', // Required by Cashfree
                name: payoutData.userName, 
                email: 'user@example.com' 
            };
        } else if (payoutData.bankDetails) {
            transferMode = 'banktoken'; 
            // Extract details from string format "Account Holder: X\nAccount Number: Y..."
            const text = payoutData.bankDetails;
            const accHolder = text.match(/Account Holder:\s*(.+)/i)?.[1]?.trim() || payoutData.userName;
            const accNum = text.match(/Account Number:\s*(.+)/i)?.[1]?.trim();
            const ifsc = text.match(/IFSC:\s*(.+)/i)?.[1]?.trim();
            
            if (!accNum || !ifsc) {
                return res.status(400).json({ message: "Could not parse Bank Account details." });
            }
            
            beneficiaryDetails = {
                bankAccount: accNum,
                ifsc: ifsc,
                name: accHolder,
                phone: '9999999999',
                email: 'user@example.com'
            };
        } else {
            return res.status(400).json({ message: "No valid payment details found in request." });
        }

        // 4. Cashfree Payout API Logic
        // We use the standard "Add Beneficiary -> Request Transfer" flow.
        
        const isTest = clientId.includes("TEST") || clientId.startsWith("CF");
        const actualBaseUrl = clientId.includes("TEST") ? "https://payout-gamma.cashfree.com" : "https://payout-api.cashfree.com";

        const headers = {
            'X-Client-Id': clientId,
            'X-Client-Secret': clientSecret,
            'Content-Type': 'application/json'
        };

        // Step A: Add Beneficiary
        // Use a unique ID to prevent conflicts if user changes details later
        const beneId = `BENE_${payoutData.userId.substring(0, 10)}_${Date.now()}`; 
        
        const addBeneBody = {
            beneId: beneId,
            name: beneficiaryDetails.name,
            email: beneficiaryDetails.email,
            phone: beneficiaryDetails.phone,
            address1: "India"
        };
        
        if (transferMode === 'banktoken') {
            addBeneBody.bankAccount = beneficiaryDetails.bankAccount;
            addBeneBody.ifsc = beneficiaryDetails.ifsc;
        } else {
            addBeneBody.vpa = beneficiaryDetails.vpa;
        }
        
        const addBeneRes = await fetch(`${actualBaseUrl}/payout/v1/addBeneficiary`, {
            method: 'POST',
            headers,
            body: JSON.stringify(addBeneBody)
        });
        
        const addBeneData = await addBeneRes.json();
        // If subCode is 409, beneficiary exists. We proceed. If other error, we might fail or try transfer anyway if ID matches.
        
        // Step B: Request Transfer
        const transferId = `TRANS_${payoutId}`;
        const transferBody = {
            beneId: beneId,
            amount: amount,
            transferId: transferId
        };

        const transferRes = await fetch(`${actualBaseUrl}/payout/v1/requestTransfer`, {
            method: 'POST',
            headers,
            body: JSON.stringify(transferBody)
        });

        const transferData = await transferRes.json();

        if (transferData.status === 'SUCCESS' || transferData.subCode === '200') {
             // 5. Update Firestore
             await docRef.update({
                 status: 'completed', 
                 transactionReference: transferData.data?.referenceId || 'PENDING',
                 payoutTimestamp: admin.firestore.FieldValue.serverTimestamp()
             });
             
             // Create Transaction Record for Payout
             await db.collection('transactions').doc(transferId).set({
                transactionId: transferId,
                userId: payoutData.userId,
                amount: amount,
                type: 'payout',
                status: 'completed',
                description: `Payout for ${payoutData.collaborationTitle || 'Earnings'}`,
                relatedId: payoutId,
                collabId: payoutData.collabId || '',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                paymentGatewayDetails: {
                    source: 'cashfree_payout',
                    referenceId: transferData.data?.referenceId
                }
             });

             return res.json({ success: true, message: "Payout Initiated", data: transferData });
        } else {
             console.error("Payout API Failed:", transferData);
             return res.status(400).json({ message: "Payout Failed at Gateway", data: transferData });
        }

    } catch (error) {
        console.error("Payout Error:", error);
        res.status(500).json({ message: "Internal Server Error: " + error.message });
    }
});

exports.createpayment = functions.https.onRequest(app);
