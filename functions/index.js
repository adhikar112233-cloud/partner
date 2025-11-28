const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ==========================================
// 1. CONFIGURATION HELPERS
// ==========================================

async function getCashfreeConfig(type = 'payment') {
    const settingsDoc = await db.doc('settings/platform').get();
    const settings = settingsDoc.data() || {};
    
    if (type === 'payment') {
        return {
            appId: settings.paymentGatewayApiId,
            secretKey: settings.paymentGatewayApiSecret,
            isTest: settings.paymentGatewayApiId && settings.paymentGatewayApiId.includes("TEST")
        };
    } else if (type === 'payout') {
        return {
            clientId: settings.payoutClientId,
            clientSecret: settings.payoutClientSecret,
            isTest: settings.payoutClientId && settings.payoutClientId.includes("TEST")
        };
    } else {
        // Verification Keys
        return {
            clientId: settings.cashfreeKycClientId,
            clientSecret: settings.cashfreeKycClientSecret,
            isTest: settings.cashfreeKycClientId && settings.cashfreeKycClientId.includes("TEST")
        };
    }
}

// ==========================================
// 2. CORE DATABASE LOGIC
// ==========================================

async function processPaymentSuccess(orderId, params) {
    const { collabType, relatedId, userId, description, collabId, amount, paymentDetails } = params;
    
    const transactionRef = db.collection('transactions').doc(orderId);
    const txDoc = await transactionRef.get();
    
    if (txDoc.exists) {
        console.log(`Order ${orderId} already processed.`);
        return { success: true, message: "Already processed" };
    }

    try {
        const batch = db.batch();

        // A. Create Transaction Record
        batch.set(transactionRef, {
            transactionId: orderId,
            userId: userId || "unknown",
            amount: Number(amount),
            type: 'payment',
            status: 'completed',
            description: description || "Payment",
            relatedId: relatedId || "",
            collabId: collabId || "", 
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            paymentGatewayDetails: paymentDetails || {}
        });

        // B. Update Related Entity based on collabType
        if (collabType && relatedId) {
            if (collabType === 'direct') {
                const ref = db.collection('collaboration_requests').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
            } else if (collabType === 'campaign') {
                const ref = db.collection('campaign_applications').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
            } else if (collabType === 'ad_slot') {
                const ref = db.collection('ad_slot_requests').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
            } else if (collabType === 'banner_booking') {
                const ref = db.collection('banner_ad_booking_requests').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
            } else if (collabType === 'membership') {
                const now = admin.firestore.Timestamp.now();
                const oneYear = new Date();
                oneYear.setFullYear(oneYear.getFullYear() + 1);
                const userRef = db.collection('users').doc(userId);
                batch.update(userRef, {
                    'membership.plan': relatedId,
                    'membership.isActive': true,
                    'membership.startsAt': now,
                    'membership.expiresAt': admin.firestore.Timestamp.fromDate(oneYear)
                });
            } else if (collabType === 'boost_profile') {
                const boostRef = db.collection('boosts').doc(); 
                const days = 7;
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + days);
                batch.set(boostRef, {
                    userId: userId,
                    targetId: userId,
                    targetType: 'profile',
                    expiresAt: admin.firestore.Timestamp.fromDate(expiry),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const userRef = db.collection('influencers').doc(userId);
                // Note: userRef might differ depending on role, usually 'influencers' collection is separate or same as users
                // For safety in this specific architecture:
                batch.update(db.collection('users').doc(userId), { isBoosted: true }); 
                // Also try influencers collection if it exists separately
                const infRef = db.collection('influencers').doc(userId);
                const infDoc = await infRef.get();
                if(infDoc.exists) {
                    batch.update(infRef, { isBoosted: true });
                }
            } else if (collabType === 'boost_campaign') {
                const boostRef = db.collection('boosts').doc(); 
                const days = 7;
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + days);
                batch.set(boostRef, {
                    userId: userId,
                    targetId: relatedId,
                    targetType: 'campaign',
                    expiresAt: admin.firestore.Timestamp.fromDate(expiry),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const campaignRef = db.collection('campaigns').doc(relatedId);
                batch.update(campaignRef, { isBoosted: true });
            } else if (collabType === 'boost_banner') {
                const boostRef = db.collection('boosts').doc(); 
                const days = 7;
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + days);
                batch.set(boostRef, {
                    userId: userId,
                    targetId: relatedId,
                    targetType: 'banner',
                    expiresAt: admin.firestore.Timestamp.fromDate(expiry),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const adRef = db.collection('banner_ads').doc(relatedId);
                batch.update(adRef, { isBoosted: true });
            }
        }

        await batch.commit();
        console.log(`Order ${orderId} verified and processed.`);
        return { success: true };
    } catch (e) {
        console.error("Error processing payment:", e);
        return { success: false, error: e.message };
    }
}

// ==========================================
// 3. PAYMENT ENDPOINTS
// ==========================================

// Create Order
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, returnUrl, collabType, relatedId, userId, description, coinsUsed, collabId } = req.body;
        
        // Handle Coin Payments (0 Amount)
        if (amount <= 0) {
            const coinOrderId = "COIN_" + Date.now();
            await processPaymentSuccess(coinOrderId, {
                collabType, relatedId, userId, description: description || "Paid with Coins", collabId, amount: 0,
                paymentDetails: { method: "COINS", coinsUsed: coinsUsed }
            });
            return res.json({ paymentSessionId: "COIN-ONLY", orderId: coinOrderId });
        }

        const config = await getCashfreeConfig('payment');
        if (!config.appId) {
             // Mock response if keys aren't set
             const mockOrderId = "order_" + Date.now();
             return res.json({ paymentSessionId: "mock_session_id", environment: "sandbox", orderId: mockOrderId });
        }
        
        const baseUrl = config.isTest ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";
        const orderId = "order_" + Date.now();
        
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'x-client-id': config.appId,
                'x-client-secret': config.secretKey,
                'x-api-version': '2023-08-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                order_amount: amount,
                order_currency: "INR",
                customer_details: { customer_id: customerId, customer_phone: phone },
                order_meta: { return_url: returnUrl ? `${returnUrl}?order_id=${orderId}` : `https://google.com?order_id=${orderId}` },
                order_tags: {
                    collabType: collabType || "unknown",
                    relatedId: relatedId || "",
                    userId: userId || "",
                    description: description || "Payment",
                    collabId: collabId || ""
                }
            })
        });
        
        const data = await response.json();
        if(response.ok) {
            return res.json({ paymentSessionId: data.payment_session_id, environment: config.isTest ? 'sandbox' : 'production', orderId });
        } else {
            return res.status(400).json({ message: data.message });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Verify Order (Polling)
app.get('/verify-order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        if (orderId.startsWith("COIN_")) {
             const doc = await db.collection('transactions').doc(orderId).get();
             return doc.exists ? res.json({ order_status: "PAID", type: "coin" }) : res.json({ order_status: "FAILED" });
        }

        const config = await getCashfreeConfig('payment');
        const baseUrl = config.isTest ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";

        const response = await fetch(`${baseUrl}/${orderId}`, {
            headers: {
                'x-client-id': config.appId,
                'x-client-secret': config.secretKey,
                'x-api-version': '2023-08-01'
            }
        });

        const data = await response.json();
        if (data.order_status === 'PAID') {
            await processPaymentSuccess(orderId, {
                collabType: data.order_tags?.collabType,
                relatedId: data.order_tags?.relatedId,
                userId: data.order_tags?.userId,
                description: data.order_tags?.description,
                collabId: data.order_tags?.collabId,
                amount: data.order_amount,
                paymentDetails: data
            });
        }
        res.json(data);
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Webhook Handler
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        // Adjust based on payload structure (v2 vs v3)
        const orderId = data?.data?.order?.order_id || data?.orderId || data?.data?.order_id;
        
        if (!orderId) {
             console.log("Webhook: No Order ID found in payload");
             return res.status(200).send("No Order ID");
        }

        console.log(`Webhook received for ${orderId}`);

        // Fetch Source of Truth from Cashfree
        const config = await getCashfreeConfig('payment');
        const baseUrl = config.isTest ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";
        
        const response = await fetch(`${baseUrl}/${orderId}`, {
            headers: {
                'x-client-id': config.appId,
                'x-client-secret': config.secretKey,
                'x-api-version': '2023-08-01'
            }
        });
        
        const orderData = await response.json();
        
        if (orderData.order_status === 'PAID') {
             await processPaymentSuccess(orderId, {
                collabType: orderData.order_tags?.collabType,
                relatedId: orderData.order_tags?.relatedId,
                userId: orderData.order_tags?.userId,
                description: orderData.order_tags?.description,
                collabId: orderData.order_tags?.collabId,
                amount: orderData.order_amount,
                paymentDetails: orderData
             });
        }
        
        res.status(200).send("OK");
    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(500).send("Error");
    }
});

// ==========================================
// 4. KYC / VERIFICATION ENDPOINTS
// ==========================================

const verifyWithCashfree = async (endpoint, body) => {
    const config = await getCashfreeConfig('verification');
    const baseUrl = config.isTest ? "https://sandbox.cashfree.com/verification" : "https://api.cashfree.com/verification";
    
    // Note: Actual Cashfree Verification might require bearer token flow or x-client headers depending on version
    // Using standard x-client headers for simplicity if supported, otherwise a token gen step is needed.
    // Assuming v1 verification API pattern:
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'x-client-id': config.clientId,
            'x-client-secret': config.clientSecret,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return await response.json();
};

app.post('/verify-pan', async (req, res) => {
    try {
        const { pan, name } = req.body;
        // Mock success for preview if no keys
        const config = await getCashfreeConfig('verification');
        if (!config.clientId) return res.json({ success: true, registeredName: name });

        const data = await verifyWithCashfree('/pan', { pan: pan, name: name });
        if (data.valid) res.json({ success: true, registeredName: data.name });
        else res.json({ success: false, message: "Invalid PAN" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/verify-bank', async (req, res) => {
    try {
        const { account, ifsc, name } = req.body;
        const config = await getCashfreeConfig('verification');
        if (!config.clientId) return res.json({ success: true, registeredName: name });

        const data = await verifyWithCashfree('/bank-account/verify', { bank_account: account, ifsc: ifsc, name: name });
        if (data.accountStatus === 'VALID') res.json({ success: true, registeredName: data.accountHolder });
        else res.json({ success: false });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/verify-upi', async (req, res) => {
    try {
        const { vpa, name } = req.body;
        const config = await getCashfreeConfig('verification');
        if (!config.clientId) return res.json({ success: true, registeredName: name });

        const data = await verifyWithCashfree('/vpa', { vpa: vpa, name: name });
        if (data.valid) res.json({ success: true, registeredName: data.name });
        else res.json({ success: false });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Mock Endpoints for other KYC steps (Implement real logic if needed)
app.post('/verify-liveness', (req, res) => res.json({ success: true }));
app.post('/verify-aadhaar-otp', (req, res) => res.json({ success: true, ref_id: "mock_ref_" + Date.now() }));
app.post('/verify-aadhaar-verify', (req, res) => res.json({ success: true }));
app.post('/verify-dl', (req, res) => res.json({ success: true }));

app.post('/mock-kyc-verify', async (req, res) => {
    // For the Mock DigiLocker page
    const { userId, status, details } = req.body;
    if (status === 'approved') {
        await db.collection('users').doc(userId).update({ 
            kycStatus: 'approved',
            kycDetails: { ...details, isAadhaarVerified: true }
        });
    } else {
        await db.collection('users').doc(userId).update({ kycStatus: 'rejected' });
    }
    res.json({ success: true });
});

// ==========================================
// 5. PAYOUTS
// ==========================================

app.post('/process-payout', async (req, res) => {
    try {
        const { requestId, requestType } = req.body; // 'Payout' or 'Daily Payout'
        
        // Fetch Request Data
        const collectionName = requestType === 'Daily Payout' ? 'daily_payout_requests' : 'payout_requests';
        const docRef = db.collection(collectionName).doc(requestId);
        const docSnap = await docRef.get();
        
        if(!docSnap.exists) return res.status(404).json({ message: "Request not found" });
        const requestData = docSnap.data();

        // Check if already processed
        if(requestData.status === 'completed' || requestData.status === 'approved') {
             return res.json({ success: true, message: "Already processed" });
        }

        // Logic to call Cashfree Payouts API would go here
        // For now, we just mark it as approved/completed in DB as a simulation
        // In a real scenario:
        // 1. Get Payout Token
        // 2. Add Beneficiary
        // 3. Request Transfer
        // 4. Update DB based on Transfer Status

        await docRef.update({ status: 'approved', processedAt: admin.firestore.FieldValue.serverTimestamp() });
        
        // If it's a regular payout, update the collaboration payment status
        if (requestType !== 'Daily Payout') {
             let collabCollection = 'collaboration_requests';
             if (requestData.collabType === 'campaign') collabCollection = 'campaign_applications';
             else if (requestData.collabType === 'ad_slot') collabCollection = 'ad_slot_requests';
             else if (requestData.collabType === 'banner_booking') collabCollection = 'banner_ad_booking_requests';
             
             await db.collection(collabCollection).doc(requestData.collaborationId).update({ paymentStatus: 'payout_complete' });
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Payout Error:", e);
        res.status(500).json({ message: e.message });
    }
});

// ==========================================
// 6. ADMIN TOOLS
// ==========================================

app.post('/admin-change-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    try {
        await admin.auth().updateUser(userId, { password: newPassword });
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ message: e.message });
    }
});

// ==========================================
// 7. CANCELLATION & PENALTY
// ==========================================

app.post('/cancel-collaboration', async (req, res) => {
    try {
        const { userId, collaborationId, collectionName, reason, penaltyAmount } = req.body;
        
        // 1. Get Refs
        const collabRef = db.collection(collectionName).doc(collaborationId);
        const userRef = db.collection('users').doc(userId); // The user cancelling (Creator)

        await db.runTransaction(async (t) => {
            const collabDoc = await t.get(collabRef);
            if (!collabDoc.exists) {
                throw new Error("Collaboration not found");
            }

            // 2. Update Collab
            t.update(collabRef, { 
                status: 'rejected', 
                rejectionReason: reason || 'Cancelled by creator',
                cancelledBy: userId,
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 3. Apply Penalty if > 0
            if (penaltyAmount > 0) {
                t.update(userRef, {
                    pendingPenalty: admin.firestore.FieldValue.increment(Number(penaltyAmount))
                });
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Cancel Collab Error:", error);
        res.status(500).json({ message: error.message });
    }
});

exports.createpayment = functions.https.onRequest(app);