// WHICH BAG DOES THIS GARMENT GO IN — the Sorting question, answered from the
// bag assignment rows that already exist.
//
// One order+service may now need SEVERAL physical bags: a bag fills up and the
// operator adds another. That is modelled entirely by the assignment rows
// LaundryBagAssignment already stores — one row per bag per order, never
// overwritten, each stamped with `assignedAt`. No new entity, no new field, and
// no "full" flag to keep in sync:
//
//   • The ACTIVE bag is the most recently assigned one still open. Adding a bag
//     is what makes the previous one full, which is exactly the physical act —
//     the operator adds a bag BECAUSE the last one filled up. Nothing is ever
//     marked full automatically or silently.
//   • A garment's bag is the one that was active WHEN IT WAS SCANNED, derived by
//     comparing the scan time to `assignedAt`. So garments 1-15 keep bag 1 after
//     bag 2 is added — history cannot be rewritten by a later assignment,
//     because nothing about the earlier rows changes.
//
// Every function here is pure and takes the rows as given, so the same answers
// are produced on the server (the scan response) and on the client (the panel).

/** The only role that answers "which bag are these garments going into". */
const SORTING_PURPOSE = "SORTING"

/** One assignment row, as /orders/[id]/bags returns it. */
export interface SortingBagRow {
  bagNumber: string
  serviceId?: string | null
  serviceName?: string | null
  /** Still carrying this order, as opposed to closed history. */
  open?: boolean
  assignedAt?: string | Date | null
  /** WHY the bag is on the order — PICKUP | SORTING | DELIVERY, or null. */
  purpose?: string | null
}

/**
 * The identity a bag is filed under.
 *
 * Service id when there is one, else the upper-cased name — the same rule the
 * service-aware bag accounting uses, so a bag filed by name on an older order
 * still matches the garment that carries the same service name.
 */
export function serviceKey(id?: string | null, name?: string | null): string {
  return (id && id.trim()) || (name || "").trim().toUpperCase()
}

const time = (v?: string | Date | null): number => {
  if (!v) return 0
  const t = v instanceof Date ? v.getTime() : Date.parse(v)
  return Number.isNaN(t) ? 0 : t
}

/**
 * Every bag carrying this garment's service, oldest first.
 *
 * Closed rows are excluded. A reusable bag is normally RELEASED back to
 * AVAILABLE when Processing receives the order — before Sorting — and the
 * shared reader deliberately returns those rows because other stages need the
 * history. Pointing a Sorting operator at a bag that is back in stock, and
 * possibly already on somebody else's order, would be worse than saying nothing.
 *
 * A bag with no service recorded is a legacy row: it answers only when the order
 * has no service-tagged bag at all, so it can never mask a genuinely missing bag
 * for a second service.
 */
export function bagsForService(bags: SortingBagRow[], serviceId: string | null, serviceName: string | null): SortingBagRow[] {
  // ONLY bags actually being sorted into.
  //
  // A pickup bag, a Sorting bag and a delivery bag are the same row shape, and
  // this used to accept any of them — so an order whose transport bag happened
  // to still be open showed that bag as the one its garments were going into,
  // while an order whose transport bag had been released correctly asked for a
  // new one. Same situation, opposite answers, decided by something with nothing
  // to do with Sorting.
  //
  // A row whose role was never recorded is NOT treated as a Sorting bag. It is
  // still shown to the operator — as an unclassified assignment, which is what
  // it is — but it cannot answer "which bag do these garments go into".
  const live = bags.filter((b) => b.open !== false && b.purpose === SORTING_PURPOSE)
  const want = serviceKey(serviceId, serviceName)
  const ordered = [...live].sort((a, b) => time(a.assignedAt) - time(b.assignedAt))
  if (want) {
    const exact = ordered.filter((b) => serviceKey(b.serviceId, b.serviceName) === want)
    if (exact.length) return exact
  }
  return ordered.filter((b) => !serviceKey(b.serviceId, b.serviceName))
}

/**
 * The bag the NEXT garment of this service goes into — the newest one.
 *
 * Null means this service has no bag yet, which is the BAG REQUIRED prompt.
 */
export function activeBagForService(bags: SortingBagRow[], serviceId: string | null, serviceName: string | null): SortingBagRow | null {
  const list = bagsForService(bags, serviceId, serviceName)
  return list.length ? list[list.length - 1] : null
}

/**
 * The bag that was active at `at` — the bag a garment scanned then went into.
 *
 * Used for history, so a garment sorted into bag 1 still reads bag 1 after bag 2
 * is added. A garment scanned before any bag existed has no answer, and says so
 * rather than borrowing a bag it never went into.
 */
export function bagAtTime(bags: SortingBagRow[], serviceId: string | null, serviceName: string | null, at: string | Date | null): SortingBagRow | null {
  const when = time(at)
  if (!when) return activeBagForService(bags, serviceId, serviceName)
  const eligible = bagsForService(bags, serviceId, serviceName).filter((b) => time(b.assignedAt) <= when)
  return eligible.length ? eligible[eligible.length - 1] : null
}

/** A bag as the operator sees it: its position, its state and what it holds. */
export interface SortingBagView {
  bagNumber: string
  /** 1-based within this service — "Bag 1", "Bag 2". */
  index: number
  /** The newest bag takes the next garment; the earlier ones are full. */
  state: "ACTIVE" | "FULL"
  /** Garments recorded into this bag, derived from the scan times. */
  garments: number
}

/**
 * The bag panel for one service of one order.
 *
 * `scanTimes` are the moments this service's garments were scanned; each is
 * attributed to the bag that was active then, so the counts add up to the
 * garments actually sorted and never shift when a new bag is added.
 */
export function sortingBagViews(
  bags: SortingBagRow[],
  serviceId: string | null,
  serviceName: string | null,
  scanTimes: (string | Date | null)[] = [],
): SortingBagView[] {
  const list = bagsForService(bags, serviceId, serviceName)
  const counts = new Map<string, number>()
  for (const t of scanTimes) {
    const b = bagAtTime(bags, serviceId, serviceName, t)
    if (b) counts.set(b.bagNumber, (counts.get(b.bagNumber) || 0) + 1)
  }
  return list.map((b, i) => ({
    bagNumber: b.bagNumber,
    index: i + 1,
    state: i === list.length - 1 ? "ACTIVE" : "FULL",
    garments: counts.get(b.bagNumber) || 0,
  }))
}

/**
 * The order's OTHER open bags — transport, delivery, or a role never recorded.
 *
 * Shown alongside the Sorting bags so nothing is hidden from the operator, and
 * labelled for what it is. This is the honest half of the fix: the old screen
 * did not hide these rows, it mislabelled them as the Sorting bag.
 */
export function otherBagsOnOrder(bags: SortingBagRow[]): SortingBagRow[] {
  return bags.filter((b) => b.open !== false && b.purpose !== SORTING_PURPOSE)
}
