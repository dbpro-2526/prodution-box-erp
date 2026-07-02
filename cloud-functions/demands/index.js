// cloud-functions/demands/index.js
// Firebase Cloud Functions (Node.js) skeleton for Demand triggers and callable functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized by your functions index
try { admin.initializeApp(); } catch (e) { /* already initialized */ }

const db = admin.firestore();

exports.onDemandCreate = functions.https.onCall(async (data, context) => {
  // Optional callable: runs after demand creation to notify approvers.
  // Implement authorization checks and notification logic.
  const { demandId } = data;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Request had no auth');

  // Load demand and create notification documents for approvers based on demand target
  // TODO: implement approver resolution and create Notifications collection entries
  return { success: true };
});

exports.onDemandUpdate = functions.https.onCall(async (data, context) => {
  const { demandId, status } = data;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Request had no auth');

  // Post-processing for status change (e.g., notify requester)
  return { success: true };
});

// Firestore trigger example for Demands collection
exports.handleDemandCreated = functions.firestore.document('Demands/{demandId}').onCreate(async (snap, context) => {
  const demand = snap.data();
  const demandId = context.params.demandId;
  // TODO: resolve approvers & create notification documents
  return null;
});
