# Demand Management Module

This folder contains the Demand Management module scaffolding: data model, services, hooks, UI pages and components, Cloud Functions skeleton, and Firestore rules draft.

Follow the project's development rules: produce production-ready code, no demo data, and maintain module isolation.

Data model (summary)
- Collection: `Demands`
  - createdBy: { uid, name, role, officeId }
  - target: { regionId, stateId, divisionId, warehouseId }
  - items: [ { itemId, sku, name, unit, requestedQty, note } ]
  - status: "pending" | "approved" | "rejected" | "completed"
  - approvalChain: [ { level, approverUid, status, comment, timestamp } ]
  - attachments: [ { path, url } ]
  - history: [ { action, byUid, role, comment, timestamp } ]
  - createdAt, updatedAt

Read the module README and follow deploy instructions for Cloud Functions and Firestore rules.
