# Phase 2D security boundaries

- Firebase web configuration is public client configuration.
- No service-account credential, OAuth client secret or exchange credential belongs in this repository.
- Cloud Firestore rules are the client data authorization boundary for profile/preferences.
- Server SDKs bypass Firestore Security Rules, so any future backend that writes entitlements must use narrowly scoped IAM and verify Firebase identity server-side.
- The browser may display an entitlement but may not use it as authority for Quant execution or exchange access.
- Quant runtime, trial evidence and exchange gateways remain outside the user-data write path.
