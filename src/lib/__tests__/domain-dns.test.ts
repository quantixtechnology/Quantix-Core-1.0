import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { assessDnsTarget, isNonPublicAddress, dnsLabel } from '@/lib/domain-dns'

// ============================================================================
// 127.0.0.1 is an answer, not a destination.
//
// Domain validation asked "does the answer contain our IP?" and answered `true`
// whenever VPS_HOST was unset:
//
//     dnsActive = VPS_IP ? resolved.includes(VPS_IP) : true
//
// So vastrasudha.co.in — parked on 127.0.0.1 by its registrar — read as DNS ✓,
// and the pipeline went on to run certbot against a name Let's Encrypt can
// never reach. SSL failed, the browser said ERR_CONNECTION_REFUSED, and the one
// fact that explained all of it was on screen, displayed as though it were fine.
//
// A loopback answer is wrong whatever our IP is, and that judgement needs no
// configuration to make.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const VALIDATE = read('src/app/api/website/validate/route.ts')
const STATUS   = read('src/app/api/website/status/route.ts')
const HOSTPROV = read('src/lib/product-host-provisioner.ts')

const VPS = '13.205.43.103'

describe('addresses that cannot serve a public domain', () => {
  it('loopback is not public', () => {
    expect(isNonPublicAddress('127.0.0.1')).toBe(true)
    expect(isNonPublicAddress('127.53.1.9')).toBe(true)
    expect(isNonPublicAddress('::1')).toBe(true)
  })

  it('private and link-local ranges are not public', () => {
    for (const ip of ['10.0.0.5', '172.16.4.1', '172.31.255.254', '192.168.1.1', '169.254.10.10', '0.0.0.0']) {
      expect(isNonPublicAddress(ip)).toBe(true)
    }
  })

  it('addresses either side of a private range still are', () => {
    // 172.16/12 is the range, not all of 172.
    expect(isNonPublicAddress('172.15.0.1')).toBe(false)
    expect(isNonPublicAddress('172.32.0.1')).toBe(false)
    expect(isNonPublicAddress('192.167.1.1')).toBe(false)
  })

  it('real public addresses are public', () => {
    for (const ip of [VPS, '8.8.8.8', '1.1.1.1', '208.91.197.91']) {
      expect(isNonPublicAddress(ip)).toBe(false)
    }
  })
})

describe('A · the record points at the production server', () => {
  it('is the only state that confirms the domain', () => {
    const a = assessDnsTarget([VPS], VPS)
    expect(a.state).toBe('POINTS_TO_VPS')
    expect(a.pointsToVps).toBe(true)
    expect(a.canProvisionSsl).toBe(true)
    expect(a.nextStep).toBe('')
  })

  it('extra records alongside ours still count', () => {
    expect(assessDnsTarget(['203.0.113.9', VPS], VPS).state).toBe('POINTS_TO_VPS')
  })
})

describe('B · the record points somewhere else', () => {
  it('is refused, and names both addresses', () => {
    const a = assessDnsTarget(['203.0.113.9'], VPS)
    expect(a.state).toBe('POINTS_ELSEWHERE')
    expect(a.pointsToVps).toBe(false)
    expect(a.canProvisionSsl).toBe(false)
    expect(a.nextStep).toContain('203.0.113.9')
    expect(a.nextStep).toContain(VPS)
  })
})

describe('C · the record points at localhost', () => {
  it('is refused whether or not our IP is known', () => {
    for (const vps of [VPS, '']) {
      const a = assessDnsTarget(['127.0.0.1'], vps)
      expect(a.state).toBe('NOT_PUBLIC')
      expect(a.pointsToVps).toBe(false)
      expect(a.canProvisionSsl).toBe(false)
    }
  })

  it('says what it is and where to fix it', () => {
    const a = assessDnsTarget(['127.0.0.1'], VPS)
    expect(a.nextStep).toContain('127.0.0.1')
    expect(a.nextStep).toContain('not a public address')
    expect(a.nextStep).toContain('DNS provider')
    expect(a.nextStep).toContain(VPS)
  })

  it('explains why SSL cannot simply be retried', () => {
    // Otherwise the answer to "SSL failed" is another click at certbot.
    expect(assessDnsTarget(['127.0.0.1'], VPS).nextStep).toMatch(/Let's Encrypt has to reach the domain/)
  })

  it('a mixed answer with one public address is not treated as loopback', () => {
    expect(assessDnsTarget(['127.0.0.1', VPS], VPS).state).toBe('POINTS_TO_VPS')
  })
})

describe('D · the record does not resolve', () => {
  it('is refused with the record to add', () => {
    const a = assessDnsTarget([], VPS)
    expect(a.state).toBe('UNRESOLVED')
    expect(a.canProvisionSsl).toBe(false)
    expect(a.nextStep).toContain(VPS)
  })
})

describe('an unconfigured VPS_HOST is honest, not permissive', () => {
  it('a public address is allowed through but not called confirmed', () => {
    // Every domain that works today goes through this path; blocking it would
    // break working tenants to fix a broken one.
    const a = assessDnsTarget(['203.0.113.9'], '')
    expect(a.state).toBe('UNVERIFIED')
    expect(a.canProvisionSsl).toBe(true)
    expect(a.pointsToVps).toBe(false)
    expect(a.nextStep).toContain('VPS_HOST')
  })

  it('but loopback is still refused', () => {
    // This is the exact combination that let 127.0.0.1 through.
    expect(assessDnsTarget(['127.0.0.1'], '').canProvisionSsl).toBe(false)
  })
})

describe('the routes no longer wave a bad record through', () => {
  it('the `: true` fallback is gone from both', () => {
    expect(VALIDATE).not.toContain('VPS_IP ? resolved.includes(VPS_IP) : true')
    expect(STATUS).not.toContain('VPS_IP ? addresses.includes(VPS_IP) : true')
  })

  it('both classify through the same shared assessment', () => {
    expect(VALIDATE).toContain("import { assessDnsTarget, dnsLabel } from '@/lib/domain-dns'")
    expect(STATUS).toContain('assessDnsTarget(addresses, VPS_IP)')
    expect(VALIDATE).toContain('assessDnsTarget(resolved, VPS_IP)')
  })

  it('certbot runs only when the record can carry traffic', () => {
    expect(VALIDATE).toContain('if (!dnsCheck.canProvisionSsl) {')
    // The early return happens before prerequisites and before provisioning.
    const gate = VALIDATE.indexOf('if (!dnsCheck.canProvisionSsl)')
    // The CALL, not the declaration — which is defined above the handler.
    const certbot = VALIDATE.indexOf('await verifyPrerequisites()')
    expect(gate).toBeGreaterThan(-1)
    expect(certbot).toBeGreaterThan(gate)
  })

  it('the banner names the real problem instead of "DNS Pending"', () => {
    // "Pending" reads as "still propagating" and sends nobody to their DNS
    // provider, which is the only place this can be fixed.
    expect(VALIDATE).toContain('label: dnsLabel(dnsCheck.state)')
    expect(STATUS).toContain('label:    dnsLabel(dnsCheck.state)')
    expect(dnsLabel('NOT_PUBLIC')).toBe('DNS Not Public')
    expect(dnsLabel('POINTS_ELSEWHERE')).toBe('DNS Points Elsewhere')
  })

  it('the resolved answer is reported, not an invented expectation', () => {
    // The 127.0.0.1 on screen came from public DNS. Nothing here manufactures
    // an address.
    expect(VALIDATE).toContain('resolved = await dns.resolve4(domain)')
    expect(VALIDATE).not.toMatch(/expected:\s*['"]127\.0\.0\.1['"]/)
    expect(STATUS).not.toMatch(/expected:\s*['"]127\.0\.0\.1['"]/)
  })
})

describe('the auto-generated host is a separate hostname', () => {
  it('the custom domain is used when mapped, and the slug host otherwise', () => {
    // Two hostnames for one tenant; fixing one must not disturb the other.
    expect(STATUS).toContain('const domain = business?.domain?.domain || defaultDomain')
    expect(STATUS).toContain('const defaultDomain = `${slug}.${STOREFRONT_BASE}`')
  })
})

describe('certbot is not spent on a host that cannot answer', () => {
  it('the single provisioner checks DNS before issuing', () => {
    // Every product host — storefront, delivery., store., custom domain — is
    // provisioned through this one function, so the guard belongs here rather
    // than at each caller.
    expect(HOSTPROV).toContain('const dnsCheck = assessDnsTarget(')
    expect(HOSTPROV).toContain('if (!dnsCheck.canProvisionSsl) {')
  })

  it('the check sits between the vhost and certbot', () => {
    // The vhost is correct and idempotent, and wants to be in place for the
    // moment the record is fixed; the certificate request is the part that
    // cannot succeed.
    const nginx = HOSTPROV.indexOf('result.nginx = await ensureNginxConfig(host)')
    const gate = HOSTPROV.indexOf('if (!dnsCheck.canProvisionSsl)')
    const certbot = HOSTPROV.indexOf('await runCertbot(host)')
    expect(nginx).toBeLessThan(gate)
    expect(gate).toBeLessThan(certbot)
  })

  it('an existing certificate is still reused without a lookup', () => {
    const existing = HOSTPROV.indexOf('if (await certExists(host))')
    expect(existing).toBeGreaterThan(-1)
    expect(existing).toBeLessThan(HOSTPROV.indexOf('const dnsCheck = assessDnsTarget('))
  })

  it('the refusal carries the actionable message, not a bare failure', () => {
    expect(HOSTPROV).toContain('result.error = dnsCheck.nextStep')
  })
})
