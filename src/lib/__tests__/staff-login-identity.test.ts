import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The User ID a staff member signs in with is their EMPLOYEE ID, and a password
// an administrator typed is the password — not a suggestion that gets replaced
// by a generated one, and not one the employee is immediately told to change.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

type Row = Record<string, unknown>
const db = { user: [] as Row[], businessUser: [] as Row[] }
let ids = 0
const nid = () => `r${++ids}`
const match = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in (v as Row)) return row[k] !== (v as Row).not
    return row[k] === v
  })

vi.mock('@/lib/prisma', () => {
  const table = (name: keyof typeof db) => ({
    findUnique: vi.fn(async ({ where }: never) => {
      const hit = db[name].find((r) => match(r, where as Row))
      return hit ? { ...hit } : null
    }),
    findMany: vi.fn(async (args?: never) => {
      const w = (args as { where?: Row } | undefined)?.where
      return (w ? db[name].filter((r) => match(r, w)) : db[name]).map((r) => ({ ...r }))
    }),
    update: vi.fn(async ({ where, data }: never) => {
      const r = db[name].find((x) => match(x, where as Row))
      if (!r) throw new Error('not found')
      const d = data as Row
      // loginId is @unique platform-wide.
      if (name === 'user' && d.loginId && db.user.some((x) => x !== r && x.loginId === d.loginId)) {
        throw new Error('Unique constraint failed on the fields: (`loginId`)')
      }
      Object.assign(r, d)
      return { ...r }
    }),
    create: vi.fn(async ({ data }: never) => {
      const d: Row = { id: nid(), ...(data as Row) }
      db[name].push(d)
      return { ...d }
    }),
  })
  return { prisma: { user: table('user'), businessUser: table('businessUser') } }
})

const BIZ = 'biz_vastrasudha'
const reset = () => {
  db.user.length = 0; db.businessUser.length = 0; ids = 0
  db.user.push(
    { id: 'u_owner', email: 'owner@vs.in',    loginId: 'owner@vs.in' },
    { id: 'u_1',     email: 'priyanshu@vs.in', loginId: 'priyanshu@vs.in' },
    { id: 'u_2',     email: 'sneha@vs.in',     loginId: 'sneha@vs.in' },
  )
  db.businessUser.push(
    { id: 'bu_owner', userId: 'u_owner', businessId: BIZ, employeeCode: null },       // the owner
    { id: 'bu_1',     userId: 'u_1',     businessId: BIZ, employeeCode: 'V8EMP001' },
    { id: 'bu_2',     userId: 'u_2',     businessId: BIZ, employeeCode: 'V8EMP002' },
  )
}
const loginOf = (id: string) => db.user.find((u) => u.id === id)!.loginId

describe('a staff member signs in with their employee id', () => {
  beforeEach(reset)

  it('moves an email loginId onto the employee id', async () => {
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    expect(await reconcileStaffLoginIds(BIZ)).toBe(2)
    expect(loginOf('u_1')).toBe('V8EMP001')
    expect(loginOf('u_2')).toBe('V8EMP002')
  })

  it('leaves the Business Owner on their email — they hold no employee id', async () => {
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffLoginIds(BIZ)
    expect(loginOf('u_owner')).toBe('owner@vs.in')
  })

  it('is idempotent — a reconciled tenant is read and not written', async () => {
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffLoginIds(BIZ)
    expect(await reconcileStaffLoginIds(BIZ)).toBe(0)
    expect(loginOf('u_1')).toBe('V8EMP001')
  })

  it('never moves a loginId that is already some other tenant employee id', async () => {
    db.user.find((u) => u.id === 'u_1')!.loginId = 'L5EMP003'   // also staff elsewhere
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffLoginIds(BIZ)
    expect(loginOf('u_1')).toBe('L5EMP003')
    expect(loginOf('u_2')).toBe('V8EMP002')                     // the rest still move
  })

  it('a unique clash leaves the record exactly as it was', async () => {
    db.user.push({ id: 'u_x', email: 'x@x.in', loginId: 'V8EMP001' })  // squatter
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffLoginIds(BIZ)
    expect(loginOf('u_1')).toBe('priyanshu@vs.in')
    expect(loginOf('u_2')).toBe('V8EMP002')
  })

  it('ignores a code that is not a well-formed employee id', async () => {
    db.businessUser.find((b) => b.id === 'bu_1')!.employeeCode = 'EXE007'  // legacy
    const { reconcileStaffLoginIds } = await import('@/lib/laundry-employee-identity')
    await reconcileStaffLoginIds(BIZ)
    expect(loginOf('u_1')).toBe('priyanshu@vs.in')
  })
})

describe('the staff create route, by its source', () => {
  const api = codeOnly(read('src/app/api/laundry/staff/route.ts'))

  it('makes the employee id the login id, with the email only as the owner fallback', () => {
    expect(api).toMatch(/const loginId = employeeCode \?\? email/)
    expect(api).toMatch(/email,\s*loginId,/)
    // The employee id must be issued BEFORE the User row, or it cannot be its id.
    expect(api.indexOf('const employeeCode =')).toBeLessThan(api.indexOf('prisma.user.create'))
  })

  it('keeps a typed password and does not force a change for it', () => {
    // The password the admin supplied is used verbatim …
    expect(api).toMatch(/String\(b\.password \|\| ""\)\.trim\(\) \|\| genPassword\(\)/)
    // … and only a GENERATED one forces a change at first login.
    expect(api).not.toMatch(/mustChangePassword: true/)
    expect(api).toMatch(/mode === "RANDOM"/)
  })

  it('tells the caller which of the two happened', () => {
    expect(api).toMatch(/mode/)
    expect(api).toMatch(/mustChangePassword/)
    expect(api).toMatch(/loginId,/)
  })
})
