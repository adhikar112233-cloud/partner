const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

const getExpiryDate = (planId) => {
    const now = new Date();
    if (['basic'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 1));
    if (['pro'].includes(planId)) return new Date(now.setMonth(now.getMonth() + 6));
    return new Date(now.setFullYear(now.getFullYear() + 1));
};

app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, collabType, relatedId, collabId, userId, description, coinsUsed, returnUrl } = req.body;
        
        const settingsDoc = await db.doc('settings/platform').get();
        const settings = settingsDoc.data() || {};
        const appId = settings.paymentGatewayApiId;
        const secretKey = settings.paymentGatewayApiSecret;
        
        if (!appId || !secretKey) {
            return res.status(500).json({ message: "Payment Gateway not configured in Admin Settings." });
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
             return res.json({ success: true, orderId: orderId, paymentSessionId: "COIN-ONLY", message: "Paid with coins" });
        }

        const fetch = require("node-fetch"); 
        
        // Use provided returnUrl or fallback to a default
        // Appending ?order_id=... allows the frontend to verify payment on load
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
            console.error("Cashfree Error:", data);
            res.status(400).json({ message: data.message || "Cashfree Error" });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/verify-order/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderRef = db.collection('pending_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) return res.status(404).json({ message: "Order not found." });

        const orderData = orderDoc.data();
        let status = orderData.status;

        if (status === 'COMPLETED') {
             return res.json({ order_status: 'PAID' });
        }

        if (orderData.amount === 0) {
            status = 'PAID';
        } else {
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
                    status = data.order_status;
                }
            }
        }

        if (status === 'PAID' && orderData.status !== 'COMPLETED') {
            const batch = db.batch();
            const { userId, collabType, relatedId, description } = orderData;

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
                expiresAt.setDate(expiresAt.getDate() + 7);
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
            else if (collabType === 'direct' || collabType === 'campaign' || collabType === 'ad_slot' || collabType === 'banner_booking') {
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