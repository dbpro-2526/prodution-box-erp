// src/services/demandService.js
// Firestore + Storage helpers for Demands (JavaScript, production-ready skeleton)

import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';

const DEMANDS_COLLECTION = 'Demands';

export async function createDemand(demand, attachments = []) {
  // demand: { createdBy, target, items, note }
  const docRef = await addDoc(collection(db, DEMANDS_COLLECTION), {
    ...demand,
    status: 'pending',
    approvalChain: [],
    attachments: [],
    history: [
      {
        action: 'created',
        byUid: demand.createdBy.uid,
        role: demand.createdBy.role || null,
        comment: demand.note || null,
        timestamp: serverTimestamp(),
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const attachmentResults = [];
  for (const file of attachments) {
    const path = `demands/${docRef.id}/${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    attachmentResults.push({ path, url });
  }

  if (attachmentResults.length) {
    await updateDoc(doc(db, DEMANDS_COLLECTION, docRef.id), {
      attachments: attachmentResults,
      updatedAt: serverTimestamp(),
    });
  }

  // Optionally call a Cloud Function to notify approvers
  try {
    const fn = httpsCallable(functions, 'onDemandCreate');
    await fn({ demandId: docRef.id }).catch(() => {});
  } catch (err) {
    // fail gracefully; notifications can be handled by Firestore triggers as well
    console.warn('onDemandCreate callable failed or not configured', err);
  }

  return docRef.id;
}

export function listenDemands({ filters = {}, onUpdate, pageSize = 50 }) {
  // filters: { status, regionId, stateId, divisionId, warehouseId, createdByUid }
  let q = collection(db, DEMANDS_COLLECTION);

  const constraints = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.regionId) constraints.push(where('target.regionId', '==', filters.regionId));
  if (filters.stateId) constraints.push(where('target.stateId', '==', filters.stateId));
  if (filters.divisionId) constraints.push(where('target.divisionId', '==', filters.divisionId));
  if (filters.warehouseId) constraints.push(where('target.warehouseId', '==', filters.warehouseId));
  if (filters.createdByUid) constraints.push(where('createdBy.uid', '==', filters.createdByUid));

  // apply constraints
  if (constraints.length) {
    q = query(q, ...constraints, orderBy('createdAt', 'desc'), limit(pageSize));
  } else {
    q = query(q, orderBy('createdAt', 'desc'), limit(pageSize));
  }

  const unsub = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    onUpdate(items);
  });

  return unsub;
}

export async function getDemandById(id) {
  const d = await getDoc(doc(db, DEMANDS_COLLECTION, id));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() };
}

export async function updateDemandStatus(id, updater) {
  // updater: { status, comment, byUid, role }
  const refDoc = doc(db, DEMANDS_COLLECTION, id);
  const snapshot = await getDoc(refDoc);
  if (!snapshot.exists()) throw new Error('Demand not found');

  const data = snapshot.data();
  const newHistory = data.history || [];
  newHistory.push({ action: `status:${updater.status}`, byUid: updater.byUid, role: updater.role || null, comment: updater.comment || null, timestamp: serverTimestamp() });

  const approvalChain = data.approvalChain || [];
  approvalChain.push({ level: updater.level || null, approverUid: updater.byUid, status: updater.status, comment: updater.comment || null, timestamp: serverTimestamp() });

  await updateDoc(refDoc, {
    status: updater.status,
    history: newHistory,
    approvalChain,
    updatedAt: serverTimestamp(),
  });

  // Optionally trigger a cloud function for post-processing
  try {
    const fn = httpsCallable(functions, 'onDemandUpdate');
    await fn({ demandId: id, status: updater.status }).catch(() => {});
  } catch (err) {
    console.warn('onDemandUpdate callable failed or not configured', err);
  }
}
