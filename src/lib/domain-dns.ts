// ============================================================================
// What a custom domain's A record actually points at.
//
// Domain validation asked one question — "does the answer contain our IP?" —
// and answered `true` whenever VPS_HOST was not configured:
//
//     dnsActive = VPS_IP ? resolved.includes(VPS_IP) : true
//
// So a domain parked on 127.0.0.1 by its registrar read as DNS ✓, and the
// pipeline went on to run certbot against a name Let's Encrypt can never reach.
// The certificate failed, the storefront refused connections, and the one fact
// that explained all of it — the A record is loopback — was displayed as if it
// were fine.
//
// A loopback or private address is wrong no matter what our IP is, and that
// judgement needs no configuration to make. Kept pure so it can be tested for
// what it decides, and shared so the two validation routes cannot drift.
// ============================================================================

export type DnsState =
  /** A: resolves to the production VPS. The only state SSL may proceed from. */
  | 'POINTS_TO_VPS'
  /** B: resolves to a public address that is not ours. */
  | 'POINTS_ELSEWHERE'
  /** C: 127.0.0.1, a private range, or another address no client can reach. */
  | 'NOT_PUBLIC'
  /** D: no A record at all. */
  | 'UNRESOLVED'
  /**
   * Resolves to a public address, but VPS_HOST is not configured so there is
   * nothing to compare it against. Deliberately NOT an error: this is how the
   * platform has been running, and every domain that currently works does so
   * through this path. It is reported as unverified rather than confirmed.
   */
  | 'UNVERIFIED'

export interface DnsAssessment {
  state: DnsState
  resolved: string[]
  expected: string
  /** True only for POINTS_TO_VPS — the record is confirmed correct. */
  pointsToVps: boolean
  /** Whether SSL provisioning may be attempted. */
  canProvisionSsl: boolean
  /** What the operator should do next. Empty when there is nothing to do. */
  nextStep: string
}

/**
 * Addresses that cannot serve a public customer domain, whatever our IP is.
 *
 * 127.0.0.1 is the one that matters here: several Indian registrars park a
 * newly registered domain on loopback, so the record exists, resolves, and
 * points nowhere.
 */
export function isNonPublicAddress(ip: string): boolean {
  const p = ip.trim().split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    // Not dotted-quad IPv4 — ::1 is the only loopback worth naming here.
    return ip.trim() === '::1'
  }
  const [a, b] = p
  return (
    a === 127 ||                        // loopback
    a === 0 ||                          // "this network"
    a === 10 ||                         // private
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) ||         // private
    (a === 169 && b === 254) ||         // link-local
    a >= 224                            // multicast / reserved
  )
}

export function assessDnsTarget(resolved: string[], vpsIp: string): DnsAssessment {
  const expected = vpsIp || ''
  const base = { resolved, expected }

  if (resolved.length === 0) {
    return {
      ...base, state: 'UNRESOLVED', pointsToVps: false, canProvisionSsl: false,
      nextStep: expected
        ? `The domain has no A record. Add: @ → ${expected} (and www → ${expected}).`
        : 'The domain has no A record. Point it at the production server IP.',
    }
  }

  // Checked before any comparison: loopback is wrong even if it somehow
  // matched, and it is the single most useful thing to say.
  if (resolved.every(isNonPublicAddress)) {
    return {
      ...base, state: 'NOT_PUBLIC', pointsToVps: false, canProvisionSsl: false,
      nextStep:
        `The domain resolves to ${resolved.join(', ')}, which is not a public address — ` +
        `this is the placeholder record registrars leave on a new domain. ` +
        `Replace the A record at your DNS provider with ${expected || 'the production server IP'}. ` +
        `SSL cannot be issued until then: Let's Encrypt has to reach the domain from the internet.`,
    }
  }

  if (!expected) {
    return {
      ...base, state: 'UNVERIFIED', pointsToVps: false, canProvisionSsl: true,
      nextStep: `Resolves to ${resolved.join(', ')}. Set VPS_HOST to verify this is the production server.`,
    }
  }

  if (resolved.includes(expected)) {
    return { ...base, state: 'POINTS_TO_VPS', pointsToVps: true, canProvisionSsl: true, nextStep: '' }
  }

  return {
    ...base, state: 'POINTS_ELSEWHERE', pointsToVps: false, canProvisionSsl: false,
    nextStep:
      `The domain resolves to ${resolved.join(', ')} but the production server is ${expected}. ` +
      `Update the A record to ${expected} (and www → ${expected}).`,
  }
}

/** Short label for the deployment banner. */
export function dnsLabel(state: DnsState): string {
  switch (state) {
    case 'POINTS_TO_VPS':    return 'DNS Correct'
    case 'POINTS_ELSEWHERE': return 'DNS Points Elsewhere'
    case 'NOT_PUBLIC':       return 'DNS Not Public'
    case 'UNRESOLVED':       return 'DNS Pending'
    case 'UNVERIFIED':       return 'DNS Unverified'
  }
}
