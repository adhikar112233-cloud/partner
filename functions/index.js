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

// --- HELPER: Get Cashfree Config ---
async function getCashfreeConfig(type = 'payment') {
    const settingsDoc = await db.doc('settings/platform').get();
    const settings = settingsDoc.data() || {};
    
    if (type === 'payment') {
        return {
            appId: settings.paymentGatewayApiId,
            secretKey: settings.paymentGatewayApiSecret,
            isTest: settings.paymentGatewayApiId?.includes("TEST")
        };
    } else if (type === 'payout') {
        return {
            clientId: settings.payoutClientId,
            clientSecret: settings.payoutClientSecret,
            isTest: settings.payoutClientId?.includes("TEST")
        };
    } else {
        // Verification Keys
        return {
            clientId: settings.cashfreeKycClientId,
            clientSecret: settings.cashfreeKycClientSecret,
            isTest: settings.cashfreeKycClientId?.includes("TEST")
        };
    }
}

// --- ENDPOINT: Payment Gateway Order Creation ---
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, returnUrl, collabType, relatedId, userId, description, coinsUsed, collabId } = req.body;
        const config = await getCashfreeConfig('payment');
        
        if (!config.appId) {
             // Mock response if keys aren't set
             const mockOrderId = "order_" + Date.now();
             return res.json({ 
                 paymentSessionId: "mock_session_id", 
                 environment: "sandbox", 
                 orderId: mockOrderId 
             });
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
                customer_details: {
                    customer_id: customerId,
                    customer_phone: phone
                },
                order_meta: {
                    return_url: returnUrl ? `${returnUrl}?order_id=${orderId}` : `https://google.com?order_id=${orderId}`
                },
                order_tags: {
                    collabType: collabType || "unknown",
                    relatedId: relatedId || "",
                    userId: userId || "",
                    description: description || "Payment",
                    coinsUsed: String(coinsUsed || 0),
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

// --- ENDPOINT: Verify Order & Update Status ---
app.get('/verify-order/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const config = await getCashfreeConfig('payment');
        const baseUrl = config.isTest ? "https://sandbox.cashfree.com/pg/orders" : "https://api.cashfree.com/pg/orders";

        // 1. Fetch order details from Cashfree
        const response = await fetch(`${baseUrl}/${orderId}`, {
            headers: {
                'x-client-id': config.appId,
                'x-client-secret': config.secretKey,
                'x-api-version': '2023-08-01'
            }
        });

        const data = await response.json();

        // 2. Check if order is paid
        if (data.order_status === 'PAID') {
            const tags = data.order_tags || {};
            const { collabType, relatedId, userId, description, collabId } = tags;
            const amount = data.order_amount;

            // 3. Use atomic batch write to ensure data consistency
            const transactionRef = db.collection('transactions').doc(orderId);
            const txDoc = await transactionRef.get();
            
            // Only update if transaction doesn't exist yet (prevent duplicates)
            if (!txDoc.exists) {
                const batch = db.batch();

                // A. Create Transaction Record
                batch.set(transactionRef, {
                    transactionId: orderId,
                    userId: userId,
                    amount: Number(amount),
                    type: 'payment',
                    status: 'completed',
                    description: description,
                    relatedId: relatedId,
                    collabId: collabId, 
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    paymentGatewayDetails: data
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
                        batch.update(userRef, { isBoosted: true });
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
            } else {
                console.log(`Order ${orderId} already processed.`);
            }
        }

        res.json(data);

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: error.message });
    }
});

exports.createpayment = functions.https.onRequest(app);