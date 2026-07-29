import { db } from "@/lib/db"
import { SCREEN_MODULES } from "@/lib/laundry-rbac-registry"

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

const SCREEN_ICONS: Record<string, string> = {
  "laundry.dashboard": "LayoutDashboard",
  "laundry.orders": "ShoppingBag",
  "laundry.customers": "Users",
  "laundry.subscriptions": "Repeat",
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
  "crm.templates": "SlidersHorizontal",
  "crm.reports": "PieChart",
  "crm.settings": "SlidersHorizontal",
  "processing.console_receive": "Factory",
  "processing.audit_barcode": "Barcode",
  "processing.washing": "Droplets",
  "processing.drying": "Wind",
  "processing.dry_cleaning": "Sparkles",
  "processing.ironing": "Shirt",
  "processing.folding": "Layers",
  "processing.quality_check": "ShieldCheck",
  "processing.packing": "Package",
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

export function defaultNavigationConfig(): DefaultSection[] {
  return [
    {
      name: "Laundry",
      icon: "Shirt",
      expanded: true,
      collapsible: true,
      active: true,
      description: "Core laundry business operations",
      items: [
        { screenKey: "laundry.dashboard", displayName: "Dashboard" },
        { screenKey: "laundry.orders", displayName: "Orders" },
        { screenKey: "laundry.customers", displayName: "Customers" },
        { screenKey: "new-order", displayName: "New Order", icon: "Plus" },
        { screenKey: "garment-lookup", displayName: "Garment Lookup", icon: "Search" },
        { screenKey: "laundry.subscriptions", displayName: "Subscriptions" },
        { screenKey: "laundry.pricing", displayName: "Pricing" },
        { screenKey: "laundry.stores", displayName: "Stores" },
        { screenKey: "laundry.staff", displayName: "Staff" },
        { screenKey: "delivery-executives", displayName: "Delivery Executives", icon: "Bike" },
        { screenKey: "mobile-apps", displayName: "Mobile Apps", icon: "Smartphone" },
        { screenKey: "roles", displayName: "Roles & Permissions", icon: "Shield" },
        { screenKey: "laundry.bags", displayName: "Reusable Bags" },
        { screenKey: "laundry.reports", displayName: "Reports" },
        { screenKey: "laundry.settings", displayName: "Workspace Settings" },
        { screenKey: "laundry.navigation", displayName: "Navigation Manager" },
      ],
    },
    {
      name: "Store Operations",
      icon: "Store",
      expanded: true,
      collapsible: true,
      active: true,
      description: "In-store workflows and queues",
      items: [
        { screenKey: "store_ops.store_audit", displayName: "Store Audit" },
        { screenKey: "store_ops.payment_collection", displayName: "Payment Collection" },
        { screenKey: "store_ops.packing_qr", displayName: "Packing & QR" },
        { screenKey: "store_ops.transit", displayName: "Transit / Dispatch" },
        { screenKey: "store_ops.store_receive", displayName: "Store Receive" },
        { screenKey: "store_ops.ready_for_delivery", displayName: "Ready for Delivery" },
        { screenKey: "dispatch-center", displayName: "Dispatch Center", icon: "Truck" },
        { screenKey: "pickup-bags", displayName: "Assign Bags", icon: "Package" },
        { screenKey: "bag-management", displayName: "Bag Management", icon: "Package" },
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
        { screenKey: "processing.drying", displayName: "Drying" },
        { screenKey: "processing.dry_cleaning", displayName: "Dry Cleaning" },
        { screenKey: "processing.ironing", displayName: "Ironing" },
        { screenKey: "processing.folding", displayName: "Folding" },
        { screenKey: "processing.quality_check", displayName: "Quality Check" },
        { screenKey: "processing.packing", displayName: "Packing" },
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
        { screenKey: "crm.templates", displayName: "Templates" },
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
        { screenKey: "marketing-dashboard", displayName: "Dashboard" },
        { screenKey: "marketing-discounts", displayName: "Discounts" },
        { screenKey: "marketing-coupons", displayName: "Coupons" },
        { screenKey: "marketing-reports", displayName: "Reports" },
        { screenKey: "marketing-loyalty", displayName: "Loyalty Program", comingSoon: true },
        { screenKey: "marketing-membership", displayName: "Membership Levels", comingSoon: true },
        { screenKey: "marketing-credits", displayName: "Promotional Credits", comingSoon: true },
        { screenKey: "marketing-giftcards", displayName: "Gift Cards", comingSoon: true },
        { screenKey: "marketing-referral", displayName: "Referral Program", comingSoon: true },
        { screenKey: "marketing-campaigns", displayName: "Campaigns", comingSoon: true },
        { screenKey: "marketing-cart-recovery", displayName: "Cart Recovery", comingSoon: true },
      ],
    },
  ]
}

export async function ensureNavigationConfig(businessId: string): Promise<void> {
  const existing = await db.laundryNavigation.findUnique({ where: { businessId } })
  if (existing) return

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
}

export function isExtraScreenKey(screenKey: string): boolean {
  return EXTRA_SCREEN_KEYS.has(screenKey)
}

const EXTRA_SCREEN_KEYS = new Set([
  "new-order",
  "garment-lookup",
  "dispatch-center",
  "pickup-scheduler",
  "delivery-assignments",
  "pickup-bags",
  "bag-management",
  "delivery-executives",
  "mobile-apps",
  "roles",
  "payments",
  "order-detail",
  "audit-barcode",
])
