
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");
const logger = require("firebase-functions/logger");

const app = express();
const PORT = process.env.PORT || 8080;

// IMPORTANT: When deploying to a non-Google environment (like Render),
// you MUST set the GOOGLE_APPLICATION_CREDENTIALS environment variable.
// This variable should contain the JSON content of your Firebase service account key.
// admin.initializeApp() will automatically use this variable.
admin.initializeApp();
const db = admin.firestore();

// Use CORS middleware for all routes
app.use(cors({ origin: true }));

// Middleware to parse JSON. For the webhook, we need the raw body for verification.
app.use(express.json({
    verify: (req, res, buf) => {
        // Attach raw body to request for webhook signature verification
        if (req.originalUrl.includes('/cashfreeWebhook')) {
            req.rawBody = buf;
        }
    }
}));


/**
 * Handler for creating a payment order with the Cashfree API.
 */
const createOrderHandler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Method Not Allowed' });
    }

    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send({ message: 'Unauthorized: No token provided.' });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        logger.error("Error verifying Firebase ID token:", error, error.code);
        if (error.code === 'auth/argument-error' || error.message.includes('Firebase App is not initialized')) {
            return res.status(500).send({ message: 'Server authentication service is not configured. Please check backend environment variables for Firebase credentials.' });
        }
        return res.status(403).send({ message: 'Forbidden: Your session is invalid or has expired. Please log in again.' });
    }
    const userId = decodedToken.uid;

    const { amount, purpose, relatedId, collabId, collabType, phone } = req.body;

    if (!amount || !relatedId || !collabType) {
        return res.status(400).send({ message: 'Missing required payment details.' });
    }

    const CASHFREE_ID = process.env.CASHFREE_ID;
    const CASHFREE_SECRET = process.env.CASHFREE_SECRET;

    if (!CASHFREE_ID || !CASHFREE_SECRET) {
        logger.error("Cashfree API credentials are not set as environment variables/secrets.");
        return res.status(500).send({ message: 'Server configuration error.' });
    }

    const orderId = `order_${Date.now()}`;
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).send({ message: 'User not found.' });
        }
        const userData = userDoc.data();

        await db.collection('transactions').doc(orderId).set({
            userId,
            type: 'payment',
            description: purpose,
            relatedId,
            collabId,
            collabType,
            amount: parseFloat(amount),
            status: 'pending',
            transactionId: orderId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            paymentGateway: 'cashfree'
        });

        let customerPhone = '';
        if (userData.mobileNumber && String(userData.mobileNumber).trim()) {
            customerPhone = String(userData.mobileNumber).trim();
        } else if (phone && String(phone).trim()) {
            customerPhone = String(phone).trim();
        }

        // Use a regex to validate. It must be a string of 10 to 15 digits.
        if (!/^\d{10,15}$/.test(customerPhone)) {
            logger.warn(`Using fallback phone number for user ${userId}. Received: '${customerPhone}'`);
            customerPhone = "9999999999"; 
        }
        
        const customerEmail = userData.email;
        const customerName = userData.name;

        const response = await fetch("https://api.cashfree.com/pg/orders", {
            method: "POST",
            headers: {
                "x-api-version": "2023-08-01",
                "x-client-id": CASHFREE_ID,
                "x-client-secret": CASHFREE_SECRET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                order_id: orderId,
                order_amount: amount,
                order_currency: "INR",
                order_note: purpose || 'Payment for BIGYAPON',
                customer_details: {
                    customer_id: "CUST_" + (customerPhone || "0000"),
                    customer_email: customerEmail || "noemail@test.com",
                    customer_phone: customerPhone,
                    customer_name: customerName || "Unknown",
                },
                order_meta: {
                    return_url: `https://bigyapon2-cfa39.firebaseapp.com/?order_id={order_id}`,
                }
            }),
        });
        
        if (!response.ok) {
            let errorData = { message: "Unknown payment gateway error." };
            try {
                errorData = await response.json();
            } catch (e) {
                logger.error("Could not parse JSON from Cashfree error response", e);
                errorData.message = `Gateway returned a non-JSON response (status: ${response.status}).`;
            }
            
            const finalErrorMessage = errorData.message || JSON.stringify(errorData);
            logger.error("Cashfree API error:", finalErrorMessage);
            await db.collection('transactions').doc(orderId).update({ status: 'failed', failure_reason: errorData });
            return res.status(500).send({ message: `Payment gateway error: ${finalErrorMessage}` });
        }

        const data = await response.json();
        return res.status(200).send(data);

    } catch (error) {
        logger.error(`Error creating Cashfree order ${orderId}:`, error);
        await db.collection('transactions').doc(orderId).update({ status: 'failed', failure_reason: { error: error.message } }).catch(() => {});
        return res.status(500).send({ message: error.message || 'Internal Server Error' });
    }
};

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
    return collectionMap[collabType];
};


const cashfreeWebhookHandler = async (req, res) => {
    try {
        const signature = req.headers["x-webhook-signature"];
        const timestamp = req.headers["x-webhook-timestamp"];
        const rawBody = req.rawBody;

        if (!signature || !timestamp || !rawBody) {
            logger.error("Webhook verification failed: Missing headers or body.");
            return res.status(400).send("Invalid webhook request.");
        }

        const secret = process.env.CASHFREE_SECRET;
        if (!secret) {
            logger.error("CASHFREE_SECRET is not configured for webhook verification.");
            return res.status(500).send("Server configuration error.");
        }

        const payload = timestamp + rawBody.toString('utf8');
        const generatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64');

        if (generatedSignature !== signature) {
            logger.error("Webhook verification failed: Signature mismatch.");
            return res.status(401).send("Unauthorized webhook.");
        }
        
        logger.info("Cashfree webhook signature verified successfully.");
        logger.info("Cashfree webhook received:", req.body);
        const event = req.body;
        
        const order = event.data.order;

        if (event.type === "PAYMENT_SUCCESS_WEBHOOK" && order.order_status === 'PAID') {
            const transactionRef = db.collection("transactions").doc(order.order_id);
            const transactionDoc = await transactionRef.get();

            if (!transactionDoc.exists) {
                logger.error(`Transaction with order_id ${order.order_id} not found.`);
                return res.status(404).send("Transaction not found");
            }

            const transactionData = transactionDoc.data();
            
            if (transactionData.status === 'completed') {
                logger.info(`Order ${order.order_id} already processed.`);
                return res.status(200).send("OK");
            }
            
            const batch = db.batch();

            batch.update(transactionRef, {
                status: "completed",
                paymentGatewayDetails: event.data,
            });

            const { collabType, relatedId, userId } = transactionData;
            
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
                }
        
                const updateData = {
                    'membership.plan': plan,
                    'membership.isActive': true,
                    'membership.startsAt': now,
                    'membership.expiresAt': admin.firestore.Timestamp.fromDate(expiryDate),
                    'membership.usage': { directCollaborations: 0, campaigns: 0, liveTvBookings: 0, bannerAdBookings: 0 }
                };
                batch.update(userRef, updateData);
                
                const userDoc = await userRef.get();
                if(userDoc.exists() && userDoc.data().role === 'influencer') {
                    const influencerRef = db.collection('influencers').doc(userId);
                    batch.update(influencerRef, { membershipActive: true });
                }
        
            } else if (collabType.startsWith('boost_')) {
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
                    let targetDocId = targetId;
        
                    if (boostType === 'campaign') targetCollection = 'campaigns';
                    else if (boostType === 'banner') targetCollection = 'banner_ads';
                    else if (boostType === 'profile') {
                        const userDoc = await db.collection('users').doc(userId).get();
                        if(userDoc.exists()) {
                            const userRole = userDoc.data().role;
                            if (userRole === 'influencer') targetCollection = 'influencers';
                            if (userRole === 'livetv') targetCollection = 'livetv_channels';
                        }
                    }
                    
                    if (targetCollection) {
                        batch.update(db.collection(targetCollection).doc(targetDocId), { isBoosted: true });
                    }
                }
            } else {
                const collectionName = getCollectionNameForCollab(collabType);
                if (collectionName && relatedId) {
                    const collabRef = db.collection(collectionName).doc(relatedId);
                    batch.update(collabRef, {
                        status: 'in_progress',
                        paymentStatus: 'paid'
                    });

                    try {
                        const collabDoc = await collabRef.get();
                        if (collabDoc.exists()) {
                            const collabData = collabDoc.data();
                            const creatorId = collabData.influencerId || collabData.liveTvId || collabData.agencyId;
                            const brandName = collabData.brandName;
        
                            if (creatorId) {
                                await db.collection('notifications').add({
                                    userId: creatorId,
                                    title: "Payment Confirmed!",
                                    body: `${brandName} has completed the payment for your collaboration. You can now begin work.`,
                                    type: 'collab_update',
                                    relatedId: relatedId,
                                    view: 'MY_APPLICATIONS',
                                    isRead: false,
                                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            }
                        }
                    } catch (notifError) {
                        logger.error(`Failed to send notification for order ${order.order_id}`, notifError);
                    }
                }
            }

            await batch.commit();
            logger.info(`Successfully processed order ${order.order_id}`);
        } else if (event.type === "PAYMENT_FAILED_WEBHOOK" || order.order_status === 'FAILED') {
             const transactionRef = db.collection("transactions").doc(order.order_id);
             await transactionRef.update({
                 status: 'failed',
                 paymentGatewayDetails: event.data,
             });
             logger.warn(`Failed payment for order ${order.order_id}`);
        }

        res.status(200).send("OK");

    } catch (error) {
        logger.error("Error processing Cashfree webhook:", error);
        res.status(500).send("Internal Server Error");
    }
};

const verifyOrderHandler = async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send({ message: 'Unauthorized: No token provided.' });
    }
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        logger.error("Error verifying Firebase ID token:", error);
        return res.status(403).send({ message: 'Forbidden: Invalid token.' });
    }
    const userId = decodedToken.uid;

    const { orderId } = req.params;
    
    if (!orderId) {
        return res.status(400).send({ message: 'Order ID is required.' });
    }

    try {
        const transactionRef = db.collection("transactions").doc(orderId);
        const transactionDoc = await transactionRef.get();

        if (!transactionDoc.exists) {
            return res.status(404).send({ message: 'Order not found in our system.' });
        }
        
        const transactionData = transactionDoc.data();

        if (transactionData.userId !== userId) {
            logger.warn(`User ${userId} attempted to verify order ${orderId} belonging to ${transactionData.userId}`);
            return res.status(403).send({ message: 'Forbidden: You are not authorized to view this order.' });
        }

        const { status, amount, description } = transactionData;
        return res.status(200).send({
            order_id: orderId,
            order_status: status === 'completed' ? 'PAID' : 'PENDING/FAILED',
            order_amount: amount,
            order_note: description
        });

    } catch (error) {
        logger.error("Error verifying order:", error);
        return res.status(500).send({ message: 'Internal Server Error' });
    }
};

const processPayoutHandler = async (req, res) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send({ message: 'Unauthorized.' });
    }
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        logger.error("Error verifying token for payout:", error);
        return res.status(403).send({ message: 'Forbidden: Invalid token.' });
    }
    
    const adminId = decodedToken.uid;
    const adminUserDoc = await db.collection('users').doc(adminId).get();
    if (!adminUserDoc.exists() || adminUserDoc.data().role !== 'staff') {
        logger.warn(`Non-staff user ${adminId} attempted to process payout.`);
        return res.status(403).send({ message: 'Forbidden: Only staff can process payouts.' });
    }

    const { payoutRequestId } = req.body;
    if (!payoutRequestId) {
        return res.status(400).send({ message: 'Missing payoutRequestId.' });
    }
    
    try {
        logger.info(`Simulating payout process for request ID: ${payoutRequestId} by admin ${adminId}`);
        const payoutRef = db.collection('payout_requests').doc(payoutRequestId);
        const doc = await payoutRef.get();
        if (!doc.exists) {
            throw new Error("Payout request not found.");
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await payoutRef.update({ status: 'processing' });
        logger.info(`Payout for ${payoutRequestId} marked as 'processing'.`);

        res.status(200).send({ success: true, message: 'Payout processing initiated.' });

    } catch (error) {
        logger.error("Error processing payout:", error);
        res.status(500).send({ success: false, message: error.message || 'Internal Server Error' });
    }
};

// Define routes
app.post('/create-order', createOrderHandler);
app.get('/verify-order/:orderId', verifyOrderHandler);
app.post('/cashfreeWebhook', cashfreeWebhookHandler);
app.post('/process-payout', processPayoutHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

// Export the app for serverless environments
exports.api = app;
