import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ROUTE = 'src/app/api/laundry/branding/route.ts'
const RBAC = 'src/lib/laundry-rbac.ts'

// The bug: the workspace shell draws the logo for EVERY user, but the endpoint
// it reads required laundry.settings.view — a permission only owners and Super
// Admin hold. Everyone else got a 403 and an unbranded sidebar.
describe('branding read is open to every member, not just settings users', () => {
  const src = read(ROUTE)
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function PUT'))
  const put = src.slice(src.indexOf('export async function PUT'))

  it('GET no longer demands a settings permission', () => {
    // Assert on the guard CALL, not on the prose — the comment above it names
    // the old permission deliberately, to explain what was wrong.
    const call = get.slice(get.indexOf('const guard ='), get.indexOf('\n', get.indexOf('const guard =')))
    expect(call).toContain('requireLaundryMember')
    expect(call).not.toContain('settings.view')
    expect(get).not.toContain('requireLaundryPermission(')
  })

  it('GET is still authenticated — this is not a public endpoint', () => {
    expect(get).toMatch(/if \(!guard\.ok\) return guard\.res/)
  })

  it('PUT still requires settings.edit — only the read was opened', () => {
    expect(put).toContain('laundry.settings.edit')
    expect(put).not.toContain('requireLaundryMember')
  })
})

describe('the membership guard is a real guard', () => {
  const rbac = read(RBAC)
  const fn = rbac.slice(rbac.indexOf('export async function requireLaundryMember'))
    .slice(0, rbac.slice(rbac.indexOf('export async function requireLaundryMember')).indexOf('\n}\n') + 3)

  it('rejects an unauthenticated caller', () => {
    expect(fn).toContain('if (!ctx) return { ok: false')
    expect(fn).toContain('"Not authenticated"')
  })

  it('resolves the caller against THIS business, so branding cannot leak across tenants', () => {
    expect(fn).toContain('resolveLaundryBusiness(businessIdInput)')
    expect(fn).toContain('getLaundryAuthContext(biz.id, request)')
  })

  it('rejects an unknown business', () => {
    expect(fn).toContain('"Laundry business not found"')
  })

  it('uses the same auth path as the permission guard — no second mechanism', () => {
    const level = rbac.slice(rbac.indexOf('export async function requireLaundryLevel'))
    expect(level).toContain('getLaundryAuthContext(biz.id, request)')
  })
})

describe('the sidebar degrades gracefully', () => {
  const sidebar = read('src/components/laundry/layout/laundry-sidebar.tsx')

  it('renders no image at all until branding arrives — never a broken icon', () => {
    expect(sidebar).toContain('branding?.logo ?')
  })

  it('falls back to the business name, then the product name', () => {
    expect(sidebar).toContain('branding?.businessName || user?.businessName || "Laundry OS"')
  })

  it('keeps branding per business — the fetch is keyed by businessId', () => {
    expect(sidebar).toMatch(/api\/laundry\/branding\?businessId=\$\{businessId\}/)
    expect(sidebar).toMatch(/\}, \[businessId\]\)/)
  })
})
