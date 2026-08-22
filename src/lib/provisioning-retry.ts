// ============================================================================
// Provisioning failure classification and retry policy.
//
// A Super Admin should not be the retry loop. Clicking "Provision Workspace"
// again because a socket timed out is work a machine does better, and every
// extra click is a chance to give up on a tenant that was one attempt from
// finishing.
//
// But retrying is only right for failures that might go away. "Product LAUNDRY
// not found" will not go away, and hammering it wastes a minute before showing
// the same message. So failures are split in two, and only one half is retried.
//
// Kept pure and separate from the engine so the policy can be tested for what
// it decides rather than for how the engine is written.
// ============================================================================

export type FailureKind = 'TRANSIENT' | 'PERMANENT'

/** Attempts per step, including the first. */
export const MAX_STEP_ATTEMPTS = 3

/**
 * Backoff before attempt 2 and attempt 3.
 *
 * Deliberately short. Provisioning runs inside the request the admin is
 * waiting on, so the whole retry budget is ~6s per step — long enough to ride
 * out a dropped connection or a busy database, short enough that a genuinely
 * dead dependency fails while they are still looking at the screen.
 */
export const RETRY_BACKOFF_MS = [500, 1500] as const

export function retryDelayMs(attempt: number): number {
  return RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]
}

/**
 * Signals that a failure is worth another attempt: the network, the database
 * being momentarily busy, or a dependency answering 5xx/429.
 *
 * Matched on the message because the failures arrive from fetch, Prisma and
 * product provisioners alike, with no shared error type between them.
 */
const TRANSIENT_PATTERNS: RegExp[] = [
  /\btimed?\s?out\b/i,
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|EPIPE|EHOSTUNREACH|ENETUNREACH/i,
  /socket hang up/i,
  /fetch failed|network (?:error|request failed)/i,
  /temporarily unavailable|service unavailable|try again/i,
  /\b(?:429|502|503|504)\b/,
  /SQLITE_BUSY|database is locked|too many connections|connection pool/i,
  /deadlock/i,
]

/**
 * Failures that are definitely about configuration or state, and would fail the
 * same way three times. Checked FIRST: a message like "plan not found" must not
 * be read as transient because it happens to contain "try again".
 */
const PERMANENT_PATTERNS: RegExp[] = [
  /not found/i,
  /\bis not active\b/i,
  /required|incomplete|missing/i,
  /invalid|malformed/i,
  /already (?:exists|belongs)/i,
  /unique constraint|P2002/i,
  /forbidden|unauthori[sz]ed|permission denied/i,
]

export function classifyProvisioningFailure(error: unknown): FailureKind {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')

  // An aborted request is a timeout by another name.
  if (error instanceof Error && error.name === 'AbortError') return 'TRANSIENT'

  if (PERMANENT_PATTERNS.some((re) => re.test(message))) return 'PERMANENT'
  if (TRANSIENT_PATTERNS.some((re) => re.test(message))) return 'TRANSIENT'

  // Unknown failures are treated as permanent. Retrying something we cannot
  // characterise buys a slower path to the same error, and the admin sees the
  // real message sooner this way.
  return 'PERMANENT'
}

export const isRetryable = (error: unknown): boolean =>
  classifyProvisioningFailure(error) === 'TRANSIENT'
