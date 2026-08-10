// GET /api/laundry/search?businessId=&q= — Global Search.
//
// A DISPATCHER, not a search engine. It decides which module owns the query and
// calls that module's OWN endpoint, forwarding the caller's credentials, then
// normalises whatever comes back into one result shape.
//
// Calling the real endpoints rather than re-querying prisma is the whole point:
// a second set of predicates would drift from the module's, and then global
// search and module search would disagree about whether a record exists —
// which is exactly the bug this replaces. It costs one internal hop; it buys
// the guarantee.
//
// It also inherits tenant isolation for free. Every endpoint below already
// scopes to the business and checks permissions, so this adds no new authority
// and cannot widen access: an unauthorised caller is refused by the endpoint it
// is dispatched to.
import { NextResponse } from "next/server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export type SearchType = "ORDER" | "GARMENT" | "CUSTOMER" | "STORE" | "PICKUP_BAG" | "PROCESSING_PACKAGE"

export interface SearchResult {
  type: SearchType
  id: string
  title: string
  subtitle?: string | null
  context?: string | null
  /** Which workspace page opens this record; the client maps it to navigation. */
  page: string
}

/** Per-category cap — the dropdown shows a few, not a report. */
const PER_TYPE = 5

/**
 * Deterministic identifiers, so a pasted code queries ONE module instead of
 * fanning out across six on every keystroke.
 *
 * Free text falls through to the name/number searches, which is why this is a
 * universal search rather than a prefix router.
 */
const isOrderCode = (q: string) => /^ORD-/i.test(q)
const isGarmentCode = (q: string) => /^GAR\d+/i.test(q) || /^ITM-/i.test(q)
const isTransportCode = (q: string) => /^(PB|PKT|PKG|BAG)-/i.test(q)
const isStoreCode = (q: string) => /^STR-/i.test(q)

/** Forward the caller's credentials so each endpoint authorises as it always does. */
function authHeaders(request: Request): HeadersInit {
  const h: Record<string, string> = {}
  const auth = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")
  const biz = request.headers.get("x-business-id")
  if (auth) h.authorization = auth
  if (cookie) h.cookie = cookie
  if (biz) h["x-business-id"] = biz
  return h
}

async function getJson(url: string, request: Request): Promise<any> {
  try {
    const res = await fetch(url, { headers: authHeaders(request), cache: "no-store" })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("application/json")) return null
    return await res.json()
  } catch {
    // One module being unavailable must not fail the whole search.
    return null
  }
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const businessId = sp.get("businessId")
  const q = (sp.get("q") || "").trim()

  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  // Two characters is the shortest query worth a round trip.
  if (q.length < 2) return NextResponse.json({ success: true, data: [] })

  // The dispatcher itself is gated, so it cannot be used to probe a tenant it
  // has no access to even before the downstream endpoints are consulted.
  const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
  if (!guard.ok) return guard.res

  const origin = new URL(request.url).origin
  const biz = encodeURIComponent(businessId)
  const term = encodeURIComponent(q)
  const results: SearchResult[] = []

  // ── Garment: GAR / ITM go to the Garment Lookup backend, untouched. ──────
  if (isGarmentCode(q)) {
    const j = await getJson(`${origin}/api/laundry/scan?barcode=${term}`, request)
    if (j?.success && j.data?.item) {
      const d = j.data
      results.push({
        type: "GARMENT",
        id: d.item.id,
        title: d.item.garmentScanCode || d.item.barcode || d.item.itemNumber,
        subtitle: [d.item.garmentName, d.item.serviceName, d.item.stageLabel].filter(Boolean).join(" · "),
        context: d.customer?.name || d.order?.orderNumber || null,
        page: "garment-lookup",
      })
    }
    return NextResponse.json({ success: true, data: results })
  }

  // ── Transport codes resolve through the transport engine. ────────────────
  if (isTransportCode(q)) {
    const j = await getJson(`${origin}/api/laundry/transport/resolve?businessId=${biz}&code=${term}`, request)
    const o = j?.data?.order ?? j?.order ?? null
    if (o?.id) {
      results.push({
        type: /^PB-|^BAG-/i.test(q) ? "PICKUP_BAG" : "PROCESSING_PACKAGE",
        id: o.id,
        title: q.toUpperCase(),
        subtitle: o.orderNumber ? `Order ${o.orderNumber}` : null,
        context: o.status || null,
        page: "order-detail",
      })
    }
    return NextResponse.json({ success: true, data: results })
  }

  // ── Stores: matched locally against the tenant's own store list. ─────────
  if (isStoreCode(q) || !isOrderCode(q)) {
    const j = await getJson(`${origin}/api/laundry/businesses/${biz}/stores`, request)
    const stores: any[] = j?.data ?? j?.stores ?? (Array.isArray(j) ? j : [])
    const needle = q.toLowerCase()
    for (const s of stores.filter((s) => `${s.storeName ?? ""} ${s.storeCode ?? ""}`.toLowerCase().includes(needle)).slice(0, PER_TYPE)) {
      results.push({
        type: "STORE",
        id: s.id,
        title: s.storeName || s.storeCode,
        subtitle: s.storeCode || null,
        context: [s.city, s.state].filter(Boolean).join(", ") || null,
        page: "stores",
      })
    }
  }

  // ── Orders. This one endpoint already covers order number, customer name,
  //    customer mobile AND transport identifiers, so free text reaches orders
  //    through exactly the predicate the Orders page uses. ───────────────────
  const orders = await getJson(`${origin}/api/laundry/orders?businessId=${biz}&search=${term}&limit=${PER_TYPE}`, request)
  for (const o of (orders?.data ?? []).slice(0, PER_TYPE)) {
    const money = typeof o.grandTotal === "number" ? `₹${o.grandTotal}` : null
    results.push({
      type: "ORDER",
      id: o.id,
      title: o.orderNumber,
      subtitle: [o.customer?.name, money, o.status].filter(Boolean).join(" · "),
      context: o.store?.storeName || null,
      page: "order-detail",
    })
  }

  // ── Customers, for names and mobile numbers. ─────────────────────────────
  if (!isOrderCode(q)) {
    const j = await getJson(`${origin}/api/laundry/customers/search?businessId=${biz}&q=${term}`, request)
    for (const c of (j?.data ?? []).slice(0, PER_TYPE)) {
      results.push({
        type: "CUSTOMER",
        id: c.id,
        title: c.name,
        subtitle: c.phone || c.mobile || null,
        context: c.customerCode || null,
        page: "customers",
      })
    }
  }

  return NextResponse.json({ success: true, data: results })
}
