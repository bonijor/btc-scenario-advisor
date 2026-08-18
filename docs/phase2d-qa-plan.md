# Phase 2D QA plan

## Frontend

- anonymous users see only authentication controls;
- authenticated users see the private account workspace;
- email, Google and registration flows keep credential handling from Phase 2B;
- profile display name syncs to cloud and remains associated with the same UID;
- preferences sync to cloud and retain the local non-sensitive cache as fallback;
- logout hides the private workspace;
- no viewport overflow across the existing seven-project Playwright matrix.

## Data authority

- Firestore profile/preferences are scoped by UID;
- entitlement documents are browser read-only;
- plan display never grants Quant or exchange permissions;
- cloud failures degrade visibly instead of reporting a false sync.

## Performance and accessibility

Existing Lighthouse, responsive and accessibility gates remain mandatory. Firestore and cloud-profile CSS stay lazy behind Account authentication so the public dashboard critical path does not gain new local requests.
