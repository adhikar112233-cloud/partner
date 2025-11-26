
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
    console.log("Database updated successfully.");
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
            console.error("Cashfree Init Error:", data);
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

// --- ENDPOINT 3: INITIATE PAYOUT (Cashfree Payouts V1) ---
app.post('/initiate-payout', async (req, res) => {
    try {
        const { payoutId, collection } = req.body;
        
        // 1. Get Settings & Credentials
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        // Trim to avoid "Token is not valid" caused by spaces
        const clientId = settings.payoutClientId ? settings.payoutClientId.trim() : '';
        const clientSecret = settings.payoutClientSecret ? settings.payoutClientSecret.trim() : '';

        if (!clientId || !clientSecret) {
            return res.status(500).json({ message: "Payout keys missing in Admin Settings." });
        }

        // 2. Get Payout Request Document
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

        // 3. Parse Beneficiary Details
        let beneId, beneName, beneAccount, beneIfsc, beneVpa, beneEmail, benePhone;
        
        if (payoutData.upiId) {
            beneId = `UPI_${payoutData.userId}`.replace(/[^a-zA-Z0-9]/g, ''); // Sanitize ID
            beneVpa = payoutData.upiId;
            beneName = payoutData.userName;
            beneEmail = "user@bigyapon.com"; // Placeholder required by CF
            benePhone = "9999999999"; // Placeholder required by CF
        } else if (payoutData.bankDetails) {
            // Simple parsing assuming the format stored in PayoutRequestPage.tsx
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

        // 4. Cashfree Payout API Logic
        const isTest = clientId.includes("TEST");
        // Use gamma for Sandbox, api for Prod
        const actualBaseUrl = isTest ? "https://payout-gamma.cashfree.com" : "https://payout-api.cashfree.com";

        console.log(`Initiating Payout Auth to: ${actualBaseUrl}`);

        // STEP A: AUTHORIZE (Get Bearer Token)
        const authResponse = await fetch(`${actualBaseUrl}/payout/v1/authorize`, {
            method: 'POST',
            headers: {
                'X-Client-Id': clientId,
                'X-Client-Secret': clientSecret,
                'Content-Type': 'application/json'
            }
        });
        
        const authData = await authResponse.json();
        
        if(authData.status !== 'SUCCESS' || !authData.data || !authData.data.token) {
             console.error("Payout Auth Error:", JSON.stringify(authData));
             return res.status(400).json({ message: `Auth Failed: ${authData.message || authData.subCode}`, data: authData });
        }
        
        const authToken = authData.data.token;

        // STEP B: ADD BENEFICIARY (Idempotent-ish, ignore if exists)
        const benePayload = {
            beneId,
            name: beneName,
            email: beneEmail,
            phone: benePhone,
            address1: "India"
        };
        if (beneVpa) benePayload.vpa = beneVpa;
        else {
            benePayload.bankAccount = beneAccount;
            benePayload.ifsc = beneIfsc;
        }

        await fetch(`${actualBaseUrl}/payout/v1/addBeneficiary`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(benePayload)
        });
        // We ignore errors here (e.g. beneficiary already exists 409) and proceed to transfer

        // STEP C: REQUEST TRANSFER
        const transferId = `TF_${payoutId}_${Date.now()}`;
        const transferPayload = {
            beneId,
            amount: Number(payoutData.approvedAmount || payoutData.amount), // Handle daily payout amount override
            transferId,
            transferMode: beneVpa ? "UPI" : "IMPS",
            remarks: `Payout for ${payoutData.collabTitle}`
        };

        const transferResponse = await fetch(`${actualBaseUrl}/payout/v1/requestTransfer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transferPayload)
        });

        const transferData = await transferResponse.json();

        if (transferData.status === 'SUCCESS' || transferData.subCode === '200') {
            // Success
            await payoutRef.update({
                status: 'processing', // Will be updated to 'completed' via Webhook or manually
                transferId: transferId,
                payoutReference: transferData.data?.referenceId || ''
            });
            return res.json({ success: true, message: "Transfer Initiated", data: transferData });
        } else {
            console.error("Transfer Error:", transferData);
            return res.status(400).json({ message: transferData.message || "Transfer Failed", data: transferData });
        }

    } catch (error) {
        console.error("Payout Error:", error);
        return res.status(500).json({ message: error.message });
    }
});

// --- ENDPOINT 4: WEBHOOK (Cashfree Calls This) ---
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        // Cashfree expects 200 OK immediately
        res.status(200).send('OK');

        console.log("Webhook Received:", JSON.stringify(data));

        // 1. Payment Gateway Success
        if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
            const orderId = data.data?.order?.order_id;
            if (orderId) {
                const actualStatus = await verifyCashfreeStatus(orderId);
                if (actualStatus === 'PAID') {
                    await processPaymentSuccess(orderId);
                }
            }
        }
        // 2. Payout Updates (Transfer Success/Failed/Reversed)
        else if (["TRANSFER_SUCCESS", "TRANSFER_FAILED", "TRANSFER_REVERSED"].includes(data.type)) {
             const transfer = data.data;
             const transferId = transfer.transferId;
             // const referenceId = transfer.referenceId;
             
             let newStatus = 'pending';
             if (data.type === "TRANSFER_SUCCESS") newStatus = 'completed';
             if (data.type === "TRANSFER_FAILED") newStatus = 'rejected';
             if (data.type === "TRANSFER_REVERSED") newStatus = 'rejected';

             // Find document by transferId
             // We check both collections as we don't know which one it was
             const payoutQuery = await db.collection('payout_requests').where('transferId', '==', transferId).get();
             
             if (!payoutQuery.empty) {
                 payoutQuery.docs[0].ref.update({ status: newStatus });
                 
                 // If completed, update collab status
                 if (newStatus === 'completed') {
                     const pData = payoutQuery.docs[0].data();
                     let colName = '';
                     if(pData.collaborationType === 'direct') colName = 'collaboration_requests';
                     if(pData.collaborationType === 'campaign') colName = 'campaign_applications';
                     if(pData.collaborationType === 'ad_slot') colName = 'ad_slot_requests';
                     if(pData.collaborationType === 'banner_booking') colName = 'banner_booking_requests';
                     
                     if(colName && pData.collaborationId) {
                         db.collection(colName).doc(pData.collaborationId).update({
                             paymentStatus: 'payout_complete'
                         });
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
        console.error("Webhook Processing Error:", error);
        // Don't return error to Cashfree to avoid retries if logic fails
    }
});

// --- NEW ENDPOINT: Mock KYC Verification (For Testing) ---
app.post('/mock-kyc-verify', async (req, res) => {
    try {
        const { userId, status, details } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        const newStatus = status || 'approved';
        
        // Mock Data Generation
        const mockKycData = details || {
            verifiedBy: 'Mock DigiLocker',
            verificationDate: new Date().toISOString(),
            idType: 'Aadhaar',
            idNumber: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
            name: 'Verified User',
            dob: '01-01-1990',
            gender: 'Male',
            address: '123 Mock Street, Digital City, Internet',
            pincode: '110001',
            state: 'Delhi',
            country: 'India'
        };

        await db.collection('users').doc(userId).update({
            kycStatus: newStatus,
            kycDetails: mockKycData
        });

        console.log(`Mock KYC Verification successful for user ${userId} with status ${newStatus}`);
        res.json({ success: true, message: "Mock KYC Verification Processed", status: newStatus, data: mockKycData });

    } catch (error) {
        console.error("Mock KYC Verification Error:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

exports.createpayment = functions.https.onRequest(app);
