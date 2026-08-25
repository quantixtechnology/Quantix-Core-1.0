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
 * ─── The prefix ────────────────────────────────────────────────────────────
 *
 *      [Business Initial][Business Number]
 *
 *      VASTRASUDHA          + BUS-202606-0005  ─▶  V5   ─▶ V5EMP001,  V5DL001
 *      Laundry & Drycleaners + BUS-202606-0012 ─▶  L12  ─▶ L12EMP001, L12DL001
 *
 * The initial follows the convention already in the codebase (the generated
 * app icon / website logo use name.trim().charAt(0).toUpperCase()). The number
 * is the Business Code's own sequence — 0005 → 5, 0012 → 12 — never the month,
 * never the padded string, never the full code, never a row id.
 *
 * One consequence, stated plainly: this is NOT collision-free on its own. Two
 * businesses whose names start with the same letter and whose codes carry the
 * same sequence in different months both want V5. That is why the prefix is
 * PERSISTED in TenantIdentity behind a unique index and allocated through
 * tenantPrefixCandidates(): the first tenant to ask keeps V5, a genuine clash
 * deterministically takes V5A1, and neither is ever recomputed afterwards. So a
 * rename cannot move an existing namespace either — the name is read once, when
 * the tenant's prefix is first issued.
 */


/** Business Codes are dated from 2000; anything outside that is not one. */
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

/**
 * The business initial, by the convention already used for generated logos and
 * app icons: the first letter of the name, uppercased. Deliberately not an
 * abbreviation scheme — "Laundry & Drycleaners" is L, nothing cleverer.
 */
export function businessInitial(name: string | null | undefined): string {
  const c = String(name ?? "").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase()
  return c || "Q"
}

/** The Business Code's own sequence: BUS-202606-0005 → 5, …-0012 → 12. */
export function businessNumber(code: string | null | undefined): number | null {
  return parseBusinessCode(code)?.sequence ?? null
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
 * [Business Initial][Business Number].
 *
 * The name supplies one character and the Business Code supplies the number —
 * so the code remains the source of truth for the part that must not repeat
 * within a month, and nothing here reads an email, phone, store, or row id.
 */
export function deriveTenantPrefix(code: string | null | undefined, name: string | null | undefined): string {
  const n = businessNumber(code)
  if (n === null) {
    // No parseable code: still give a stable prefix rather than none, and let
    // the candidate chain below settle any clash.
    return `${businessInitial(name)}0`
  }
  return `${businessInitial(name)}${n}`
}

/**
 * Deterministic allocation order for the same tenant.
 *
 * The first is the natural prefix and is what a tenant gets in practice. The
 * rest exist only for a real clash — same initial, same code sequence — and
 * keep the "ends in a digit" property that lets parseEmployeeId() split an id
 * unambiguously. A natural prefix is [A-Z][0-9]+, so V5A1 can never BE one.
 */
export function tenantPrefixCandidates(code: string | null | undefined, name: string | null | undefined, limit = 24): string[] {
  const base = deriveTenantPrefix(code, name)
  const out = [base]
  for (let i = 1; i < limit; i++) out.push(`${base}A${i}`)
  return out
}

/**
 * The shape a prefix issued by THIS convention has: a letter, then the business
 * number, optionally the clash suffix. Anything else came from a superseded
 * scheme and is safe to correct — a rename never changes the shape, so a tenant
 * legitimately on V5 is never mistaken for one that needs moving.
 */
export function isConventionalPrefix(prefix: string): boolean {
  return /^[A-Z][0-9]+(A[0-9]+)?$/.test(prefix)
}

/** A prefix is machine-issued; this is what one is allowed to look like. */
export function isValidTenantPrefix(prefix: string): boolean {
  // A letter, then at least one digit — V5, L12, and the V5A1 clash form.
  return /^[A-Z][A-Z0-9]*[0-9][A-Z0-9]*$/.test(prefix) && prefix.length >= 2 && prefix.length <= 12
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
