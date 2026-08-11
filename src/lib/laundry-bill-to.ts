// The BILL TO block, assembled once and free of repeats.
//
// WHY THIS EXISTS: LaundryOrder.pickupAddress is a SNAPSHOT built by
// formatAddressSnapshot(), whose first line is deliberately "Name · Phone".
// That is right for its original purpose — a pickup executive standing at a
// door needs to know who to ask for — but an invoice has already printed the
// customer's name, phone and email immediately above it, so the same identity
// appears twice:
//
//     Mukhtar Khan                    ← customer.name
//     +917350551170                   ← customer.phone
//     mukhtarkhan143@gmail.com        ← customer.email
//     Mukhtar Khan · +917350551170    ← snapshot line 1   (repeat)
//     Bengaluru                       ← addressLine1
//     Bengaluru, Karnataka - 560064   ← city line         (repeats the city)
//
// The snapshot is stored data used by the executive app and by historical
// orders, so it is NOT touched. The repeat is removed where it is created —
// in the invoice's presentation — by dropping snapshot lines that say nothing
// the block has not already said.

/** Compare on meaning, not punctuation: "+91 73505 51170" == "+917350551170". */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s.,·|/\\-]+/g, "")
}

/** Indian mobiles arrive with and without the country code; match either way. */
function phoneKey(s: string): string {
  const digits = s.replace(/\D+/g, "")
  return digits.length > 10 ? digits.slice(-10) : digits
}

function isSameValue(line: string, known: string): boolean {
  if (!line || !known) return false
  if (norm(line) === norm(known)) return true
  // Phones only — two different addresses could share digits otherwise.
  const a = phoneKey(line), b = phoneKey(known)
  return a.length === 10 && a === b
}

export interface BillToCustomer {
  name?: string | null
  phone?: string | null
  email?: string | null
}

export interface BillToBlock {
  /** Always present; falls back to the walk-in label. */
  name: string
  phone: string | null
  email: string | null
  /** Address lines, with anything already stated above removed. */
  addressLines: string[]
}

export const WALK_IN_NAME = "Walk-in Customer"

/**
 * Build the block. Pure — no DOM, no formatting decisions beyond deduplication,
 * so the invoice keeps rendering exactly the same data it does today.
 *
 * @param customer  the order's customer, as the invoice already receives it
 * @param snapshot  LaundryOrder.pickupAddress, unmodified
 */
export function billToBlock(customer: BillToCustomer | null | undefined, snapshot?: string | null): BillToBlock {
  const name = customer?.name?.trim() || WALK_IN_NAME
  const phone = customer?.phone?.trim() || null
  const email = customer?.email?.trim() || null

  // Everything the header has already printed. A snapshot line made up only of
  // these is pure repetition and carries no address information.
  const shown = [customer?.name?.trim(), phone, email].filter(Boolean) as string[]

  const raw = (snapshot || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  const kept: string[] = []
  for (const line of raw) {
    // "Mukhtar Khan · +917350551170" — drop only when EVERY part is already
    // shown. A line like "Mukhtar Khan · Flat 4B" keeps its address content.
    const parts = line.split("·").map((p) => p.trim()).filter(Boolean)
    if (parts.length && parts.every((p) => shown.some((k) => isSameValue(p, k)))) continue

    // Exact repeat of a line already kept.
    if (kept.some((k) => norm(k) === norm(line))) continue

    kept.push(line)
  }

  // "Bengaluru" above "Bengaluru, Karnataka - 560064" is the city said twice.
  // Drop a line wholly contained in a longer sibling. The length floor keeps a
  // genuine short line (a flat number, say) from being swallowed by chance.
  const addressLines = kept.filter((line) => {
    if (norm(line).length < 3) return true
    return !kept.some((other) => other !== line && norm(other).length > norm(line).length && norm(other).includes(norm(line)))
  })

  return { name, phone, email, addressLines }
}

/**
 * Readable Indian mobile: "+917350551170" → "+91 73505 51170". Anything that is
 * not a recognisable 10-digit Indian number is returned untouched, so
 * international and landline numbers are never mangled.
 */
export function formatPhone(phone?: string | null): string | null {
  if (!phone) return null
  const t = phone.trim()
  const digits = t.replace(/\D+/g, "")
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  return t
}
