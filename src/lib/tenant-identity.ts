/**
 * Quantix platform — Tenant Identity.
 *
 * ONE derivation of a tenant's identity namespace, shared by every product.
 * Laundry OS, Commerce and anything after them append their own role token to
 * the SAME prefix; none of them may derive a prefix of their own.
 *
 *      Business ─▶ Business Code ─▶ Tenant Prefix ─▶ Employee ID
 *
 * Deliberately free of Prisma and of any product concept — the whole module is
 * pure functions over a string, so it can be tested (and reused) without a
 * database or a Laundry OS import. The persistence half lives in
 * tenant-identity-server.ts.
 *
 * ─── Why the prefix is not "V5" ─────────────────────────────────────────────
 *
 * The requested example derived V5 from VASTRASUDHA + …0005: a letter from the
 * business NAME and a digit from the code. That cannot be used, for two
 * independent reasons:
 *
 *   1. the name is mutable — renaming a business would silently move every
 *      employee into a different namespace, and
 *   2. one letter is not unique — VASTRASUDHA and VXYZ both yield V, which is
 *      exactly the collision the spec forbids.
 *
 * The number in those examples IS the business-code sequence, so the shape is
 * kept and the letter is re-derived from the code's MONTH instead of the name:
 *
 *      BUS-202606-0005  ─▶  8T5      (8T = month 202606, 5 = sequence)
 *      BUS-202606-0012  ─▶  8T12
 *      BUS-202710-0005  ─▶  9F5      ← same sequence, different month, no clash
 *
 * This is injective by construction: the month token is FIXED at two base-36
 * characters, so month and sequence can never blur into each other. Two
 * different Business Codes cannot produce one prefix, and no registry lookup is
 * needed to know that. A business that renames, changes domain, or opens and
 * closes stores keeps the prefix it was born with, because none of those things
 * appear anywhere in this file.
 */

/** Base-36 alphabet, uppercase — unambiguous when typed on a phone keypad. */
const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** Month tokens are two base-36 chars → 1296 months ≈ 108 years from 2000. */
const MONTH_TOKEN_LEN = 2
const MONTH_EPOCH_YEAR = 2000

/**
 * Role namespaces. A product adds its own token here; it does NOT invent a
 * prefix. Laundry OS uses EMP and DL; Commerce can later add COM.
 */
export const EMPLOYEE_NAMESPACES = ["EMP", "DL", "COM"] as const
export type EmployeeNamespace = (typeof EMPLOYEE_NAMESPACES)[number]

/** Sequence digits in an employee id: EMP001, DL001 — widened past 999. */
const SEQ_PAD = 3

export type ParsedBusinessCode = {
  /** The literal code, normalised. */
  code: string
  /** Leading token: BUS for platform businesses, LND for laundry, etc. */
  domain: string
  /** Months since MONTH_EPOCH_YEAR-01 — the stable half of the identity. */
  monthIndex: number
  /** Per-month sequence from the code's tail. */
  sequence: number
}

function toBase36(n: number, width: number): string {
  let out = ""
  let v = Math.max(0, Math.floor(n))
  while (v > 0) { out = B36[v % 36] + out; v = Math.floor(v / 36) }
  return out.padStart(width, "0").slice(-width)
}

/** Cheap, stable, non-cryptographic hash — only for codes we cannot parse. */
function stableHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function normaliseBusinessCode(code: string | null | undefined): string {
  return String(code ?? "").trim().toUpperCase()
}

/**
 * Parse the canonical `XXX-YYYYMM-NNNN` shape.
 *
 * Both live generators produce it — `BUS-{yyyymm}-{pad4}` for platform
 * businesses and `LND-{yyyymm}-{pad4}` for laundry ones — but the sample in the
 * spec is not assumed to be the only possibility: anything that does not parse
 * is handled by the hash fallback rather than rejected.
 */
export function parseBusinessCode(code: string | null | undefined): ParsedBusinessCode | null {
  const c = normaliseBusinessCode(code)
  const m = /^([A-Z]{2,6})-(\d{4})(\d{2})-(\d{1,6})$/.exec(c)
  if (!m) return null
  const [, domain, yyyy, mm, nnnn] = m
  const year = parseInt(yyyy, 10)
  const month = parseInt(mm, 10)
  const sequence = parseInt(nnnn, 10)
  if (month < 1 || month > 12) return null
  if (year < MONTH_EPOCH_YEAR || year > MONTH_EPOCH_YEAR + 107) return null
  if (!Number.isFinite(sequence)) return null
  const monthIndex = (year - MONTH_EPOCH_YEAR) * 12 + (month - 1)
  return { code: c, domain, monthIndex, sequence }
}

export function isValidBusinessCode(code: string | null | undefined): boolean {
  return parseBusinessCode(code) !== null
}

/**
 * The prefix a Business Code deserves, before any collision check.
 *
 * Canonical codes get `{month}{sequence}` — injective, so the persisted
 * registry will only ever confirm it. Unparseable codes get a hashed token,
 * which is deterministic but NOT provably unique; those are the only ones the
 * registry may have to disambiguate.
 */
export function deriveTenantPrefix(code: string | null | undefined): string {
  const parsed = parseBusinessCode(code)
  if (parsed) return `${toBase36(parsed.monthIndex, MONTH_TOKEN_LEN)}${parsed.sequence}`
  const c = normaliseBusinessCode(code)
  if (!c) throw new Error("Business Code is required to derive a tenant prefix")
  // Fixed-width month-shaped token so a fallback prefix can never collide with
  // a canonical one by accident, then a hashed tail.
  return `${toBase36(stableHash(c) % (36 * 36), MONTH_TOKEN_LEN)}X${toBase36(stableHash(`${c}#`) % 46656, 3)}`
}

/**
 * Deterministic candidates, in order, for the same Business Code.
 *
 * The first is deriveTenantPrefix(). Later ones exist only for the fallback
 * path, where two unparseable codes could hash together: attempt N appends a
 * suffix derived from the code itself, so the resolution is a pure function of
 * the code and the set of prefixes already taken — never of insertion order,
 * clock, or row count.
 */
export function tenantPrefixCandidates(code: string | null | undefined, limit = 24): string[] {
  const base = deriveTenantPrefix(code)
  const c = normaliseBusinessCode(code)
  const out = [base]
  for (let i = 1; i < limit; i++) out.push(`${base}${toBase36(stableHash(`${c}@${i}`) % 1296, 2)}`)
  return out
}

/** A prefix is machine-issued; this is what one is allowed to look like. */
export function isValidTenantPrefix(prefix: string): boolean {
  return /^[0-9A-Z]{2}[0-9A-Z]*[0-9]+[0-9A-Z]*$/.test(prefix) && prefix.length >= 3 && prefix.length <= 12
}

/** `8T5` + `EMP` + 1 → `8T5EMP001`. */
export function formatEmployeeId(prefix: string, namespace: EmployeeNamespace, sequence: number): string {
  if (!prefix) throw new Error("Tenant prefix is required")
  if (!EMPLOYEE_NAMESPACES.includes(namespace)) throw new Error(`Unknown namespace: ${namespace}`)
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Sequence must be a positive integer")
  return `${prefix.toUpperCase()}${namespace}${String(sequence).padStart(SEQ_PAD, "0")}`
}

export type ParsedEmployeeId = { prefix: string; namespace: EmployeeNamespace; sequence: number }

/**
 * Split an employee id back into its parts — this is what makes the shared
 * login domain safe: the tenant is read from the identifier BEFORE any password
 * is considered.
 *
 * Unambiguous because a prefix always ends in a digit and every namespace token
 * starts with a letter.
 */
export function parseEmployeeId(id: string | null | undefined): ParsedEmployeeId | null {
  const s = String(id ?? "").trim().toUpperCase()
  const m = new RegExp(`^([0-9A-Z]*[0-9])(${EMPLOYEE_NAMESPACES.join("|")})(\\d{${SEQ_PAD},})$`).exec(s)
  if (!m) return null
  const [, prefix, namespace, seq] = m
  if (!isValidTenantPrefix(prefix)) return null
  const sequence = parseInt(seq, 10)
  if (!Number.isFinite(sequence) || sequence < 1) return null
  return { prefix, namespace: namespace as EmployeeNamespace, sequence }
}

/** Does this string even look like an employee id? Used to route a login. */
export function looksLikeEmployeeId(id: string | null | undefined): boolean {
  return parseEmployeeId(id) !== null
}
