# Demand Management module - development notes

This commit adds scaffolding for the Demand Management module (M-09). The code includes:
- Firestore + Storage service helpers (src/services/demandService.js)
- React hooks for realtime demands (src/hooks/useDemands.js)
- Pages: DemandList, DemandCreate, DemandDetails
- Components: DemandTable, DemandFilters, DemandForm, FileUploader
- Cloud Functions skeleton (cloud-functions/demands/index.js)
- Firestore rules draft (firebase/rules.draft.rules)
- Module README (src/modules/demands/README.md)

Next steps (after review):
- Wire auth context and currentUser into pages
- Implement robust UI forms and validations (react-hook-form)
- Implement approver resolution, notifications, and activity logs
- Add indexes in Firestore for query performance
- Add unit/integration tests and QA checklist

How to deploy Cloud Functions (high level):
1. cd cloud-functions
2. npm install
3. firebase functions:config:set ... (do not store secrets in repo)
4. firebase deploy --only functions

If you want me to deploy functions to staging, please provide CI/service-account setup or deploy permissions.
