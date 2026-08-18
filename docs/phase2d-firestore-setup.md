# Phase 2D · Firestore infrastructure checklist

This checklist is intentionally separate from frontend publication.

## Required production checks

- Firebase project: `linear-poet-426418-k0`.
- Confirm whether Cloud Firestore database `(default)` already exists.
- If it does not exist, choose the database location explicitly before creation. Database location is an infrastructure decision and must not be guessed by the frontend.
- Deploy `firestore.rules` and `firestore.indexes.json` only after the database exists.
- Verify an authenticated user can read/write only `users/{uid}` and `users/{uid}/settings/preferences`.
- Verify a different authenticated UID and an unauthenticated client are denied.
- Verify browser writes to `entitlements/{uid}` are denied.

## Publication policy

The frontend may be merged only after the infrastructure gate reports PASS. Until then the branch/PR remains a candidate and production continues to use Phase 2C behavior.
