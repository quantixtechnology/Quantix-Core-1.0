// Who may be removed from a business's staff, and why not.
//
// Pure predicate, no Prisma — so the rule is testable on its own and the route
// cannot drift from it. Eligibility is decided from the DATABASE role and the
// owner relationship, never from an email address: an address is not an
// identity, and hardcoding one would protect the wrong account the moment it
// changes (which Super Admin can now do from Owner Account).

export interface DeletionTarget {
  /** The target's platform authority, if any. Null for tenant users. */
  platformRole?: string | null
  /** BusinessUser.role for THIS business — carries the owner relationship. */
  businessRole?: string | null
  /** True when the target holds an owner Laundry RBAC role. */
  hasOwnerAssignment?: boolean
  /** The target's User id, to refuse self-deletion. */
  userId: string
}

export const OWNER_REFUSAL = "Business Owner cannot be deleted. Transfer ownership first."
export const PLATFORM_REFUSAL = "Platform and system accounts cannot be deleted from a business staff list."
export const SELF_REFUSAL = "You cannot delete your own account."

/**
 * Why this user may not be removed, or null when they may be.
 *
 * `isOwnerRole` is passed in rather than imported so this module stays free of
 * the RBAC module's Prisma-bearing dependency chain; the route supplies the
 * same predicate the permission resolver uses.
 */
export function staffDeletionRefusal(
  target: DeletionTarget,
  actorUserId: string,
  isBusinessOwnerRole: (role: string | null | undefined) => boolean,
): string | null {
  if (target.userId === actorUserId) return SELF_REFUSAL
  // Any platform authority — Super Admin, Platform Admin, sales, support — is a
  // platform account and is not managed from a tenant's staff list.
  if (target.platformRole) return PLATFORM_REFUSAL
  // The owner is what makes the business a business. Deleting them would leave
  // the tenant ownerless; ownership transfer is the controlled path, and is
  // deliberately not built here.
  if (isBusinessOwnerRole(target.businessRole) || target.hasOwnerAssignment) return OWNER_REFUSAL
  return null
}
