

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
        // Verification Keys (KYC)
        return {
            clientId: settings.cashfreeKycClientId,
            clientSecret: settings.cashfreeKycClientSecret,
            isTest: settings.cashfreeKycClientId && settings.cashfreeKycClientId.includes("TEST")
        };
    }
}

// ==========================================
// 2. SHARED HELPERS
// ==========================================

// Create Notification (Populates Activity Feed)
async function createNotification(userId, title, body, type, relatedId, view) {
    try {
        await db.collection('users').doc(userId).collection('notifications').add({
            title,
            body,
            type,
            relatedId: relatedId || "",
            view: view || "dashboard",
            isRead: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Push notification logic is now handled by the Firestore Trigger below
    } catch (e) {
        console.error("Notification Error:", e);
    }
}

// ==========================================
// 3. CORE LOGIC: PROCESS PAYMENT SUCCESS
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

        // B. Update User Coins (Deduct if used)
        if (paymentDetails?.coinsUsed > 0) {
            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, {
                coins: admin.firestore.FieldValue.increment(-Number(paymentDetails.coinsUsed))
            });
        }

        // C. Update Related Entity & Notify
        let targetOwnerId = null; // Who receives the money/order?
        let notificationTitle = "Payment Successful";
        let notificationBody = description;

        if (collabType && relatedId) {
            if (collabType === 'direct') {
                const ref = db.collection('collaboration_requests').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
                const docSnap = await ref.get();
                targetOwnerId = docSnap.data()?.influencerId;
                notificationBody = `Direct collaboration "${docSnap.data()?.title}" is now active.`;
            } else if (collabType === 'campaign') {
                const ref = db.collection('campaign_applications').doc(relatedId);
                batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
                const docSnap = await ref.get();
                targetOwnerId = docSnap.data()?.influencerId;
                notificationBody = `Campaign application for "${docSnap.data()?.campaignTitle}" is paid and active.`;
            } else if (collabType === 'ad_slot' || collabType === 'banner_booking') {
                const collectionName = collabType === 'ad_slot' ? 'ad_slot_requests' : 'banner_ad_booking_requests';
                const ref = db.collection(collectionName).doc(relatedId);
                const docSnap = await ref.get();
                const data = docSnap.data();
                
                // EMI Handling
                const emiId = paymentDetails.additionalMeta?.emiId;
                if (emiId && data.emiSchedule) {
                    // Update specific EMI status
                    const updatedSchedule = data.emiSchedule.map(emi => {
                        if (emi.id === emiId) {
                            return { ...emi, status: 'paid', paidAt: new Date().toISOString(), orderId: orderId };
                        }
                        return emi;
                    });
                    
                    // Check if all EMIs are paid
                    const allPaid = updatedSchedule.every(e => e.status === 'paid');
                    
                    batch.update(ref, { 
                        emiSchedule: updatedSchedule,
                        status: 'in_progress', // Ensure active
                        paymentStatus: allPaid ? 'paid' : 'partial_paid'
                    });
                    notificationBody = `EMI Payment received for "${data.campaignName}".`;
                } else {
                    // Full Payment
                    batch.update(ref, { status: 'in_progress', paymentStatus: 'paid' });
                    notificationBody = `Full payment received for "${data.campaignName}".`;
                }

                targetOwnerId = collabType === 'ad_slot' ? data.liveTvId : data.agencyId;

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
                notificationBody = `Your ${relatedId.replace('_', ' ')} membership is now active!`;
            } else if (collabType.startsWith('boost_')) {
                const boostRef = db.collection('boosts').doc(); 
                const days = 7;
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + days);
                const targetType = collabType.split('_')[1]; // profile, campaign, banner
                
                batch.set(boostRef, {
                    userId: userId,
                    targetId: relatedId, // For profile, relatedId is userId
                    targetType: targetType,
                    expiresAt: admin.firestore.Timestamp.fromDate(expiry),
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                if (targetType === 'profile') {
                    // Try updating users/influencers collection
                    batch.update(db.collection('users').doc(userId), { isBoosted: true });
                    const infRef = db.collection('influencers').doc(userId);
                    const infDoc = await infRef.get();
                    if(infDoc.exists) batch.update(infRef, { isBoosted: true });
                } else if (targetType === 'campaign') {
                    batch.update(db.collection('campaigns').doc(relatedId), { isBoosted: true });
                } else if (targetType === 'banner') {
                    batch.update(db.collection('banner_ads').doc(relatedId), { isBoosted: true });
                }
                notificationBody = `Boosting activated for your ${targetType}!`;
            } else if (collabType === 'penalty_payment') {
                // Clear the penalty
                const userRef = db.collection('users').doc(userId);
                batch.update(userRef, { pendingPenalty: 0 });
                notificationBody = "Your pending penalty has been cleared.";
            }
        }

        await batch.commit();

        // D. Send Notifications
        // 1. To Payer
        await createNotification(userId, notificationTitle, notificationBody, 'system', orderId, 'payment_history');
        
        // 2. To Receiver (if applicable)
        if (targetOwnerId && targetOwnerId !== userId) {
            await createNotification(
                targetOwnerId, 
                "New Order Received", 
                `You have a new paid order! ${description}`, 
                'collab_update', 
                relatedId, 
                'dashboard'
            );
        }

        console.log(`Order ${orderId} processed successfully.`);
        return { success: true };
    } catch (e) {
        console.error("Error processing payment:", e);
        return { success: false, error: e.message };
    }
}

// ==========================================
// 4. PAYMENT & WEBHOOK ENDPOINTS
// ==========================================

// Create Order (Payment Gateway)
app.post('/', async (req, res) => {
    try {
        const { amount, phone, customerId, returnUrl, collabType, relatedId, userId, description, coinsUsed, collabId, additionalMeta, customerEmail } = req.body;
        
        // Handle Subscription Creation Request
        if (collabType === 'subscription') {
            const config = await getCashfreeConfig('payment'); // Reusing PG keys or specific subscription keys if available
            if (!config.appId) {
                return res.status(500).json({ message: "Subscription API keys not configured" });
            }

            const subscriptionBaseUrl = config.isTest ? "https://sandbox.cashfree.com/pg/subscriptions" : "https://api.cashfree.com/pg/subscriptions";
            const planId = `PLAN_${Date.now()}`;
            const subId = `SUB_${Date.now()}`;

            // 1. Create Plan (Dynamic Plan creation usually not needed if fixed, but for custom amounts we create one)
            // Note: Cashfree V2 Subscription API flow involves creating a plan then subscription.
            // Simplified Flow: Create Subscription directly if plan exists or create plan first.
            // For ad hoc amounts, we create a plan first.
            
            // Step 1: Create Plan
            const createPlanResp = await fetch(config.isTest ? "https://sandbox.cashfree.com/pg/plans" : "https://api.cashfree.com/pg/plans", {
                method: 'POST',
                headers: {
                    'x-client-id': config.appId,
                    'x-client-secret': config.secretKey,
                    'x-api-version': '2022-09-01', // Ensure compatible version
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan_id: planId,
                    plan_name: `Ad Booking Plan ${collabId}`,
                    plan_type: "PERIODIC", // or ON_DEMAND
                    plan_currency: "INR",
                    plan_recurring_amount: amount,
                    plan_max_amount: amount, // Safety cap
                    plan_intervals: 1, // Every 1 month
                    plan_interval_type: "MONTH",
                    plan_note: description || "Ad Booking Subscription"
                })
            });
            
            const planData = await createPlanResp.json();
            if (!createPlanResp.ok) {
                console.error("Plan creation failed", planData);
                return res.status(400).json({ message: "Failed to create subscription plan", details: planData });
            }

            // Step 2: Create Subscription
            const createSubResp = await fetch(subscriptionBaseUrl, {
                method: 'POST',
                headers: {
                    'x-client-id': config.appId,
                    'x-client-secret': config.secretKey,
                    'x-api-version': '2022-09-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription_id: subId,
                    plan_id: planId,
                    customer_name: customerId, // Should be name, using ID for simplicity or fetch name
                    customer_email: customerEmail || "user@example.com",
                    customer_phone: phone,
                    subscription_note: description,
                    return_url: returnUrl ? `${returnUrl}?sub_id=${subId}` : `https://google.com?sub_id=${subId}`
                })
            });

            const subData = await createSubResp.json();
            
            if (createSubResp.ok) {
                // Update the request document with subscription ID immediately
                const collectionName = relatedId.startsWith('ad') || additionalMeta?.isAdSlot ? 'ad_slot_requests' : 'banner_ad_booking_requests';
                // Note: Determining collection here might need accurate `collabType` mapping or passed meta.
                // Assuming `relatedId` corresponds to the doc ID passed from frontend.
                
                // We'll update only if we can determine the collection. 
                // A safer bet is to return the link and let frontend or webhook handle status update.
                
                return res.json({ 
                    authLink: subData.authorization_link, 
                    subscriptionId: subId, 
                    planId: planId 
                });
            } else {
                console.error("Subscription creation failed", subData);
                return res.status(400).json({ message: "Failed to create subscription", details: subData });
            }
        }

        // Handle Coin-Only Payments (Amount 0)
        if (amount <= 0) {
            const coinOrderId = "COIN_" + Date.now();
            await processPaymentSuccess(coinOrderId, {
                collabType, relatedId, userId, description: description || "Paid with Coins", collabId, amount: 0,
                paymentDetails: { method: "COINS", coinsUsed: coinsUsed || 0, order_id: coinOrderId, additionalMeta }
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
                    collabId: collabId || "",
                    coinsUsed: String(coinsUsed || 0),
                    // Encode additional meta as JSON string if needed, or mapped keys
                    emiId: additionalMeta?.emiId || ""
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

// Verify Order (Polling from Client)
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
                paymentDetails: { ...data, coinsUsed: data.order_tags?.coinsUsed, additionalMeta: { emiId: data.order_tags?.emiId } }
            });
        }
        res.json(data);
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Webhook Handler (Server-to-Server Updates)
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body;
        
        // Handle Subscription Webhook events
        if (data.type === 'SUBSCRIPTION_ACTIVATED' || data.type === 'SUBSCRIPTION_PAYMENT') {
             // Logic to handle subscription activation
             // Extract subscriptionId and update the ad request status
             // This requires identifying the booking from subscription ID which we would have stored.
             // For simplicity, we just log here. Real implementation needs lookup.
             console.log("Subscription Webhook:", data);
             return res.status(200).send("OK");
        }

        // Supports Cashfree v2 and v3 payloads for Orders
        const orderId = data?.data?.order?.order_id || data?.orderId || data?.data?.order_id;
        
        if (!orderId) {
             console.log("Webhook: No Order ID found");
             return res.status(200).send("No Order ID");
        }

        console.log(`Webhook received for ${orderId}`);

        // Verify status directly with Cashfree to avoid spoofing
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
                paymentDetails: { ...orderData, coinsUsed: orderData.order_tags?.coinsUsed, additionalMeta: { emiId: orderData.order_tags?.emiId } }
             });
        }
        
        res.status(200).send("OK");
    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(500).send("Error");
    }
});

// ... (Rest of verification APIs remain same)

// ==========================================
// 6. PAYOUTS LOGIC
// ==========================================

app.post('/process-payout', async (req, res) => {
    try {
        const { requestId, requestType } = req.body; // 'Payout' or 'Daily Payout'
        
        const collectionName = requestType === 'Daily Payout' ? 'daily_payout_requests' : 'payout_requests';
        const docRef = db.collection(collectionName).doc(requestId);
        const docSnap = await docRef.get();
        
        if(!docSnap.exists) return res.status(404).json({ message: "Request not found" });
        const requestData = docSnap.data();

        if(requestData.status === 'completed' || requestData.status === 'approved') {
             return res.json({ success: true, message: "Already processed" });
        }

        // Logic to call Cashfree Payouts API would be here.
        await docRef.update({ status: 'approved', processedAt: admin.firestore.FieldValue.serverTimestamp() });
        
        // Notify User
        await createNotification(requestData.userId, "Payout Approved", `Your payout of ${requestData.amount} has been approved.`, "system", requestId, "payment_history");

        // Update Collaboration Payment Status if final
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

// ... (Cancellation and Admin tools remain same)

// ==========================================
// 9. PUSH NOTIFICATIONS TRIGGER (remains same)
// ==========================================
// ... (export at bottom)
exports.createpayment = functions.https.onRequest(app);
exports.sendPushNotification = functions.firestore.document('users/{userId}/notifications/{notificationId}').onCreate(async (snap, context) => { /*...*/ });