// Business Owner account — the rules for editing an owner's identity and
// credentials, in one place.
//
// There is exactly ONE owner account per business: the User linked by the
// CLIENT_OWNER BusinessUser row. Every path here UPDATES that user. Changing a
// name, phone, email or password must never mint a second User, because the
// business, its RBAC, its orders, customers and stores all hang off that one
// link — a duplicate would silently orphan the tenant from its owner.
//
// This module is pure: no Prisma, no hashing, no request handling. It decides
// what is valid and what should change; the route does the writing with the
// existing db + password-utils.

/** Same floor the existing admin reset-password routes enforce. */
export const MIN_PASSWORD_LENGTH = 6

export interface OwnerAccountInput {
  name?: string | null
  phone?: string | null
  /** Owner Email / Login ID. */
  email?: string | null
  password?: string | null
  confirmPassword?: string | null
}

/**
 * Login looks the identifier up lowercased (loginId first, then email — see
 * /api/core/auth/login), so an owner email must be stored lowercased and
 * trimmed or the exact-match lookups miss it and only the raw-SQL LOWER()
 * fallback saves the login.
 */
export const normaliseEmail = (v: string): string => v.toLowerCase().trim()

// Deliberately the same shape the rest of the platform accepts. This is not a
// new validation system — it is the one rule applied to one more field.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (v: string): boolean => EMAIL_RE.test(normaliseEmail(v))

/**
 * What is wrong with this edit, or null. Absent fields are "not being changed"
 * and are never validated — a Super Admin fixing a typo in the phone number is
 * not asked for a password.
 */
export function validateOwnerAccount(input: OwnerAccountInput): string | null {
  if (input.name !== undefined && input.name !== null && !String(input.name).trim()) {
    return 'Owner name cannot be empty.'
  }
  if (input.email !== undefined && input.email !== null) {
    const email = String(input.email)
    if (!email.trim()) return 'Owner email / login ID cannot be empty.'
    if (!isValidEmail(email)) return 'Enter a valid owner email / login ID.'
  }
  const wantsPassword = !!(input.password && String(input.password).length > 0)
  const wantsConfirm = !!(input.confirmPassword && String(input.confirmPassword).length > 0)
  if (wantsPassword || wantsConfirm) {
    const password = String(input.password ?? '')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    // Confirmation is required whenever a password is being set — a mistyped
    // password locks the owner out of their own business.
    if (String(input.confirmPassword ?? '') !== password) return 'Passwords do not match.'
  }
  return null
}

/** True when this edit sets a new password. */
export const changesPassword = (input: OwnerAccountInput): boolean =>
  !!(input.password && String(input.password).length > 0)

/**
 * Whether the owner's existing sessions must be dropped.
 *
 * A credential change that leaves old sessions alive is not a credential
 * change. Renaming the owner or fixing their phone number is not a credential
 * change and must not sign them out.
 */
export function requiresSessionInvalidation(input: OwnerAccountInput, currentEmail: string): boolean {
  if (changesPassword(input)) return true
  if (input.email == null) return false
  return normaliseEmail(String(input.email)) !== normaliseEmail(currentEmail)
}

export interface OwnerFieldChanges {
  name?: string
  phone?: string | null
  email?: string
}

/**
 * The identity fields to write — only those actually provided, and only when
 * they differ, so an unchanged submit is a no-op rather than a pointless write.
 * The password is deliberately NOT here: it must be hashed by the caller and
 * must never travel alongside plain fields.
 */
export function ownerFieldChanges(
  input: OwnerAccountInput,
  current: { name: string; phone: string | null; email: string },
): OwnerFieldChanges {
  const changes: OwnerFieldChanges = {}
  if (input.name != null && String(input.name).trim() && String(input.name).trim() !== current.name) {
    changes.name = String(input.name).trim()
  }
  if (input.phone !== undefined) {
    const phone = input.phone == null ? null : String(input.phone).trim() || null
    if (phone !== current.phone) changes.phone = phone
  }
  if (input.email != null) {
    const email = normaliseEmail(String(input.email))
    if (email && email !== normaliseEmail(current.email)) changes.email = email
  }
  return changes
}

/**
 * Should loginId follow the new email?
 *
 * Login resolves loginId BEFORE email. Businesses created through
 * createBusiness() get loginId = the owner's email, so changing only the email
 * would leave the OLD address still working as a login handle — the Super Admin
 * would believe they had retired it. When loginId mirrors the old email it moves
 * with it. When it is a distinct handle (provisioning mints
 * "<slug>-owner-<id>"), it is left alone: that handle is not the email and
 * retiring it would break a working login.
 */
export function loginIdFollowsEmail(currentLoginId: string | null, currentEmail: string): boolean {
  if (!currentLoginId) return false
  return normaliseEmail(currentLoginId) === normaliseEmail(currentEmail)
}

/** Nothing to do — used to answer honestly instead of claiming a save. */
export const isNoOp = (changes: OwnerFieldChanges, setsPassword: boolean): boolean =>
  !setsPassword && Object.keys(changes).length === 0

/**
 * A Super Admin who types a password has chosen it deliberately and will hand
 * it to the owner, so it is NOT a temporary credential to be rotated on first
 * login. An auto-generated one still is — which is why the existing
 * "Reset Password" button is untouched and keeps forcing a change.
 */
export const mustChangePasswordFor = (source: 'ADMIN_SET' | 'GENERATED'): boolean => source === 'GENERATED'

// ── Owner provisioning: reuse or create ──────────────────────────────────────
//
// The platform models one person across many businesses:
//
//     User (email globally unique) → BusinessUser @@unique([userId, businessId]) → Business
//
// so an owner email that already has an account is NOT a conflict. Provisioning
// used to throw "already belongs to another user" for any existing account,
// which made a real address permanently unusable by every future tenant.
//
// Kept as a pure decision, separate from the writes, so the rule can be tested
// for what it decides rather than for how it is spelled.

/** The subset of a User row the decision needs. */
export interface ExistingOwnerUser {
  id: string
  passwordHash: string | null
  isActive: boolean
}

export type OwnerAccountPlan =
  | { action: 'CREATE_USER' }
  | {
      action: 'REUSE_USER'
      userId: string
      /**
       * Whether the password chosen during provisioning should be written.
       *
       * Only ever true for an account that has none. Credentials belong to the
       * person, not to this business: a Super Admin provisioning workspace B
       * must not be able to overwrite the password that signs someone into
       * workspace A. An account with no password at all cannot sign in as an
       * owner, so filling that gap is the one safe write.
       */
      setPassword: boolean
      /** Their existing password stands — the one entered here was not applied. */
      passwordUnchanged: boolean
      /** Disabled platform-wide: linked as owner, but cannot sign in yet. */
      inactive: boolean
    }

export function planOwnerAccount(existing: ExistingOwnerUser | null | undefined): OwnerAccountPlan {
  if (!existing) return { action: 'CREATE_USER' }
  const setPassword = !existing.passwordHash
  return {
    action: 'REUSE_USER',
    userId: existing.id,
    setPassword,
    passwordUnchanged: !setPassword,
    inactive: !existing.isActive,
  }
}
