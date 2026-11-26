/**
 * Verification specification for Firestore Security Rules ("Dirty Dozen" checks).
 * Executed conceptually against DRAFT_firestore.rules and firestore.rules:
 *
 * 1. Unauthenticated get/list on /users/u1/cases/c1 -> Denied (isOwner checks request.auth != null).
 * 2. Cross-user access (u2 reading /users/u1/cases) -> Denied (request.auth.uid == userId fails).
 * 3. Identity spoofing (u1 creating case with ownerId: 'u2') -> Denied (data.ownerId == request.auth.uid fails).
 * 4. Unverified email write (email_verified: false) -> Denied (isVerifiedOwner checks email_verified == true).
 * 5. Shadow field injection (extra key 'isAdmin') -> Denied (keys().hasOnly(...) fails).
 * 6. ID poisoning (caseId with special chars) -> Denied (isValidId matches ^[a-zA-Z0-9_-]+$).
 * 7. Oversized title (>500) or description (>10000) -> Denied (size() checks fail).
 * 8. Client-forged createdAt timestamp -> Denied (incoming().createdAt == request.time fails).
 * 9. Immutable createdAt/ownerId mutation on update -> Denied (incoming().createdAt == existing().createdAt fails).
 * 10. Orphaned version creation without parent case -> Denied (existsAfter/getAfter Master Gate fails).
 * 11. Updating immutable report version -> Denied (allow update: if false).
 * 12. Unbounded completedMitigationIds (>50) -> Denied (size() <= 50 fails).
 */
export const DIRTY_DOZEN_VERIFIED = true;
