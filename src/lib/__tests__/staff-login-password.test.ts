import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Staff sign in with their Employee ID and a password. Three things were wrong:
// a wrong password could lock a counter user out mid-shift, the key icon reset
// the password the moment it was clicked, and the failure said "email".
//
// The Delivery Executive flow already does all of this simply; Staff follows it.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const LOGIN = read('src/app/api/core/auth/login/route.ts')
const RESET = read('src/app/api/laundry/staff/[userId]/reset-password/route.ts')
const EXEC_RESET = read('src/app/api/laundry/delivery-executives/[id]/route.ts')
const UI = read('src/components/laundry/views/laundry-staff.tsx')
const CREATE = read('src/app/api/laundry/staff/route.ts')

describe('6 + 7 · no retry limit on an Employee ID login', () => {
  it('the lock is not consulted for an employee id', () => {
    expect(LOGIN).toContain('const isEmployeeLogin = !!employeeIdentity')
    expect(LOGIN).toContain('if (!isEmployeeLogin && user.lockedUntil && user.lockedUntil > new Date())')
  })

  it('a wrong password writes NO counter and NO lock', () => {
    const fail = LOGIN.slice(LOGIN.indexOf('if (!isValid) {'), LOGIN.indexOf('// Update last login'))
    // The counter only runs on the non-employee branch.
    expect(fail).toContain('if (!isEmployeeLogin) {')
    const guarded = fail.slice(fail.indexOf('if (!isEmployeeLogin) {'))
    expect(guarded).toContain('failedLoginAttempts: attempts')
    // …and nothing outside that branch touches the account.
    const before = fail.slice(0, fail.indexOf('if (!isEmployeeLogin) {'))
    expect(before).not.toContain('user.update')
  })

  it('6. and the message names the right identifier', () => {
    expect(LOGIN).toContain("isEmployeeLogin ? 'Invalid Employee ID or password' : 'Invalid email or password'")
  })

  it('email and platform logins keep their protection', () => {
    // The lockout still exists — it is skipped only for employee ids, because
    // those are internal and not reachable by email from the internet.
    expect(LOGIN).toContain('MAX_ATTEMPTS')
    expect(LOGIN).toContain('LOCK_MINUTES')
  })
})

describe('8 + 9 · the key icon opens a dialog; it does not reset', () => {
  it('clicking it only sets state', () => {
    expect(UI).toContain('onClick={() => setResetting(e)}')
    // The old handler POSTed straight from the icon.
    expect(UI).not.toContain('const resetPassword = async (e: Emp)')
  })

  it('the dialog says nothing happens until Reset is pressed', () => {
    expect(UI).toContain('Nothing changes until you press Reset.')
  })

  it('9. it offers the same two choices as the executive dialog', () => {
    for (const src of [UI, read('src/components/laundry/views/laundry-delivery-executives.tsx')]) {
      expect(src).toContain('"random" | "manual"')
    }
    expect(UI).toContain('Generate a temporary password')
    expect(UI).toContain('Set it myself')
    expect(UI).toContain('Ask them to change it at next login')
  })

  it('and posts the same fields the executive endpoint takes', () => {
    expect(UI).toContain('password: mode === "manual" ? pw.trim() : undefined')
    expect(UI).toContain('forceChange: force')
    expect(EXEC_RESET).toContain('const forceChange = b.forceChange !== false')
    expect(RESET).toContain('const forceChange = b.forceChange !== false')
  })
})

describe('10 + 11 + 12 · passwords are only what the admin chose', () => {
  it('10. a typed password on create is kept and forces no change', () => {
    expect(CREATE).toContain('const mode = String(b.password || "").trim() ? "MANUAL" : "RANDOM"')
    expect(CREATE).toContain('mode === "RANDOM"')
    expect(CREATE).not.toContain('mustChangePassword: true')
  })

  it('11. a blank password generates a temporary one', () => {
    expect(CREATE).toContain('String(b.password || "").trim() || genPassword()')
    expect(RESET).toContain('supplied || genPassword()')
  })

  it('12. nothing else writes a password hash without the admin asking', () => {
    // Reconciliation touches employee codes and login ids, never credentials.
    const identity = read('src/lib/laundry-employee-identity.ts')
    expect(identity).not.toContain('passwordHash')
    expect(identity).not.toContain('hashPassword')
  })

  it('a reset also frees an account the old retry limit had locked', () => {
    expect(RESET).toContain('failedLoginAttempts: 0, lockedUntil: null')
  })
})

describe('1-5 · the Employee ID is the login identifier', () => {
  it('login resolves the tenant from the employee id, then the membership', () => {
    expect(LOGIN).toContain('resolveTenantByEmployeeId(identifier)')
    expect(LOGIN).toContain('employeeCode: identifier.toUpperCase()')
  })

  it('and the id is stored as loginId when staff are created', () => {
    expect(CREATE).toContain('const loginId = employeeCode ?? accountEmail')
  })

  it('email is contact only — it never becomes the staff login', () => {
    expect(CREATE).toContain('contactEmail: email || null')
    // The account address is internal when the real one is taken.
    expect(CREATE).toContain('PLACEHOLDER_EMAIL_DOMAIN')
  })
})
