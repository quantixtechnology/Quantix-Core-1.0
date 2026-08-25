import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { planOwnerAccount } from '@/lib/owner-account'

// ============================================================================
// One person can own more than one business.
//
// The schema has always said so:
//
//     User (email globally unique) → BusinessUser @@unique([userId, businessId]) → Business
//
// Provisioning did not. It looked the owner email up across ALL users and threw
// "already belongs to another user" if it found anything — so the first business
// to use an address burned it for every business after, and a person who was
// once a test customer could never be made an owner.
//
// The address is not the conflict. A SECOND user row for it would be, because
// login resolves loginId first and then email — but the unique constraint
// forbids that anyway. Reusing the row is what keeps login unambiguous.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const PROVISIONING = read('src/lib/business-provisioning.ts')
const SCHEMA       = read('prisma/schema.prisma')
const OWNER_ROUTE  = read('src/app/api/admin/businesses/[businessId]/owner/route.ts')

const withPassword = { id: 'u1', passwordHash: '$2a$hash', isActive: true }
const noPassword   = { id: 'u2', passwordHash: null, isActive: true }
const disabled     = { id: 'u3', passwordHash: '$2a$hash', isActive: false }

describe('1 · a new email creates a new owner', () => {
  it('no existing account means create one', () => {
    expect(planOwnerAccount(null)).toEqual({ action: 'CREATE_USER' })
    expect(planOwnerAccount(undefined)).toEqual({ action: 'CREATE_USER' })
  })

  it('the created account gets the password chosen at provisioning', () => {
    expect(PROVISIONING).toContain('createdBy: \'PROVISIONING\'')
    expect(PROVISIONING).toContain('hasPassword: true')
  })
})

describe('2 · an email owned in business A can provision business B', () => {
  it('an existing account is reused, never refused', () => {
    const plan = planOwnerAccount(withPassword)
    expect(plan.action).toBe('REUSE_USER')
    if (plan.action !== 'REUSE_USER') throw new Error('expected reuse')
    expect(plan.userId).toBe('u1')
  })

  it('the refusal is gone from the source, not merely unreachable', () => {
    expect(PROVISIONING).not.toContain('already belongs to another user')
  })

  it('no second account is created for the same address', () => {
    // Two rows with one email is what would make login ambiguous — and the
    // unique constraint forbids it. Reuse is what avoids both.
    expect(SCHEMA).toMatch(/email\s+String\s+@unique/)
  })
})

describe('3 · an email already in this business is reused, not duplicated', () => {
  it('the membership is upserted on the composite key', () => {
    expect(PROVISIONING).toContain('await db.businessUser.upsert({')
    expect(PROVISIONING).toContain('where: { userId_businessId: { userId: ownerUserId, businessId } }')
    expect(PROVISIONING).toContain("update: { role: 'CLIENT_OWNER', isActive: true }")
  })

  it('the schema makes a duplicate membership impossible anyway', () => {
    expect(SCHEMA).toContain('@@unique([userId, businessId])')
  })

  it('a business that already has an owner is left alone', () => {
    expect(PROVISIONING).toContain('if (existingOwner)')
    expect(PROVISIONING).toContain('return // Owner already exists')
  })
})

describe('4 · the existing account keeps working where it already worked', () => {
  it('an account that has a password keeps it', () => {
    const plan = planOwnerAccount(withPassword)
    if (plan.action !== 'REUSE_USER') throw new Error('expected reuse')
    expect(plan.setPassword).toBe(false)
    expect(plan.passwordUnchanged).toBe(true)
  })

  it('only a passwordless account is given one', () => {
    // An OTP-only customer cannot sign in as an owner at all, so filling that
    // gap is the one safe write. Anything else would be a Super Admin in
    // workspace B resetting the credential for workspace A.
    const plan = planOwnerAccount(noPassword)
    if (plan.action !== 'REUSE_USER') throw new Error('expected reuse')
    expect(plan.setPassword).toBe(true)
    expect(plan.passwordUnchanged).toBe(false)
  })

  it('the write is guarded by that decision', () => {
    expect(PROVISIONING).toContain('if (plan.setPassword) {')
    expect(PROVISIONING).toContain('await db.user.update({')
  })

  it('a password that was never written is never reported', () => {
    // The generated one is produced before we know whether it will be used.
    // Reporting it regardless sends the Super Admin off to share a credential
    // that does not work.
    expect(PROVISIONING).toContain('ownerCtx.tempPassword = undefined')
    expect(PROVISIONING).toContain('ownerCtx.ownerPasswordUnchanged = true')
  })

  it('the profile of a reused account is not rewritten', () => {
    // name/phone belong to the person and are shown across every business they
    // are in. Only the credential gap is filled.
    const update = PROVISIONING.slice(
      PROVISIONING.indexOf('if (plan.setPassword) {'),
      PROVISIONING.indexOf('if (plan.passwordUnchanged) {'),
    )
    expect(update).not.toContain('name:')
    expect(update).not.toContain('phone:')
    expect(update).not.toContain('email:')
  })

  it('a disabled account is flagged, not silently re-enabled', () => {
    const plan = planOwnerAccount(disabled)
    if (plan.action !== 'REUSE_USER') throw new Error('expected reuse')
    expect(plan.inactive).toBe(true)
    // Re-enabling would restore their access to the OTHER business too.
    expect(PROVISIONING).toContain('if (plan.inactive) ownerCtx.ownerAccountInactive = true')
    expect(PROVISIONING).not.toContain('isActive: true,\n          passwordHash')
  })
})

describe('5 & 6 · sharing an email shares nothing else', () => {
  it('the owner link is one row scoped to one business', () => {
    const upsert = PROVISIONING.slice(PROVISIONING.indexOf('await db.businessUser.upsert({'))
    expect(upsert).toContain('businessId')
    expect(upsert).toContain('userId: ownerUserId')
  })

  it('membership is what scopes a user to a tenant, and it is per business', () => {
    // The model BLOCK, not a fixed character count — a magic width silently
    // stops covering the fields it is meant to check the moment one is added.
    const start = SCHEMA.indexOf('model BusinessUser {')
    const model = SCHEMA.slice(start, SCHEMA.indexOf('\n}', start))
    expect(model).toContain('businessId       String')
    expect(model).toContain('onDelete: Cascade')
    expect(model).toContain('@@index([businessId])')
  })

  it('tenant data hangs off the business, not off the user', () => {
    // Customers, staff and orders are reachable from Business — being the same
    // User in two businesses grants nothing in either.
    const customer = SCHEMA.slice(SCHEMA.indexOf('model Customer {'), SCHEMA.indexOf('model Customer {') + 1200)
    expect(customer).toContain('businessId')
  })

  it('provisioning writes nothing that crosses a business', () => {
    // Every write in the owner step is either the User row itself or the
    // membership for THIS businessId.
    const step = PROVISIONING.slice(
      PROVISIONING.indexOf('async function createOwnerAccountStep'),
      PROVISIONING.indexOf('Step 4: Assign Licensed Features'),
    )
    expect(step).not.toContain('updateMany')
    expect(step).not.toContain('deleteMany')
    expect(step.match(/db\.businessUser\.(create|upsert|update)/g)).toEqual(['db.businessUser.upsert'])
  })
})

describe('7 · one account, one login, the right business context', () => {
  it('there is still exactly one user row per address', () => {
    expect(SCHEMA).toMatch(/email\s+String\s+@unique/)
    expect(SCHEMA).toMatch(/loginId\s+String\?\s+@unique/)
  })

  it('the lookup that finds the account checks both handles', () => {
    // Login resolves loginId first, then email; the reuse lookup has to match.
    expect(PROVISIONING).toContain('where: { OR: [{ email: ownerEmail }, { loginId: ownerEmail }] }')
  })

  it('a reused account is not given a second loginId', () => {
    // loginId is minted per business for a NEW owner only. Reassigning it on a
    // reused account would move the other business's login handle.
    const reuse = PROVISIONING.slice(
      PROVISIONING.indexOf("if (plan.action === 'REUSE_USER')"),
      PROVISIONING.indexOf('// Create owner user account'),
    )
    expect(reuse).not.toContain('loginId')
  })

  it('business context comes from the membership rows, not the email', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model User {'), SCHEMA.indexOf('model User {') + 1600)
    expect(model).toContain('businessUsers       BusinessUser[]')
  })
})

describe('8 · genuine same-business conflicts still lose', () => {
  it('a second owner is not created for a business that has one', () => {
    expect(PROVISIONING).toContain("role: 'CLIENT_OWNER',")
    expect(PROVISIONING).toContain('const existingOwner = await db.businessUser.findFirst({')
  })

  it('changing an existing owner to a taken address is still refused', () => {
    // Unchanged, and correct: User.email is globally unique, so that update
    // cannot succeed. Reuse is for provisioning a new business, not for
    // renaming an existing owner onto somebody else's account.
    expect(OWNER_ROUTE).toContain('already belongs to another user.')
    expect(OWNER_ROUTE).toContain('id: { not: owner.id }')
  })
})

describe('no schema change was needed', () => {
  it('User.email is still globally unique', () => {
    expect(SCHEMA).toMatch(/email\s+String\s+@unique/)
  })

  it('BusinessUser still carries the composite uniqueness', () => {
    expect(SCHEMA).toContain('@@unique([userId, businessId])')
  })
})
