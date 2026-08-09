import { db } from "@/lib/db"
import { SCREEN_MODULES, isScreenAccessible } from "@/lib/laundry-rbac-registry"

/**
 * Default navigation sections and screen keys for a Quantix Laundry business.
 * This is seeded when a business first accesses navigation.
 */
export interface DefaultSection {
  name: string
  icon: string
  expanded: boolean
  collapsible: boolean
  active: boolean
  description?: string
  items: { screenKey: string; displayName?: string; icon?: string; badge?: string; comingSoon?: boolean; hidden?: boolean }[]
}

/**
 * Single source of truth for screenKey → page route mapping.
 * Both sidebar.tsx and page-router.tsx consume this. Every key is a registered
 * SCREEN_MODULES screen key — no standalone/alias keys exist anymore.
 */
export const SCREEN_PAGE_MAP: Record<string, string> = {
  "laundry.dashboard": "dashboard",
  "laundry.orders": "orders",
  "laundry.new_order": "new-order",
  "laundry.customers": "customers",
  "laundry.garment_lookup": "garment-lookup",
  "laundry.subscriptions": "subscriptions",
  "laundry.subscription_plans": "subscription-plans",
  "laundry.charges_rules": "charges-rules",
  "laundry.pricing_simulator": "pricing-simulator",
  "laundry.services": "services",
  "laundry.categories": "categories",
  "laundry.garments": "garments",
  "laundry.pricing": "pricing",
  "laundry.stores": "stores",
  "laundry.staff": "staff",
  "laundry.bags": "bag-management",
  "laundry.reports": "reports",
  "laundry.settings": "settings",
  "laundry.navigation": "navigation",
  "laundry.order_detail": "order-detail",
  "laundry.inbox": "inbox",
  "laundry.delivery_executives": "delivery-executives",
  "laundry.mobile_apps": "mobile-apps",
  "laundry.roles": "roles",
  "crm.dashboard": "crm-dashboard",
  "crm.leads": "crm-leads",
  "crm.opportunity": "crm-opportunities",
  "crm.activities": "crm-activities",
  "crm.pipeline": "crm-tasks",
  "crm.reports": "crm-reports",
  "crm.settings": "crm-settings",
  "processing.console_receive": "processing-centers",
  "processing.audit_barcode": "audit-barcode",
  "processing.washing": "ws-wash",
  "processing.dry_cleaning": "ws-dryclean",
  "processing.ironing": "ws-iron",
  "processing.folding": "ws-fold",
  "processing.quality_check": "ws-qc",
  "processing.sorting": "ws-sorting",
  "processing.transit": "ws-transit",
  "store_ops.store_audit": "audit-queue",
  "store_ops.payment_collection": "payment-queue",
  "store_ops.packing_qr": "packing-queue",
  "store_ops.transit": "dispatch-queue",
  "store_ops.store_receive": "store-receive-queue",
  "store_ops.ready_for_delivery": "ready-delivery-queue",
  "store_ops.pickup_scheduler": "pickup-scheduler",
  "store_ops.pickup_bags": "pickup-bags",
  "store_ops.dispatch_center": "dispatch-center",
  "store_ops.delivery_assignments": "delivery-assignments",
  "store_ops.bag_management": "bag-management",
  "marketing.dashboard": "marketing-dashboard",
  "marketing.discounts": "marketing-discounts",
  "marketing.coupons": "marketing-coupons",
  "marketing.reports": "marketing-reports",
  "marketing.loyalty": "marketing-loyalty",
  "marketing.membership": "marketing-membership",
  "marketing.credits": "marketing-credits",
  "marketing.giftcards": "marketing-giftcards",
  "marketing.referral": "marketing-referral",
  "marketing.campaigns": "marketing-campaigns",
  "marketing.cart_recovery": "marketing-cart-recovery",
}

const SCREEN_ICONS: Record<string, string> = {
  "laundry.dashboard": "LayoutDashboard",
  "laundry.orders": "ShoppingBag",
  "laundry.customers": "Users",
  "laundry.subscriptions": "Repeat",
  "laundry.services": "Tags",
  "laundry.categories": "Tags",
  "laundry.garments": "Shirt",
  "laundry.pricing": "IndianRupee",
  "laundry.stores": "Store",
  "laundry.staff": "UsersRound",
  "laundry.bags": "Package",
  "laundry.reports": "BarChart3",
  "laundry.settings": "Settings",
  "laundry.navigation": "Menu",
  "crm.dashboard": "Gauge",
  "crm.leads": "UsersRound",
  "crm.opportunity": "Target",
  "crm.activities": "ClipboardList",
  "crm.pipeline": "CheckSquare",
  "crm.reports": "PieChart",
  "crm.settings": "SlidersHorizontal",
  "processing.console_receive": "Factory",
  "processing.audit_barcode": "Barcode",
  "processing.washing": "Droplets",
  "processing.dry_cleaning": "Sparkles",
  "processing.ironing": "Shirt",
  "processing.folding": "Layers",
  "processing.quality_check": "ShieldCheck",
  "processing.sorting": "ListChecks",
  "processing.transit": "Truck",
  "store_ops.store_audit": "ClipboardCheck",
  "store_ops.payment_collection": "CreditCard",
  "store_ops.packing_qr": "Barcode",
  "store_ops.transit": "Truck",
  "store_ops.store_receive": "PackageCheck",
  "store_ops.ready_for_delivery": "CheckCheck",
  "customer_app.customers": "Users",
  "customer_app.invitation": "UserPlus",
  "customer_app.subscription": "Repeat",
  "customer_app.orders": "ShoppingBag",
  "marketing.dashboard": "LayoutDashboard",
  "marketing.discounts": "BadgePercent",
  "marketing.coupons": "Ticket",
  "marketing.reports": "BarChart3",
  "marketing.loyalty": "Gift",
  "marketing.membership": "Crown",
  "marketing.credits": "Coins",
  "marketing.giftcards": "Gift",
  "marketing.referral": "UserPlus",
  "marketing.campaigns": "Megaphone",
  "marketing.cart_recovery": "ShoppingCart",
}

export function screenDisplayName(screenKey: string): string {
  for (const m of SCREEN_MODULES) {
    for (const s of m.screens) {
      if (`${m.key}.${s.key}` === screenKey) return s.label
    }
  }
  return screenKey.split(".").pop()?.replace(/_/g, " ")?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? screenKey
}

export function screenIcon(screenKey: string): string {
  return SCREEN_ICONS[screenKey] ?? "Circle"
}

/**
 * All page routes the current RBAC session may open, in navigation order
 * (default navigation registry, section order then item order). Used to
 * validate that the active page is permitted.
 */
export function accessibleLaundryPages(
  screenLevels: Record<string, number>,
  isOwner: boolean,
): Set<string> {
  const pages = new Set<string>()
  for (const section of defaultNavigationConfig()) {
    if (!section.active) continue
    for (const item of section.items) {
      if (item.hidden || item.comingSoon) continue
      const page = SCREEN_PAGE_MAP[item.screenKey]
      if (page && isScreenAccessible(screenLevels, isOwner, item.screenKey)) pages.add(page)
    }
  }
  return pages
}

const PAGE_SCREEN_KEYS: Record<string, string[]> = Object.entries(SCREEN_PAGE_MAP).reduce(
  (acc, [screenKey, page]) => {
    acc[page] = acc[page] ?? []
    acc[page].push(screenKey)
    return acc
  }, {} as Record<string, string[]>,
)

export function resolveLaundryScreenKeys(page: string): string[] {
  return PAGE_SCREEN_KEYS[page] ?? []
}

export function isLaundryPageAccessible(
  screenLevels: Record<string, number>,
  isOwner: boolean,
  page: string,
): boolean {
  const screenKeys = resolveLaundryScreenKeys(page)
  return screenKeys.some((screenKey) => isScreenAccessible(screenLevels, isOwner, screenKey))
}

/**
 * The workspace landing page for the current RBAC session: the FIRST
 * accessible page in navigation order (permission registry + navigation
 * registry). Falls back to the dashboard only when nothing is navigable.
 *
 * Examples (no role names hardcoded):
 *   • CRM-only session → "crm-dashboard"
 *   • processing-only session → "processing-centers" (Console & Receive)
 *   • dispatch-only session → "dispatch-center"
 *   • owner / viewer-with-dashboard → "dashboard"
 */
export function resolveLaundryLandingPage(
  screenLevels: Record<string, number>,
  isOwner: boolean,
): string {
  for (const section of defaultNavigationConfig()) {
    if (!section.active) continue
    for (const item of section.items) {
      if (item.hidden || item.comingSoon) continue
      const page = SCREEN_PAGE_MAP[item.screenKey]
      if (page && isScreenAccessible(screenLevels, isOwner, item.screenKey)) return page
    }
  }
  return "dashboard"
}

export function defaultNavigationConfig(): DefaultSection[] {
  return [
    {
      name: "Operations",
      icon: "Shirt",
      expanded: true,
      collapsible: true,
      active: true,
      description: "Core business operations",
      items: [
        { screenKey: "laundry.dashboard", displayName: "Dashboard" },
        { screenKey: "laundry.customers", displayName: "Customers" },
        { screenKey: "laundry.orders", displayName: "Orders" },
        { screenKey: "laundry.new_order", displayName: "New Order", icon: "Plus" },
        { screenKey: "laundry.garment_lookup", displayName: "Garment Lookup", icon: "Search" },
        { screenKey: "laundry.subscriptions", displayName: "Subscriptions" },
        { screenKey: "laundry.services", displayName: "Services" },
        { screenKey: "laundry.categories", displayName: "Categories" },
        { screenKey: "laundry.garments", displayName: "Garments" },
        { screenKey: "laundry.pricing", displayName: "Pricing" },
        { screenKey: "laundry.stores", displayName: "Stores" },
        { screenKey: "laundry.bags", displayName: "Reusable Bags" },
        // Field staff are an OPERATIONS concern, not back-office administration.
        { screenKey: "laundry.delivery_executives", displayName: "Delivery Executives", icon: "Bike" },
        { screenKey: "laundry.reports", displayName: "Reports" },
      ],
    },
    {
      name: "Store Workflow",
      icon: "Store",
      expanded: true,
      collapsible: true,
      active: true,
      description: "In-store workflows and queues",
      items: [
        { screenKey: "store_ops.store_audit", displayName: "Store Audit" },
        { screenKey: "store_ops.payment_collection", displayName: "Payment Collection" },
        { screenKey: "store_ops.pickup_scheduler", displayName: "Pickup Scheduler", icon: "Calendar" },
        { screenKey: "store_ops.pickup_bags", displayName: "Assign Bags", icon: "Package" },
        { screenKey: "store_ops.packing_qr", displayName: "Packing & QR" },
        { screenKey: "store_ops.transit", displayName: "Transit / Dispatch" },
        { screenKey: "store_ops.store_receive", displayName: "Store Receive" },
        { screenKey: "store_ops.dispatch_center", displayName: "Dispatch Center", icon: "Truck" },
        { screenKey: "store_ops.ready_for_delivery", displayName: "Ready for Delivery" },
        { screenKey: "store_ops.delivery_assignments", displayName: "Delivery", icon: "Bike" },
        { screenKey: "store_ops.bag_management", displayName: "Bag Management", icon: "Package" },
      ],
    },
    {
      name: "Processing Center",
      icon: "Factory",
      expanded: true,
      collapsible: true,
      active: true,
      description: "Garment processing workstations",
      items: [
        { screenKey: "processing.console_receive", displayName: "Console & Receive" },
        { screenKey: "processing.audit_barcode", displayName: "Barcode Generation" },
        { screenKey: "processing.washing", displayName: "Washing" },
        { screenKey: "processing.dry_cleaning", displayName: "Dry Cleaning" },
        { screenKey: "processing.quality_check", displayName: "Dry & Quality Check" },
        { screenKey: "processing.sorting", displayName: "Sorting" },
        { screenKey: "processing.ironing", displayName: "Ironing" },
        { screenKey: "processing.folding", displayName: "Folding" },
        { screenKey: "processing.transit", displayName: "Transit" },
      ],
    },
    {
      name: "CRM",
      icon: "Gauge",
      expanded: true,
      collapsible: true,
      active: true,
      description: "Customer relationship management",
      items: [
        { screenKey: "crm.dashboard", displayName: "Dashboard" },
        { screenKey: "crm.leads", displayName: "Leads" },
        { screenKey: "crm.opportunity", displayName: "Opportunity" },
        { screenKey: "crm.activities", displayName: "Activities" },
        { screenKey: "crm.pipeline", displayName: "Pipeline" },
        { screenKey: "crm.settings", displayName: "Settings" },
        { screenKey: "crm.reports", displayName: "Reports" },
      ],
    },
    {
      name: "Marketing",
      icon: "Megaphone",
      expanded: true,
      collapsible: true,
      active: false,
      description: "Marketing and promotions",
      items: [
        { screenKey: "marketing.dashboard", displayName: "Dashboard" },
        { screenKey: "marketing.discounts", displayName: "Discounts" },
        { screenKey: "marketing.coupons", displayName: "Coupons" },
        { screenKey: "marketing.reports", displayName: "Reports" },
        { screenKey: "marketing.loyalty", displayName: "Loyalty Program", comingSoon: true },
        { screenKey: "marketing.membership", displayName: "Membership Levels", comingSoon: true },
        { screenKey: "marketing.credits", displayName: "Promotional Credits", comingSoon: true },
        { screenKey: "marketing.giftcards", displayName: "Gift Cards", comingSoon: true },
        { screenKey: "marketing.referral", displayName: "Referral Program", comingSoon: true },
        { screenKey: "marketing.campaigns", displayName: "Campaigns", comingSoon: true },
        { screenKey: "marketing.cart_recovery", displayName: "Cart Recovery", comingSoon: true },
      ],
    },
    {
      name: "Administration",
      icon: "Settings",
      expanded: true,
      collapsible: true,
      active: true,
      description: "Business administration and configuration",
      items: [
        { screenKey: "laundry.staff", displayName: "Staff" },
        { screenKey: "laundry.roles", displayName: "Roles & Permissions", icon: "Shield" },
        { screenKey: "laundry.mobile_apps", displayName: "Mobile Apps", icon: "Smartphone" },
        { screenKey: "laundry.settings", displayName: "Workspace Settings" },
        { screenKey: "laundry.navigation", displayName: "Navigation Manager" },
      ],
    },
  ]
}

/**
 * Move Delivery Executives out of Administration and into Operations for a
 * tenant that was seeded before the change. `ensureNavigationConfig` returns
 * early once a nav row exists, so a change to the defaults alone would only
 * ever reach NEW businesses.
 *
 * Deliberately conservative: it moves the item ONLY while it is still sitting
 * in the Administration section — i.e. untouched from the old default. If an
 * admin has already placed it somewhere via Navigation Manager, that choice is
 * left alone. Idempotent, so it is safe to run on every nav read.
 */
async function migrateDeliveryExecutivesToOperations(navigationId: string): Promise<void> {
  const item = await db.laundryNavItem.findFirst({
    where: { navigationId, screenKey: "laundry.delivery_executives" },
    include: { section: { select: { id: true, name: true } } },
  }).catch(() => null)
  if (!item || item.section?.name !== "Administration") return

  const operations = await db.laundryNavSection.findFirst({
    where: { navigationId, name: "Operations" }, select: { id: true },
  })
  if (!operations) return

  const last = await db.laundryNavItem.aggregate({
    where: { sectionId: operations.id }, _max: { order: true },
  })
  await db.laundryNavItem.update({
    where: { id: item.id },
    data: { sectionId: operations.id, order: (last._max.order ?? -1) + 1 },
  }).catch(() => null)
}

export async function ensureNavigationConfig(businessId: string): Promise<void> {
  const existing = await db.laundryNavigation.findUnique({ where: { businessId } })
  if (existing) {
    await migrateDeliveryExecutivesToOperations(existing.id)
    return
  }

  await db.$transaction(async (tx) => {
    const recheck = await tx.laundryNavigation.findUnique({ where: { businessId } })
    if (recheck) return

    const defaults = defaultNavigationConfig()
    const nav = await tx.laundryNavigation.create({ data: { businessId } })

    for (let si = 0; si < defaults.length; si++) {
      const sec = defaults[si]
      const section = await tx.laundryNavSection.create({
        data: {
          navigationId: nav.id,
          name: sec.name,
          icon: sec.icon,
          description: sec.description ?? null,
          order: si,
          expanded: sec.expanded,
          collapsible: sec.collapsible,
          active: sec.active,
        },
      })

      await tx.laundryNavItem.createMany({
        data: sec.items.map((item, ii) => ({
          navigationId: nav.id,
          sectionId: section.id,
          screenKey: item.screenKey,
          displayName: item.displayName ?? screenDisplayName(item.screenKey),
          icon: item.icon ?? screenIcon(item.screenKey),
          order: ii,
          active: true,
          hidden: item.hidden ?? false,
          badge: item.badge ?? null,
          comingSoon: item.comingSoon ?? false,
        })),
      })
    }
  })

  await convergeProcessingNav(businessId)
}

// Processing Center convergence under the approved operational model:
//   • "Dry & Quality Check" (processing.quality_check) is the SINGLE merged
//     workstation. The obsolete processing.drying key was removed from the
//     registry entirely — any residual nav item is deleted, not hidden.
//   • Sorting (processing.sorting) and Transit (processing.transit) are the new
//     garment→bag transition and the dispatch terminal — added if missing.
//   • The garment Packing workstation (processing.packing) was removed from the
//     Processing Center nav (Packing & QR lives under Store Operations); the
//     obsolete key is deleted, not hidden.
const PROCESSING_LEGACY = new Set(["processing.drying", "processing.packing"])
const PROCESSING_APPROVED = ["processing.sorting", "processing.transit"] as const

/** Idempotently converge an existing business's stored navigation so operators
 *  see exactly ONE "Dry & Quality Check" workstation, no garment Packing screen,
 *  and the Sorting + Transit workstations. Obsolete nav items (drying/packing)
 *  are deleted — they no longer exist in the registry. No other nav items are
 *  touched. */
export async function convergeProcessingNav(businessId: string): Promise<void> {
  const nav = await db.laundryNavigation.findUnique({ where: { businessId }, select: { id: true } })
  if (!nav) return

  // Delete obsolete Processing Center nav items entirely (registry no longer
  // defines them, so they can never render and must not linger in the cache).
  await db.laundryNavItem.deleteMany({
    where: { navigationId: nav.id, screenKey: { in: [...PROCESSING_LEGACY] } },
  }).catch(() => null)

  const items = await db.laundryNavItem.findMany({
    where: { navigationId: nav.id, screenKey: "processing.quality_check" },
    select: { id: true, screenKey: true, hidden: true, displayName: true },
  })

  const writes: { id: string; hidden: boolean; displayName: string | null }[] = []
  for (const it of items) {
    let hidden = it.hidden
    let displayName = it.displayName
    if (it.screenKey === "processing.quality_check") { hidden = false; displayName = "Dry & Quality Check" }
    if (hidden !== it.hidden || displayName !== it.displayName) writes.push({ id: it.id, hidden, displayName })
  }
  await Promise.all(writes.map((w) => db.laundryNavItem.update({
    where: { id: w.id },
    data: { hidden: w.hidden, displayName: w.displayName },
  }).catch(() => null)))

  // Add Sorting + Transit to the Processing Center section when absent (older
  // businesses seeded before these screens existed). Idempotent.
  const existingKeys = await db.laundryNavItem.findMany({
    where: { navigationId: nav.id, screenKey: { in: [...PROCESSING_APPROVED] } },
    select: { screenKey: true },
  })
  const have = new Set(existingKeys.map((i) => i.screenKey))
  const toAdd = PROCESSING_APPROVED.filter((k) => !have.has(k))
  if (toAdd.length === 0) return

  const section = await db.laundryNavSection.findFirst({
    where: { navigationId: nav.id, name: "Processing Center" },
    select: { id: true },
  })
  if (!section) return
  const maxOrder = await db.laundryNavItem.aggregate({
    where: { navigationId: nav.id, sectionId: section.id },
    _max: { order: true },
  })
  let order = (maxOrder._max.order ?? -1) + 1
  await db.laundryNavItem.createMany({
    data: toAdd.map((k) => ({
      navigationId: nav.id,
      sectionId: section.id,
      screenKey: k,
      displayName: k === "processing.sorting" ? "Sorting" : "Transit",
      icon: k === "processing.sorting" ? "ListChecks" : "Truck",
      order: order++,
      active: true,
      hidden: false,
    })),
  })
}

export function validateNavSections(sections: { name: string; items: { screenKey: string; displayName?: string }[] }[]): string | null {
  for (const section of sections) {
    if (!section.name?.trim()) return "A section has an empty name."
    const seen = new Set<string>()
    for (const item of section.items) {
      if (!item.screenKey?.trim()) return `"${section.name}" contains an item without a screen key.`
      if (seen.has(item.screenKey)) return `"${item.displayName ?? item.screenKey}" (${item.screenKey}) appears twice in "${section.name}".`
      seen.add(item.screenKey)
    }
  }
  const globalKeys = new Map<string, string>()
  for (const section of sections) {
    for (const item of section.items) {
      if (globalKeys.has(item.screenKey)) {
        return `"${item.displayName ?? item.screenKey}" is in both "${globalKeys.get(item.screenKey)}" and "${section.name}".`
      }
      globalKeys.set(item.screenKey, section.name)
    }
  }
  return null
}
