import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// One person, two relationships. Neha is a CUSTOMER of VASTRASUDHA. She is now
// also hired as CRM Executive. Both must exist at once, neither linked to nor
// modified because of the other.
//
// The constraint that blocked this is User.email @unique — and it stays, because
// 19 auth call sites resolve accounts through it. The staff account therefore
// carries its own internal address while the real one lives on the membership.
// ============================================================================

type Row = Record<string, unknown>
const db = { user: [] as Row[], businessUser: [] as Row[], laundryAccessRole: [] as Row[], laundryAccessAssignment: [] as Row[], laundryStore: [] as Row[], laundryDeliveryExecutive: [] as Row[] }
let ids = 0
const nid = () => `r${++ids}`

const match = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((c) => match(row, c))
    if (v && typeof v === 'object' && 'not' in (v as Row)) return row[k] !== (v as Row).not
    if (v && typeof v === 'object' && 'is' in (v as Row)) {
      // relation filter: { user: { is: { phone } } }
      const rel = (v as Row).is as Row
      const target = k === 'user' ? db.user.find((u) => u.id === row.userId) : undefined
      return !!target && match(target, rel)
    }
    return row[k] === v
  })

const VS = 'biz_vastrasudha'
const OTHER = 'biz_other'
let issued = 3   // V8EMP001..003 already exist

vi.mock('@/lib/laundry-rbac', () => ({
  requireLaundryPermission: vi.fn(async () => ({ ok: true, platformBusinessId: VS, ctx: { laundryBusinessId: 'lb_vs', userId: 'admin', userName: 'Admin' } })),
  rbacAudit: vi.fn(async () => {}),
  isBusinessOwnerRole: (r: string) => r === 'LAUNDRY_OWNER' || r === 'CLIENT_OWNER',
}))
vi.mock('@/lib/password-utils', () => ({ hashPassword: vi.fn(async (p: string) => `hash:${p}`) }))
vi.mock('@/lib/laundry-employee-identity', () => ({
  issueStaffEmployeeId: vi.fn(async () => `V8EMP${String(++issued).padStart(3, '0')}`),
  reconcileStaffEmployeeIds: vi.fn(async () => 0),
  reconcileStaffLoginIds: vi.fn(async () => 0),
}))

vi.mock('@/lib/prisma', () => {
  const table = (name: keyof typeof db) => ({
    findUnique: vi.fn(async ({ where }: never) => {
      const hit = db[name].find((r) => match(r, where as Row))
      return hit ? { ...hit } : null
    }),
    findFirst: vi.fn(async (args?: never) => {
      const a = args as { where?: Row } | undefined
      const hit = db[name].find((r) => (a?.where ? match(r, a.where) : true))
      if (!hit) return null
      const out: Row = { ...hit }
      if (name === 'businessUser') out.user = db.user.find((u) => u.id === hit.userId) ?? null
      return out
    }),
    findMany: vi.fn(async (args?: never) => {
      const a = args as { where?: Row } | undefined
      return (a?.where ? db[name].filter((r) => match(r, a.where!)) : db[name]).map((r) => {
        const out: Row = { ...r }
        if (name === 'businessUser') out.user = db.user.find((u) => u.id === r.userId) ?? null
        return out
      })
    }),
    create: vi.fn(async ({ data }: never) => {
      const d: Row = { id: nid(), ...(data as Row) }
      if (name === 'user' && db.user.some((u) => u.email === d.email)) throw new Error('Unique constraint failed on the fields: (`email`)')
      if (name === 'user' && d.loginId && db.user.some((u) => u.loginId === d.loginId)) throw new Error('Unique constraint failed on the fields: (`loginId`)')
      if (name === 'businessUser' && db.businessUser.some((x) => x.userId === d.userId && x.businessId === d.businessId)) {
        throw new Error('Unique constraint failed on the fields: (`userId`,`businessId`)')
      }
      db[name].push(d)
      return { ...d }
    }),
    upsert: vi.fn(async ({ create }: never) => { const d: Row = { id: nid(), ...(create as Row) }; db[name].push(d); return { ...d } }),
    update: vi.fn(async ({ where, data }: never) => {
      const r = db[name].find((x) => match(x, where as Row)); if (!r) throw new Error('not found')
      Object.assign(r, data as Row); return { ...r }
    }),
  })
  const prisma = Object.fromEntries((Object.keys(db) as (keyof typeof db)[]).map((k) => [k, table(k)]))
  return { prisma }
})

const NEHA_EMAIL = 'sunitadak15@gmail.com'
const NEHA_PHONE = '6230691311'

const reset = () => {
  for (const k of Object.keys(db) as (keyof typeof db)[]) db[k].length = 0
  ids = 0; issued = 3
  // Neha, the CUSTOMER — the record that must survive completely untouched.
  db.user.push({ id: 'u_neha_cust', email: NEHA_EMAIL, loginId: NEHA_EMAIL, name: 'Neha', phone: `+91${NEHA_PHONE}`, passwordHash: 'hash:customer' })
  db.businessUser.push({ id: 'bu_neha_cust', userId: 'u_neha_cust', businessId: VS, role: 'CUSTOMER', employeeCode: null, contactEmail: null, isActive: true })
  // Three staff already on the books.
  for (let i = 1; i <= 3; i++) {
    db.user.push({ id: `u_s${i}`, email: `s${i}@vs.in`, loginId: `V8EMP00${i}`, name: `Staff ${i}`, phone: `90000000${i}` })
    db.businessUser.push({ id: `bu_s${i}`, userId: `u_s${i}`, businessId: VS, role: 'STORE_EXECUTIVE', employeeCode: `V8EMP00${i}`, contactEmail: `s${i}@vs.in`, isActive: true })
  }
  db.laundryAccessRole.push({ id: 'role_crm', businessId: VS, name: 'CRM Executive', isOwner: false })
}

const post = async (body: Row) => {
  const { POST } = await import('@/app/api/laundry/staff/route')
  const res = await POST(new Request('http://internal/api/laundry/staff', { method: 'POST', body: JSON.stringify({ businessId: VS, ...body }) }))
  return { status: res.status, body: await res.json() }
}
const NEHA_DEVI = { name: 'Neha Devi', phone: NEHA_PHONE, email: NEHA_EMAIL, password: 'Neha@123', roleId: 'role_crm' }

describe('a customer can also be hired as staff', () => {
  beforeEach(reset)

  it('1 + 3 + 4 + 5. Neha Devi is created as V8EMP004, keeping her name, phone and email', async () => {
    const { status, body } = await post(NEHA_DEVI)
    expect(status).toBe(201)
    expect(body.data.employeeCode).toBe('V8EMP004')
    expect(body.data.loginId).toBe('V8EMP004')        // the employee id IS the login
    expect(body.data.email).toBe(NEHA_EMAIL)          // her own address, retained

    const bu = db.businessUser.find((r) => r.employeeCode === 'V8EMP004')!
    expect(bu.contactEmail).toBe(NEHA_EMAIL)
    const u = db.user.find((r) => r.id === bu.userId)!
    expect(u.name).toBe('Neha Devi')
    expect(u.phone).toBe(NEHA_PHONE)
    expect(u.loginId).toBe('V8EMP004')
    // The ACCOUNT address is internal — User.email is @unique and the customer holds the real one.
    expect(u.email).not.toBe(NEHA_EMAIL)
    expect(String(u.email)).toMatch(/@staff\.quantix\.local$/)
  })

  it('2 + 6. the existing Customer record is untouched, and no second customer appears', async () => {
    const before = JSON.parse(JSON.stringify(db.user.find((u) => u.id === 'u_neha_cust')))
    const beforeMembership = JSON.parse(JSON.stringify(db.businessUser.find((b) => b.id === 'bu_neha_cust')))
    await post(NEHA_DEVI)
    expect(db.user.find((u) => u.id === 'u_neha_cust')).toEqual(before)
    expect(db.businessUser.find((b) => b.id === 'bu_neha_cust')).toEqual(beforeMembership)
    expect(db.businessUser.filter((b) => b.role === 'CUSTOMER')).toHaveLength(1)
    // Two separate accounts, never merged.
    expect(db.user.filter((u) => u.name === 'Neha' || u.name === 'Neha Devi')).toHaveLength(2)
  })

  it('the same address now legitimately appears on both records', async () => {
    await post(NEHA_DEVI)
    const staff = db.businessUser.find((r) => r.employeeCode === 'V8EMP004')!
    const customer = db.user.find((u) => u.id === 'u_neha_cust')!
    expect(staff.contactEmail).toBe(NEHA_EMAIL)
    expect(customer.email).toBe(NEHA_EMAIL)
  })

  it('7. a double-submitted form does not mint a second employee', async () => {
    const first = await post(NEHA_DEVI)
    expect(first.status).toBe(201)
    const second = await post(NEHA_DEVI)
    expect(second.status).toBe(409)
    expect(second.body.error).toMatch(/already an employee of this business/)
    expect(db.businessUser.filter((r) => String(r.employeeCode || '').startsWith('V8EMP'))).toHaveLength(4)
  })

  it('the duplicate guard never mistakes a CUSTOMER for an existing employee', async () => {
    // Only Neha the customer holds these details; no staff row does.
    const { status } = await post(NEHA_DEVI)
    expect(status).toBe(201)
  })

  it('8. another tenant with the same person is unaffected', async () => {
    db.user.push({ id: 'u_other', email: 'neha@other.in', loginId: 'X1EMP001', name: 'Neha Devi', phone: NEHA_PHONE })
    db.businessUser.push({ id: 'bu_other', userId: 'u_other', businessId: OTHER, role: 'STORE_EXECUTIVE', employeeCode: 'X1EMP001', contactEmail: NEHA_EMAIL, isActive: true })
    const { status, body } = await post(NEHA_DEVI)
    expect(status).toBe(201)                       // the other tenant's employee is not "a duplicate" here
    expect(body.data.employeeCode).toBe('V8EMP004')
    expect(db.businessUser.find((b) => b.id === 'bu_other')!.employeeCode).toBe('X1EMP001')
  })

  it('9. existing staff rows are not touched by the new hire', async () => {
    const before = JSON.parse(JSON.stringify(db.businessUser.filter((b) => String(b.employeeCode || '').startsWith('V8EMP'))))
    await post(NEHA_DEVI)
    const after = db.businessUser.filter((b) => ['V8EMP001', 'V8EMP002', 'V8EMP003'].includes(String(b.employeeCode)))
    expect(after).toEqual(before)
  })

  it('an employee with no email at all still works', async () => {
    const { status, body } = await post({ name: 'No Email', roleId: 'role_crm', password: 'Secret123' })
    expect(status).toBe(201)
    expect(body.data.email).toBeNull()
    expect(body.data.loginId).toBe('V8EMP004')
  })

  it('a free address is used as the account address too', async () => {
    const { status } = await post({ name: 'Fresh Hire', email: 'fresh@vs.in', roleId: 'role_crm', password: 'Secret123' })
    expect(status).toBe(201)
    const bu = db.businessUser.find((r) => r.employeeCode === 'V8EMP004')!
    const u = db.user.find((r) => r.id === bu.userId)!
    expect(u.email).toBe('fresh@vs.in')
    expect(bu.contactEmail).toBe('fresh@vs.in')
  })
})

describe('the schema says a contact address is not an identity', () => {
  it('10. BusinessUser.contactEmail is nullable and NOT unique, like Customer.email', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8')
    const bu = /^model BusinessUser \{([\s\S]*?)^\}/m.exec(schema)![1]
    expect(bu).toMatch(/contactEmail\s+String\?/)
    expect(bu).not.toMatch(/contactEmail\s+String\?\s+@unique/)
    // User.email stays the account identity — auth resolves through it.
    expect(schema).toMatch(/^\s+email\s+String\s+@unique/m)
    // Delivery executives are untouched by any of this.
    const exec = readFileSync(join(__dirname, '../../app/api/laundry/delivery-executives/route.ts'), 'utf8')
    expect(exec).toMatch(/issueDeliveryEmployeeId/)
    expect(exec).toMatch(/@delivery\.quantix\.local/)
  })
})
