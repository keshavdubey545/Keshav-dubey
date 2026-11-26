# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` (profile, cases, report versions, drafts) belongs exclusively to `userId` and must carry `ownerId == request.auth.uid`.
2. **Email Verification**: Write operations require `request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Single-document operations validate `isValidId()` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) on `{userId}`, `{caseId}`, `{versionId}`, and `{draftId}`.
4. **Master Gate Sync**: Report versions at `/users/{userId}/cases/{caseId}/versions/{versionId}` verify the parent case exists (`exists` or `existsAfter` for atomic batches) and belongs to `request.auth.uid`, and `caseId` matches the path `{caseId}`.
5. **Immutable Audit Versions & Temporal Integrity**: Report versions are immutable after creation (`allow update: if false`). All `createdAt` fields enforce `request.time` on creation and immutability on update; `updatedAt` enforces `request.time` on create and update.
6. **Bounded Arrays & String Lengths**: Every string enforces `.size()` bounds matching `firebase-blueprint.json`; `completedMitigationIds` is capped at `<= 50` entries.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading `/users/u1/cases/c1`.
2. **Cross-user access**: Authenticated `u2` attempting `get` or `list` on `/users/u1/cases`.
3. **Identity spoofing on create**: Authenticated `u1` creating `/users/u1/cases/c1` with `ownerId: "u2"`.
4. **Unverified email write**: Authenticated `u1` with `email_verified: false` attempting `create` or `update`.
5. **Shadow / ghost field injection**: Creating `EthicsCase` with an undeclared field `isAdmin: true` or `shadowRole: "super"`.
6. **ID poisoning**: Creating `/users/u1/cases/bad$id..with..slashes` violating `^[a-zA-Z0-9_-]+$`.
7. **Denial-of-wallet oversized string**: Creating `EthicsCase` with `title` > 500 chars or `description` > 10000 chars.
8. **Client-forged timestamp**: Creating `EthicsCase` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
9. **Immutable field tampering**: Updating `EthicsCase` to alter `createdAt` or `ownerId`.
10. **Orphaned report version**: Creating `/users/u1/cases/nonexistent/versions/v1` without a valid parent case.
11. **Mutating immutable report version**: Updating an existing `/users/u1/cases/c1/versions/v1` report document.
12. **Unbounded array injection**: Updating `completedMitigationIds` with > 50 items or non-string element `[123]`.
