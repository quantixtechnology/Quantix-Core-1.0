import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The Business Owner logged in, reached the dashboard, and every /api/core call
// came back 401 — "Access Denied", which reads like a permission problem when
// nothing was being authenticated at all.
//
// Tenant users have NO session cookie. /api/core/* authenticates from the
// Authorization header alone, and the workspace's fetch patch only attached it
// to /api/laundry — so ~40 core calls went out bare.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const BRIDGE = read('src/components/laundry/laundry-auth-bridge.tsx')
const MIDDLEWARE = read('src/lib/middleware.ts')

describe('the workspace authenticates its own API calls', () => {
  it('core endpoints read the header and nothing else — there is no cookie to fall back on', () => {
    const fn = MIDDLEWARE.slice(MIDDLEWARE.indexOf('async function extractUserFromRequest'), MIDDLEWARE.indexOf('const refreshToken'))
    expect(fn).toContain("req.headers.get('authorization')")
    expect(fn).toContain('AUTH_ERRORS.NO_TOKEN')
    expect(fn).not.toContain('cookies')
  })

  it('the bridge covers every same-origin /api/ path, not just /api/laundry', () => {
    expect(BRIDGE).toContain('path.startsWith("/api/")')
    expect(BRIDGE).not.toContain('url.includes("/api/laundry")')
  })

  it('and only same-origin — a third-party URL is never given the token', () => {
    expect(BRIDGE).toContain('u.origin === window.location.origin')
    expect(BRIDGE).toContain('window.location.origin')
  })

  it('an explicit Authorization header still wins (the Customer App keeps its own)', () => {
    expect(BRIDGE).toContain('if (!headers.has("Authorization"))')
  })

  it('the business context travels with the request too', () => {
    expect(BRIDGE).toContain('x-business-id')
    expect(MIDDLEWARE).toContain("req.headers.get('x-business-id')")
  })

  it('the workspace really does call core endpoints — this is not theoretical', () => {
    const ui = read('src/components/laundry/views/laundry-dashboard.tsx') + read('src/components/laundry/layout/laundry-sidebar.tsx')
    expect(ui + BRIDGE).toContain('/api/')
    // The reported one.
    expect(read('src/app/api/core/notifications/route.ts')).toContain('requireAuth: true')
  })
})

describe('password reset stays simple', () => {
  const STAFF = read('src/components/laundry/views/laundry-staff.tsx')

  it('a password the admin sets simply works — no forced change by default', () => {
    expect(STAFF).toContain('const [force, setForce] = useState(false)')
  })

  it('the key icon opens the dialog; nothing is written until Reset', () => {
    expect(STAFF).toContain('onClick={() => setResetting(e)}')
    expect(STAFF).toContain('Nothing changes until you press Reset.')
  })

  it('no retry counter or lockout for an employee-id login', () => {
    const login = read('src/app/api/core/auth/login/route.ts')
    expect(login).toContain('const isEmployeeLogin = !!employeeIdentity')
    expect(login).toContain('if (!isEmployeeLogin && user.lockedUntil')
    const fail = login.slice(login.indexOf('if (!isValid) {'), login.indexOf('// Update last login'))
    expect(fail).toContain('if (!isEmployeeLogin) {')
  })
})
