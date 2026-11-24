# Security Specification & Payload-First TDD (`CampoStats`)

## Data Invariants
1. **Strict Ownership & Verified Identity**: Every document under `/users/{userId}/...` can only be read, queried, created, updated, or deleted when `request.auth != null`, `request.auth.token.email_verified == true`, `request.auth.uid == userId`, and `data.ownerId == request.auth.uid`.
2. **PII Isolation**: Email, display name, and avatar URL live exclusively in `/users/{userId}/private/profile` and are never exposed to other authenticated users.
3. **Strict Path ID & String Bounds**: All path variables (`userId`, `profileDocId`, `settingId`, `analysisId`, `multipleId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters. All strings enforce `.size()` upper bounds matching `firebase-blueprint.json`.
4. **Bounded Arrays & Valid Enums**: `MultipleSlip.legs` must be a non-empty list with size between 1 and 20, and `legs[0]` must be a map. Enums (`theme`, `championshipScope`, `updateMode`, `dayFilter`, `status`, `source`) are strictly allowlisted.
5. **Server Timestamp Integrity & Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on update. `updatedAt` must equal `request.time` on both creation and update. `ownerId` and `id` are immutable after creation.
6. **Action-Based Updates & Zero Ghost Fields**: Every `create` enforces `hasAll` + `hasOnly`, and every `update` runs `isValid[Entity](incoming())` plus action-specific `affectedKeys().hasOnly([...])`.
7. **Admin Governance & Role Escalation Prevention**: Admin privileges are verified exclusively via verified token email (`l2xbrasil@gmail.com`) or explicit existence of `/admins/{uid}` (never custom claims like `token.role`). Regular users creating `/userAccounts/{uid}` must have `role == 'user'` and `status == 'active'`, and owners cannot self-modify `role` or `status` on update. Global `/appConfig/global` writes and `/userAccounts` directory listing are restricted to admins.

## Dirty Dozen Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Write**: Writing `/users/user123/analyses/a1` with `request.auth == null`.
2. **Unverified Email Token**: Authenticated user with `email_verified: false` attempting write to `/users/{uid}/settings/preferences`.
3. **Cross-User Read/List**: User `uidA` attempting `get` or `list` on `/users/uidB/multiples`.
4. **Identity Spoofing on Create**: User `uidA` writing `/users/uidA/analyses/a1` with `ownerId: "uidB"`.
5. **Ghost / Shadow Field Injection**: Creating `UserPreferences` with extra `isAdmin: true` or `role: "admin"` field.
6. **Oversized ID Poisoning**: Creating `/users/uidA/analyses/${"a".repeat(300)}` or ID containing slashes/spaces.
7. **Unbounded String DoS**: Creating `MultipleSlip` with `competition` string > 180 chars or `tipSignature` > 500 chars.
8. **Empty or Oversized Legs Array**: Creating `MultipleSlip` with `legs: []` or `legs` of size 25 (> 20).
9. **Client-Forged Timestamps**: Creating or updating a document with `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()`.
10. **Immutable Field Tampering**: Updating `PredictionAnalysis` while changing `ownerId`, `id`, or `createdAt`.
11. **Invalid Enum Poisoning**: Updating `MultipleSlip` with `status: "hacked"` instead of `pending | won | lost`.
12. **PII Blanket Probe**: User `uidA` attempting `get` on `/users/uidB/private/profile`.
13. **Role Self-Escalation**: Non-admin user creating or updating `/userAccounts/{uid}` with `role: "admin"` or writing to `/admins/{uid}` or `/appConfig/global`.
14. **Non-Admin User Directory Scrape**: Regular user attempting `list` on `/userAccounts`.

