// ============================================================================
// Asking more than one resolver.
//
// `dns.resolve4` uses whatever resolver the server is configured with, and
// that resolver caches. Right after a record changes it can hold the old
// answer for the remaining TTL — so validation run from the VPS reported
// 127.0.0.1 for a domain the customer had already repointed, and the screen
// told them to change DNS they had just fixed.
//
// Public resolvers are queried alongside it. Agreement is the useful signal:
// all of them on the new address means done, some of them means propagating,
// none of them means the record really is wrong.
//
// Kept apart from domain-dns.ts so the decision stays pure and testable and
// only the network lives here.
// ============================================================================
import { Resolver } from 'dns/promises'

/** Well-known public resolvers, deliberately from different operators. */
const PUBLIC_RESOLVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9']

const LOOKUP_TIMEOUT_MS = 4000

async function resolveVia(server: string | null, host: string): Promise<string[]> {
  const r = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 })
  if (server) r.setServers([server])
  try {
    return await r.resolve4(host)
  } catch {
    // No answer from this resolver is not the same as no record — it is one
    // vote missing, and the caller counts only the resolvers that answered.
    return []
  }
}

export interface HostResolution {
  host: string
  /** One entry per resolver that was asked, in order; empty means no answer. */
  answersByResolver: string[][]
  /** Every distinct address any resolver returned. */
  union: string[]
}

/** Resolve one hostname through the system resolver and the public ones. */
export async function resolveAcrossResolvers(host: string): Promise<HostResolution> {
  const answersByResolver = await Promise.all([
    resolveVia(null, host),
    ...PUBLIC_RESOLVERS.map((s) => resolveVia(s, host)),
  ])
  return {
    host,
    answersByResolver,
    union: Array.from(new Set(answersByResolver.flat())),
  }
}
