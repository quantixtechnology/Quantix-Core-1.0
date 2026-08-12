// Super Admin owner-account control.
//
// The rules are tested against the shipped module; the guarantees that are
// structural ("never creates a second user", "guarded server-side", "password
// never returned") are asserted against the route sources, because no pure
// function can promise them.
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  validateOwnerAccount, ownerFieldChanges, changesPassword, requiresSessionInvalidation,
  normaliseEmail, isValidEmail, isNoOp, mustChangePasswordFor, loginIdFollowsEmail, MIN_PASSWORD_LENGTH,
} from "@/lib/owner-account"

const ROOT = join(__dirname, "../../..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
const OWNER_ROUTE = read("src/app/api/admin/businesses/[businessId]/owner/route.ts")
const PROVISION_ROUTE = read("src/app/api/admin/businesses/provision/route.ts")
const PROVISIONING = read("src/lib/business-provisioning.ts")
const WIZARD = read("src/components/admin/businesses/business-management-wizard.tsx")

const current = { name: "Old Name", phone: "+919000000000", email: "owner@old.com" }

describe("confirm-password validation", () => {
  it("rejects a mismatch", () => {
    expect(validateOwnerAccount({ password: "Secret123", confirmPassword: "Secret124" })).toMatch(/do not match/i)
  })

  it("accepts a match", () => {
    expect(validateOwnerAccount({ password: "Secret123", confirmPassword: "Secret123" })).toBeNull()
  })

  it("requires the confirmation even when only the password is filled in", () => {
    // A mistyped password locks the owner out of their own business.
    expect(validateOwnerAccount({ password: "Secret123" })).toMatch(/do not match/i)
  })

  it("rejects a password shorter than the platform minimum", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1)
    expect(validateOwnerAccount({ password: short, confirmPassword: short })).toMatch(/at least/i)
  })

  it("does not ask for a password when none is being set", () => {
    // Fixing a phone number must not demand a password.
    expect(validateOwnerAccount({ phone: "+919111111111" })).toBeNull()
    expect(changesPassword({ phone: "+919111111111" })).toBe(false)
  })
})

describe("email / login ID validation", () => {
  it("rejects an empty or malformed address", () => {
    expect(validateOwnerAccount({ email: "" })).toMatch(/cannot be empty/i)
    expect(validateOwnerAccount({ email: "not-an-email" })).toMatch(/valid/i)
  })

  it("normalises to lowercase, because login matches lowercased", () => {
    // /api/core/auth/login lowercases the identifier and looks up loginId then
    // email exactly — a mixed-case stored email misses both.
    expect(normaliseEmail("  Owner@New.COM ")).toBe("owner@new.com")
    expect(ownerFieldChanges({ email: "Owner@New.COM" }, current).email).toBe("owner@new.com")
    expect(isValidEmail("Owner@New.COM")).toBe(true)
  })

  it("treats a case-only difference as no change", () => {
    expect(ownerFieldChanges({ email: "OWNER@OLD.COM" }, current).email).toBeUndefined()
  })
})

describe("changing the email actually retires the old login", () => {
  it("moves loginId when it mirrored the old email", () => {
    // Login resolves loginId BEFORE email, so leaving it behind would keep the
    // old address working after the Super Admin thought they had changed it.
    expect(loginIdFollowsEmail("owner@old.com", "owner@old.com")).toBe(true)
    expect(loginIdFollowsEmail("Owner@Old.com", "owner@old.com")).toBe(true)
  })

  it("leaves a distinct handle alone", () => {
    // Provisioning mints "<slug>-owner-<id>" — not the email, and a working
    // login that must not be broken.
    expect(loginIdFollowsEmail("acme-owner-abc12345", "owner@old.com")).toBe(false)
    expect(loginIdFollowsEmail(null, "owner@old.com")).toBe(false)
  })

  it("the route applies it only alongside an email change", () => {
    expect(OWNER_ROUTE).toContain("if (changes.email && loginIdFollowsEmail(owner.loginId, owner.email))")
  })
})

describe("only what changed is written", () => {
  it("an unchanged submit is a no-op", () => {
    const changes = ownerFieldChanges({ name: "Old Name", phone: "+919000000000", email: "owner@old.com" }, current)
    expect(changes).toEqual({})
    expect(isNoOp(changes, false)).toBe(true)
  })

  it("edits each field independently", () => {
    expect(ownerFieldChanges({ name: "New Name" }, current)).toEqual({ name: "New Name" })
    expect(ownerFieldChanges({ phone: "+919111111111" }, current)).toEqual({ phone: "+919111111111" })
    expect(ownerFieldChanges({ email: "new@owner.com" }, current)).toEqual({ email: "new@owner.com" })
  })

  it("allows clearing the phone but never the name or email", () => {
    expect(ownerFieldChanges({ phone: "" }, current)).toEqual({ phone: null })
    expect(ownerFieldChanges({ name: "   " }, current)).toEqual({})
    expect(validateOwnerAccount({ name: "   " })).toMatch(/cannot be empty/i)
  })

  it("never carries the password among the plain fields", () => {
    const changes = ownerFieldChanges({ name: "New Name", password: "Secret123" }, current)
    expect(JSON.stringify(changes)).not.toContain("Secret123")
  })
})

describe("session invalidation", () => {
  it("revokes sessions on a password change", () => {
    expect(requiresSessionInvalidation({ password: "Secret123" }, current.email)).toBe(true)
  })

  it("revokes sessions on an email change", () => {
    expect(requiresSessionInvalidation({ email: "new@owner.com" }, current.email)).toBe(true)
  })

  it("does NOT sign the owner out for a rename or phone edit", () => {
    expect(requiresSessionInvalidation({ name: "New Name" }, current.email)).toBe(false)
    expect(requiresSessionInvalidation({ phone: "+919111111111" }, current.email)).toBe(false)
    // Same address, different case: not a credential change.
    expect(requiresSessionInvalidation({ email: "OWNER@OLD.COM" }, current.email)).toBe(false)
  })
})

describe("an admin-chosen password is a real password", () => {
  it("is not force-rotated on first login", () => {
    // Otherwise "the owner can log in with the configured password" is false.
    expect(mustChangePasswordFor("ADMIN_SET")).toBe(false)
  })

  it("an auto-generated one still must be changed", () => {
    expect(mustChangePasswordFor("GENERATED")).toBe(true)
  })
})

describe("the owner user is updated, never duplicated", () => {
  it("the endpoint resolves the existing CLIENT_OWNER and updates that row", () => {
    expect(OWNER_ROUTE).toContain("role: 'CLIENT_OWNER'")
    expect(OWNER_ROUTE).toContain("db.user.update")
  })

  it("it cannot create or upsert a user", () => {
    expect(OWNER_ROUTE).not.toContain("db.user.create")
    expect(OWNER_ROUTE).not.toContain("db.user.upsert")
    expect(OWNER_ROUTE).not.toContain("businessUser.create")
  })

  it("it refuses instead of provisioning an owner that does not exist yet", () => {
    expect(OWNER_ROUTE).toContain("no owner account yet")
  })

  it("it does not touch the business, its link, or tenant data", () => {
    expect(OWNER_ROUTE).not.toContain("db.business.update")
    expect(OWNER_ROUTE).not.toContain("db.businessUser.update")
    expect(OWNER_ROUTE).not.toContain("db.businessUser.delete")
  })

  it("provisioning still returns early when an owner already exists", () => {
    // The one place that creates an owner refuses to create a second.
    expect(PROVISIONING).toContain("if (existingOwner)")
    expect(PROVISIONING).toContain("return // Owner already exists")
  })
})

describe("email uniqueness is enforced, not merged", () => {
  it("checks loginId as well as email, because login resolves loginId first", () => {
    expect(OWNER_ROUTE).toContain("{ email: changes.email }, { loginId: changes.email }")
    expect(OWNER_ROUTE).toContain("id: { not: owner.id }")
    expect(OWNER_ROUTE).toContain("already belongs to another user")
  })

  it("provisioning refuses a colliding owner email too", () => {
    expect(PROVISIONING).toContain("already belongs to another user")
  })
})

describe("server-side Super Admin authorization", () => {
  it("the owner endpoint is platform-only", () => {
    // withPlatformAccess = requireAuth + requirePlatformAdmin, resolved from
    // User.platformRole, which no tenant role can hold.
    expect(OWNER_ROUTE).toContain("withPlatformAccess")
    expect(OWNER_ROUTE.match(/withPlatformAccess/g)?.length).toBeGreaterThanOrEqual(2) // GET + PUT
  })

  it("provisioning now requires auth — it sets the owner's credentials", () => {
    // requiredPermission is only enforced inside withMiddleware's requireAuth
    // branch, so without requireAuth this route was reachable unauthenticated.
    expect(PROVISION_ROUTE).toContain("requireAuth: true")
    expect(PROVISION_ROUTE).toContain("requirePlatformAdmin: true")
  })
})

describe("passwords are hashed, never returned, never logged", () => {
  it("uses the existing bcrypt helper and no second password system", () => {
    expect(OWNER_ROUTE).toContain("from '@/lib/password-utils'")
    expect(OWNER_ROUTE).toContain("await hashPassword(")
    // No second hashing implementation — it goes through the shared helper.
    expect(OWNER_ROUTE).not.toContain("from 'bcrypt")
    expect(OWNER_ROUTE).not.toContain("createHash")
  })

  it("never selects or returns the hash or the plain password", () => {
    expect(OWNER_ROUTE).not.toContain("passwordHash: true")
    expect(OWNER_ROUTE).not.toContain("password: rawPassword")
    expect(OWNER_ROUTE).not.toContain("body.password }")
  })

  it("logs only which fields changed", () => {
    expect(OWNER_ROUTE).toContain("passwordChanged: setsPassword")
    // No console line carries the body or the password.
    for (const line of OWNER_ROUTE.split("\n").filter((l) => l.includes("console."))) {
      expect(line).not.toContain("body")
      expect(line).not.toContain("password")
    }
  })

  it("the UI drops the plain password from state after saving", () => {
    expect(WIZARD).toContain("ownerPassword: '', ownerPasswordConfirm: ''")
  })

  it("there is no way to reveal an existing password", () => {
    // The toggle only reveals what is being typed now.
    expect(WIZARD).not.toContain("currentPassword")
    expect(WIZARD).not.toContain("Show current password")
  })
})

describe("business creation carries the entered owner details", () => {
  it("provisioning uses the Super Admin's name / email / phone, not the business name", () => {
    expect(PROVISIONING).toContain("opts.ownerName?.trim() || business.name")
    expect(PROVISIONING).toContain("opts.ownerEmail || business.contactEmail")
    expect(PROVISIONING).toContain("opts.ownerPhone?.trim()")
  })

  it("the wizard actually sends them — they used to be dropped", () => {
    expect(WIZARD).toContain("ownerName: form.ownerName || undefined")
    expect(WIZARD).toContain("ownerEmail: form.ownerEmail || form.contactEmail || undefined")
  })

  it("creation and editing validate a password the same way", () => {
    expect(PROVISION_ROUTE).toContain("validateOwnerAccount")
    expect(OWNER_ROUTE).toContain("validateOwnerAccount")
  })
})

describe("existing functionality is preserved", () => {
  it("the auto-generate Reset Password button still exists and still forces a change", () => {
    expect(WIZARD).toContain("resetOwnerPassword")
    const reset = read("src/app/api/admin/businesses/[businessId]/reset-password/route.ts")
    expect(reset).toContain("mustChangePassword: true")
  })

  it("no new user model, auth service or RBAC was introduced", () => {
    expect(OWNER_ROUTE).toContain("from '@/lib/db'")
    expect(OWNER_ROUTE).toContain("from '@/lib/middleware'")
    expect(OWNER_ROUTE).toContain("from '@/lib/password-utils'")
  })
})
