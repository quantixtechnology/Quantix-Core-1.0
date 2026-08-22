// ============================================================================
// Custom domains — a tenant reached by a name of its own.
//
// A storefront has always been found by taking the slug off the front of
// <slug>.quantixtechnology.in. A customer's own domain has no slug to take, so
// every one of them fell past the storefront branch and rendered the Quantix
// marketing page on the customer's domain — the one page it must never show.
//
// The mapping already exists: DomainMapping.domain holds the exact hostname and
// points at exactly one business. What was missing is a way to reach it, since
// the edge proxy cannot query a database and the browser only knows a hostname.
//
// This module holds the parts of that with no I/O in them, so the rules can be
// tested for what they decide.
// ============================================================================

/** Where the meta tag the server emits is read from on the client. */
export const STOREFRONT_META_NAME = 'x-quantix-storefront'

/** Hosts that are the platform itself, whatever else is true of them. */
function isPlatformHost(host: string, base: string): boolean {
  return host === base || host === `www.${base}` || host === `app.${base}`
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Whether a hostname could be a customer's own domain.
 *
 * Deliberately a NEGATIVE test — everything the platform already owns is
 * excluded and the rest is a candidate — because the proxy runs at the edge
 * with no database and cannot confirm a tenant. "Candidate" is all it can
 * honestly say; the server then resolves it, and a host that maps to nothing
 * falls back to the platform page exactly as it does today.
 *
 * `*.quantixtechnology.in` is excluded because those are already handled by the
 * slug branch; sending them down this path would give one host two routes.
 */
export function isCandidateCustomHost(rawHost: string, base: string): boolean {
  const host = (rawHost || '').split(':')[0].trim().toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (IPV4.test(host) || host.includes(':')) return false      // reached by address, not by name
  if (!host.includes('.')) return false                        // bare label, never a public domain
  if (isPlatformHost(host, base)) return false
  if (host === base || host.endsWith(`.${base}`)) return false // slug hosts own that branch
  return true
}

/**
 * The hostnames to look for in DomainMapping, in order.
 *
 * `www.` is the one alias a custom domain is allowed, because it is the one
 * nginx and certbot already treat as part of the same domain — the vhost is
 * `server_name domain www.domain` and the certificate covers both. Everything
 * else must match exactly: resolving by any looser rule is how one tenant ends
 * up serving another's storefront.
 */
export function customHostCandidates(rawHost: string): string[] {
  const host = (rawHost || '').split(':')[0].trim().toLowerCase()
  if (!host) return []
  if (host.startsWith('www.')) {
    const apex = host.slice(4)
    return apex ? [host, apex] : [host]
  }
  return [host]
}
