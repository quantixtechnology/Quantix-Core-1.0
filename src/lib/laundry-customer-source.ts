// ============================================================================
// Customer Sources — the configurable "how did we win this customer" master.
//
// Direct, Sales, Event to begin with, and whatever else a business adds. It is
// NOT the CRM lead-source list: that records how a LEAD arrived (Google Ads,
// Referral…), a different vocabulary answering a different question, and
// merging them would force one business's wording onto both.
//
// It is also NOT Customer.source, which has held channel values (STORE_FRONT,
// WEBSITE_INQUIRY, API…) since long before this existed.
//
// Retiring is deactivation, never deletion: a source that customers already
// carry has to stay readable on their records, so a name in use cannot be
// removed — only stopped from appearing in new dropdowns.
// ============================================================================
import { prisma } from "@/lib/prisma"

/** What a business starts with, in the order they should appear. */
export const DEFAULT_CUSTOMER_SOURCES = [
  { name: "Direct", color: "#0EA5E9" },
  { name: "Sales", color: "#7C3AED" },
  { name: "Event", color: "#F97316" },
] as const

/** The source a customer gets when nobody chooses one. */
export const DEFAULT_CUSTOMER_SOURCE_NAME = "Direct"

export interface CustomerSource {
  id: string
  name: string
  color: string
  displayOrder: number
  active: boolean
}

/**
 * The business's sources, seeding the defaults the first time it asks.
 *
 * Seeding on read rather than at provisioning means businesses created before
 * this feature get their list the moment they open the screen, with no
 * migration and no empty dropdown.
 */
export async function listCustomerSources(businessId: string): Promise<CustomerSource[]> {
  const existing = await prisma.laundryCustomerSource.findMany({
    where: { businessId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, displayOrder: true, active: true },
  })
  if (existing.length > 0) return existing

  await prisma.laundryCustomerSource.createMany({
    data: DEFAULT_CUSTOMER_SOURCES.map((s, i) => ({
      businessId, name: s.name, color: s.color, displayOrder: i,
    })),
  }).catch(() => {
    // A racing request seeded first — its rows are the ones we want anyway.
  })
  return prisma.laundryCustomerSource.findMany({
    where: { businessId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, displayOrder: true, active: true },
  })
}

/** How many customers currently carry this source. */
export async function customerSourceUsage(sourceId: string): Promise<number> {
  return prisma.customer.count({ where: { customerSourceId: sourceId } })
}

/**
 * The id a new customer should get when the caller named no source.
 *
 * Returns null rather than inventing a row: a customer with no source is a
 * truthful record, and a dropdown that silently picks for you is not.
 */
export async function defaultCustomerSourceId(businessId: string): Promise<string | null> {
  const sources = await listCustomerSources(businessId)
  const direct = sources.find((s) => s.active && s.name.toLowerCase() === DEFAULT_CUSTOMER_SOURCE_NAME.toLowerCase())
  return direct?.id ?? sources.find((s) => s.active)?.id ?? null
}
