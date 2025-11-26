
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
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

// --- CORE LOGIC: Process a Successful Payment (Collections) ---
async function processPaymentSuccess(orderId) {
    console.log(`Processing payment for Order ID: ${orderId}`);
    
    const orderRef = db.collection('pending_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
        console.log("Order not found in database.");
        return { success: false, message: "Order not found" };
    }

    const orderData = orderDoc.data();

    if (orderData.status === 'COMPLETED') {
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
    return { success: true, status: 'PAID' };
}

// --- Helper: Verify Order Status with Cashfree (PG) ---
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

// --- ENDPOINT 1: Create Payment Order (PG) ---
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
            res.status(400).json({ message: data.message || "Cashfree Error" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 2: Verify Order (PG) ---
app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderDoc = await db.collection('pending_orders').doc(orderId).get();
        if (!orderDoc.exists) return res.status(404).json({ message: "Order not found." });
        
        if (orderDoc.data().status === 'COMPLETED') {
             return res.json({ order_status: 'PAID' });
        }

        const status = await verifyCashfreeStatus(orderId);

        if (status === 'PAID') {
            await processPaymentSuccess(orderId);
        }

        res.json({ order_status: status || "PENDING" });

    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: "Verify Error" });
    }
});

// --- ENDPOINT 3: INITIATE PAYOUT (Cashfree Payouts) ---
app.post('/initiate-payout', async (req, res) => {
    try {
        const { payoutId, collection } = req.body;
        
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.payoutClientId ? settings.payoutClientId.trim() : '';
        const clientSecret = settings.payoutClientSecret ? settings.payoutClientSecret.trim() : '';

        if (!clientId || !clientSecret) {
            return res.status(500).json({ message: "Payout keys missing in Admin Settings." });
        }

        const collectionName = collection || 'payout_requests';
        const payoutRef = db.collection(collectionName).doc(payoutId);
        const payoutDoc = await payoutRef.get();

        if (!payoutDoc.exists) {
            return res.status(404).json({ message: "Payout request not found." });
        }

        const payoutData = payoutDoc.data();
        if (payoutData.status === 'completed' || payoutData.status === 'processing') {
            return res.status(400).json({ message: "Payout already processed." });
        }

        // Beneficiary Details Parsing
        let beneId, beneName, beneAccount, beneIfsc, beneVpa, beneEmail, benePhone;
        
        if (payoutData.upiId) {
            beneId = `UPI_${payoutData.userId}`.replace(/[^a-zA-Z0-9]/g, '');
            beneVpa = payoutData.upiId;
            beneName = payoutData.userName;
            beneEmail = "user@bigyapon.com"; 
            benePhone = "9999999999"; 
        } else if (payoutData.bankDetails) {
            const lines = payoutData.bankDetails.split('\n');
            const holderLine = lines.find(l => l.includes('Account Holder:'));
            const accLine = lines.find(l => l.includes('Account Number:'));
            const ifscLine = lines.find(l => l.includes('IFSC:'));

            beneName = holderLine ? holderLine.split(':')[1].trim() : payoutData.userName;
            beneAccount = accLine ? accLine.split(':')[1].trim() : '';
            beneIfsc = ifscLine ? ifscLine.split(':')[1].trim() : '';
            beneId = `BANK_${beneAccount}`;
            beneEmail = "user@bigyapon.com";
            benePhone = "9999999999";

            if (!beneAccount || !beneIfsc) {
                return res.status(400).json({ message: "Invalid bank details format in database." });
            }
        } else {
            return res.status(400).json({ message: "No payment details found." });
        }

        // Cashfree Payout API Logic
        const isTest = clientId.includes("TEST");
        const actualBaseUrl = isTest ? "https://payout-gamma.cashfree.com" : "https://payout-api.cashfree.com";

        // A. AUTHORIZE
        const authResponse = await fetch(`${actualBaseUrl}/payout/v1/authorize`, {
            method: 'POST',
            headers: { 'X-Client-Id': clientId, 'X-Client-Secret': clientSecret, 'Content-Type': 'application/json' }
        });
        const authData = await authResponse.json();
        
        if(authData.status !== 'SUCCESS' || !authData.data || !authData.data.token) {
             return res.status(400).json({ message: `Auth Failed: ${authData.message || authData.subCode}`, data: authData });
        }
        const authToken = authData.data.token;

        // B. ADD BENEFICIARY
        const benePayload = { beneId, name: beneName, email: beneEmail, phone: benePhone, address1: "India" };
        if (beneVpa) benePayload.vpa = beneVpa;
        else { benePayload.bankAccount = beneAccount; benePayload.ifsc = beneIfsc; }

        await fetch(`${actualBaseUrl}/payout/v1/addBeneficiary`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(benePayload)
        });

        // C. REQUEST TRANSFER
        const transferId = `TF_${payoutId}_${Date.now()}`;
        const transferPayload = {
            beneId,
            amount: Number(payoutData.approvedAmount || payoutData.amount),
            transferId,
            transferMode: beneVpa ? "UPI" : "IMPS",
            remarks: `Payout for ${payoutData.collabTitle}`
        };

        const transferResponse = await fetch(`${actualBaseUrl}/payout/v1/requestTransfer`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(transferPayload)
        });

        const transferData = await transferResponse.json();

        if (transferData.status === 'SUCCESS' || transferData.subCode === '200') {
            await payoutRef.update({
                status: 'processing',
                transferId: transferId,
                payoutReference: transferData.data?.referenceId || ''
            });
            return res.json({ success: true, message: "Transfer Initiated", data: transferData });
        } else {
            return res.status(400).json({ message: transferData.message || "Transfer Failed", data: transferData });
        }

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 4: WEBHOOK ---
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        res.status(200).send('OK');

        if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderId = data.data?.order?.order_id;
            if (orderId) {
                const actualStatus = await verifyCashfreeStatus(orderId);
                if (actualStatus === 'PAID') await processPaymentSuccess(orderId);
            }
        }
        else if (["TRANSFER_SUCCESS", "TRANSFER_FAILED", "TRANSFER_REVERSED"].includes(data.type)) {
             const transfer = data.data;
             const transferId = transfer.transferId;
             
             let newStatus = 'pending';
             if (data.type === "TRANSFER_SUCCESS") newStatus = 'completed';
             if (data.type === "TRANSFER_FAILED") newStatus = 'rejected';
             if (data.type === "TRANSFER_REVERSED") newStatus = 'rejected';

             const payoutQuery = await db.collection('payout_requests').where('transferId', '==', transferId).get();
             
             if (!payoutQuery.empty) {
                 payoutQuery.docs[0].ref.update({ status: newStatus });
                 if (newStatus === 'completed') {
                     const pData = payoutQuery.docs[0].data();
                     let colName = '';
                     if(pData.collaborationType === 'direct') colName = 'collaboration_requests';
                     if(pData.collaborationType === 'campaign') colName = 'campaign_applications';
                     if(pData.collaborationType === 'ad_slot') colName = 'ad_slot_requests';
                     if(pData.collaborationType === 'banner_booking') colName = 'banner_booking_requests';
                     
                     if(colName && pData.collaborationId) {
                         db.collection(colName).doc(pData.collaborationId).update({ paymentStatus: 'payout_complete' });
                     }
                 }
             } else {
                 const dailyQuery = await db.collection('daily_payout_requests').where('transferId', '==', transferId).get();
                 if (!dailyQuery.empty) {
                     dailyQuery.docs[0].ref.update({ status: newStatus });
                 }
             }
        }
    } catch (error) {
        console.error("Webhook Error:", error);
    }
});

// --- ENDPOINT 5: Verify PAN ---
app.post('/verify-pan', async (req, res) => {
    try {
        const { userId, pan, name } = req.body;
        if (!pan || !name) return res.status(400).json({ message: "PAN and Name are required." });

        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.cashfreeKycClientId;
        const clientSecret = settings.cashfreeKycClientSecret;

        if (!clientId || !clientSecret) return res.status(500).json({ message: "Cashfree Verification keys missing." });

        const isTest = clientId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/verification" : "https://api.cashfree.com/verification";

        const response = await fetch(`${baseUrl}/pan`, {
            method: 'POST',
            headers: { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pan, name })
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            const nameMatch = data.name_match_score >= 0.8; 
            await db.collection('users').doc(userId).update({
                kycStatus: nameMatch ? 'approved' : 'pending', 
                'kycDetails.idType': 'PAN',
                'kycDetails.idNumber': pan,
                'kycDetails.isPanVerified': true,
                'kycDetails.panNameMatch': nameMatch,
                'kycDetails.verifiedBy': 'Cashfree'
            });
            return res.json({ success: true, message: "PAN Verified", data });
        } else {
            return res.status(400).json({ message: data.message || "PAN Verification Failed", data });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 6: Verify Bank (Penny Drop) ---
app.post('/verify-bank', async (req, res) => {
    try {
        const { userId, account, ifsc, name } = req.body;
        
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.cashfreeKycClientId;
        const clientSecret = settings.cashfreeKycClientSecret;

        if (!clientId || !clientSecret) return res.status(500).json({ message: "Keys missing." });

        const isTest = clientId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/verification" : "https://api.cashfree.com/verification";

        const response = await fetch(`${baseUrl}/bank-account/sync`, {
            method: 'POST',
            headers: { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bank_account: account, ifsc: ifsc, name: name })
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            return res.json({ success: true, message: "Bank Verified", nameMatch: data.name_match_score >= 0.8, registeredName: data.registered_name });
        } else {
            return res.status(400).json({ message: data.message || "Verification Failed" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 7: Verify UPI ---
app.post('/verify-upi', async (req, res) => {
    try {
        const { userId, vpa, name } = req.body;
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.cashfreeKycClientId;
        const clientSecret = settings.cashfreeKycClientSecret;

        if (!clientId || !clientSecret) return res.status(500).json({ message: "Keys missing." });

        const isTest = clientId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/verification" : "https://api.cashfree.com/verification";

        const response = await fetch(`${baseUrl}/upi`, {
            method: 'POST',
            headers: { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'Content-Type': 'application/json' },
            body: JSON.stringify({ vpa: vpa, name: name })
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            return res.json({ success: true, message: "UPI Verified", nameMatch: data.name_match_score >= 0.8, registeredName: data.registered_name });
        } else {
            return res.status(400).json({ message: data.message || "Verification Failed" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 8: Verify GST ---
app.post('/verify-gst', async (req, res) => {
    try {
        const { userId, gstin, businessName } = req.body;
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const clientId = settings.cashfreeKycClientId;
        const clientSecret = settings.cashfreeKycClientSecret;

        if (!clientId || !clientSecret) return res.status(500).json({ message: "Keys missing." });

        const isTest = clientId.includes("TEST");
        const baseUrl = isTest ? "https://sandbox.cashfree.com/verification" : "https://api.cashfree.com/verification";

        const response = await fetch(`${baseUrl}/gstin`, {
            method: 'POST',
            headers: { 'x-client-id': clientId, 'x-client-secret': clientSecret, 'Content-Type': 'application/json' },
            body: JSON.stringify({ gstin: gstin, business_name: businessName })
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            await db.collection('users').doc(userId).update({
                'creatorVerificationDetails.isGstVerified': true,
                'creatorVerificationDetails.gstRegisteredName': data.legal_name
            });
            return res.json({ success: true, message: "GST Verified", data });
        } else {
            return res.status(400).json({ message: data.message || "Verification Failed" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT: Mock KYC ---
app.post('/mock-kyc-verify', async (req, res) => {
    try {
        const { userId, status, details } = req.body;
        const newStatus = status || 'approved';
        
        await db.collection('users').doc(userId).update({
            kycStatus: newStatus,
            kycDetails: details || {}
        });

        res.json({ success: true, message: "Mock KYC Processed", status: newStatus });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
    }
});

exports.createpayment = functions.https.onRequest(app);
