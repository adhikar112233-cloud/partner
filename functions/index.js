
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Set global options for all functions, e.g., region.
setGlobalOptions({ region: "us-central1" });


/**
 * Creates a payment order with the Cashfree API.
 * This function must be deployed to your Firebase project.
 */
exports.createOrder = onRequest({ secrets: ["CASHFREE_ID", "CASHFREE_SECRET"] }, (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ message: 'Method Not Allowed' });
    }

    // Securely verify user's identity from the token
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send({ message: 'Unauthorized: No token provided.' });
    }

    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        logger.error("Error verifying Firebase ID token:", error, error.code);
        // Provide more specific feedback for common configuration errors on the backend.
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
      logger.error("Cashfree API credentials are not set as environment secrets.");
      return res.status(500).send({ message: 'Server configuration error.' });
    }

    const orderId = `order_${Date.now()}`;
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).send({ message: 'User not found.' });
      }
      const userData = userDoc.data();
      
      // Create a pending transaction record
      await db.collection('transactions').doc(orderId).set({
          userId,
          type: 'payment',
          description: purpose,
          relatedId,
          collabId,
          collabType,
          amount: parseFloat(amount),
          status: 'pending',
          transactionId: orderId, // Use orderId as initial transactionId
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          paymentGateway: 'cashfree'
      });

      // Make phone number robust: use DB, fallback to request body (which has its own fallback)
      const customerPhone = userData.mobileNumber || phone;
      if (!customerPhone) {
        // This should be rare due to frontend fallbacks but is a good safeguard.
        throw new Error("A valid mobile number is required for payment and is missing from your profile.");
      }

      const response = await fetch("https://api.cashfree.com/pg/orders", { // Using production API for deployment
        method: "POST",
        headers: {
          "x-api-version": "2023-08-01", // Updated to a newer API version
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
            customer_id: userId,
            customer_email: userData.email,
            customer_phone: customerPhone,
            customer_name: userData.name,
          },
          order_meta: {
            // Redirect user back to app after payment
            return_url: `https://bigyapon2-cfa39.firebaseapp.com/?order_id={order_id}`,
         }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error("Cashfree API error:", data);
        await db.collection('transactions').doc(orderId).update({ status: 'failed', failure_reason: data });
        return res.status(response.status).send(data);
      }

      return res.status(200).send(data);

    } catch (error) {
      logger.error(`Error creating Cashfree order ${orderId}:`, error);
      // Update transaction to failed if it was created
      await db.collection('transactions').doc(orderId).update({ status: 'failed', failure_reason: { error: error.message } }).catch(() => {});
      return res.status(500).send({ message: error.message || 'Internal Server Error' });
    }
  });
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
    return collectionMap[collabType];
};


exports.cashfreeWebhook = onRequest({ secrets: ["CASHFREE_SECRET"] }, async (req, res) => {
    try {
        // Production: Verify the webhook signature from Cashfree
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
        
        // This structure is based on Cashfree's v2022-09-01 API webhooks
        const order = event.data.order;

        if (event.type === "PAYMENT_SUCCESS_WEBHOOK" && order.order_status === 'PAID') {
            const transactionRef = db.collection("transactions").doc(order.order_id);
            const transactionDoc = await transactionRef.get();

            if (!transactionDoc.exists) {
                logger.error(`Transaction with order_id ${order.order_id} not found.`);
                return res.status(404).send("Transaction not found");
            }

            const transactionData = transactionDoc.data();
            
            // Prevent reprocessing successful webhooks
            if (transactionData.status === 'completed') {
                logger.info(`Order ${order.order_id} already processed.`);
                return res.status(200).send("OK");
            }
            
            const batch = db.batch();

            // 1. Update transaction status
            batch.update(transactionRef, {
                status: "completed",
                paymentGatewayDetails: event.data,
            });

            // 2. Update collaboration status
            const { collabType, relatedId, userId, description } = transactionData;
            
            if (collabType === 'membership') {
                const userRef = db.collection('users').doc(userId);
                const plan = relatedId; // The plan ID, e.g., 'pro_10'
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
                
                // Update denormalized influencer profile if applicable
                const userDoc = await userRef.get();
                if(userDoc.exists() && userDoc.data().role === 'influencer') {
                    const influencerRef = db.collection('influencers').doc(userId);
                    batch.update(influencerRef, { membershipActive: true });
                }
        
            } else if (collabType.startsWith('boost_')) {
                const boostType = collabType.split('_')[1]; // 'profile', 'campaign', or 'banner'
                const targetId = relatedId;
                
                if (boostType && targetId) {
                    const days = 7; // All boosts now last for 7 days
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
                    
                    // Update the boosted entity
                    let targetCollection = null;
                    let targetDocId = targetId;
        
                    if (boostType === 'campaign') {
                        targetCollection = 'campaigns';
                    } else if (boostType === 'banner') {
                        targetCollection = 'banner_ads';
                    } else if (boostType === 'profile') {
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
            } else { // Regular collaboration payment
                const collectionName = getCollectionNameForCollab(collabType);
                if (collectionName && relatedId) {
                    const collabRef = db.collection(collectionName).doc(relatedId);
                    batch.update(collabRef, {
                        status: 'in_progress',
                        paymentStatus: 'paid'
                    });
                     // 3. Send a notification (optional)
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
                                    view: 'MY_APPLICATIONS', // A generic view, might need to be smarter
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
});

/**
 * Verifies the internal status of an order after a client-side redirect.
 * This is a crucial step to confirm payment on the frontend.
 */
exports.verifyOrder = onRequest(async (req, res) => {
    cors(req, res, async () => {
        // Securely verify user's identity from the token
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

        const orderId = req.path.split('/').pop();
        
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

            // Security check: ensure the user requesting verification is the one who owns the transaction.
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
    });
});

exports.processPayout = onRequest({ secrets: ["PAYOUT_SECRET"] }, (req, res) => {
  cors(req, res, async () => {
    // Basic validation
    if (req.method !== 'POST') {
      return res.status(405).send({ message: 'Method Not Allowed' });
    }

    // Securely verify admin identity from token
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
      // In a real scenario, you would integrate with a payout provider's API here.
      // This is a simulation of a successful payout process.
      logger.info(`Simulating payout process for request ID: ${payoutRequestId} by admin ${adminId}`);
      
      const payoutRef = db.collection('payout_requests').doc(payoutRequestId);
      const doc = await payoutRef.get();
      if (!doc.exists) {
        throw new Error("Payout request not found.");
      }
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update our database to reflect the payout is being processed
      await payoutRef.update({ status: 'processing' });
      
      logger.info(`Payout for ${payoutRequestId} marked as 'processing'.`);

      res.status(200).send({ success: true, message: 'Payout processing initiated.' });

    } catch (error) {
      logger.error("Error processing payout:", error);
      res.status(500).send({ success: false, message: error.message || 'Internal Server Error' });
    }
  });
});
