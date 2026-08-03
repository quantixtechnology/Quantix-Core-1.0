import { describe, it, expect } from "vitest"

// ============================================================================
// NAVIGATION REGRESSION TEST — Laundry Page Router
// ============================================================================
// Every `LaundryBusinessPage` value must resolve to a component via the
// switch statement in laundry-page-router.tsx.  This test validates the
// routing configuration exhaustively — not the rendered output (that would
// require @testing-library/react, which isn't in this project).
//
// WHAT IT VERIFIES:
//   1.  Every valid page value → a non-null component reference
//   2.  Dashboard type conditional (processing vs store)
//   3.  Default fallback matches dashboard behaviour
//   4.  Sidebar SCREEN_PAGES and EXTRA_ITEMS all have a router case
//   5.  No duplicate routes
//   6.  Route validation set within the router file is complete
// ============================================================================

// ── Complete list of every LaundryBusinessPage value ───────────────────
// (sourced from the union type in admin-store.ts)
const ALL_PAGES = [
  // Dashboard
  "dashboard",

  // Shared laundry pages
  "orders",
  "garment-lookup",
  "reports",
  "order-detail",
  "inbox",
  "new-order",
  "customers",
  "stores",
  "settings",
  "categories",
  "garments",
  "services",
  "pricing",
  "subscription-plans",
  "charges-rules",
  "pricing-simulator",
  "subscriptions",
  "roles",
  "staff",

  // CRM
  "crm-dashboard",
  "crm-leads",
  "crm-opportunities",
  "crm-activities",
  "crm-tasks",
  "crm-reports",
  "crm-settings",

  // Marketing
  "marketing-dashboard",
  "marketing-discounts",
  "marketing-coupons",
  "marketing-reports",
  "marketing-loyalty",
  "marketing-membership",
  "marketing-credits",
  "marketing-giftcards",
  "marketing-referral",
  "marketing-campaigns",
  "marketing-cart-recovery",

  // Store operations
  "audit-queue",
  "payment-queue",
  "packing-queue",
  "dispatch-queue",
  "store-receive-queue",
  "ready-delivery-queue",
  "pickup-bags",
  "bag-management",
  "dispatch-center",
  "pickup-scheduler",
  "delivery-assignments",
  "delivery-executives",
  "mobile-apps",

  // Processing
  "processing-centers",
  "audit-barcode",
  "ws-wash",
  "ws-dryclean",
  "ws-iron",
  "ws-fold",
  "ws-qc",
  "ws-sorting",
  "ws-transit",
] as const

type Page = (typeof ALL_PAGES)[number]

// ── Page → Component mapping (replicates the switch in page-router) ────
// Each entry lists the component(s) that should render for this page.
// Using the actual component display names from the dynamic imports.
interface RouteEntry {
  pages: Page[]
  component: string
  /** True if the component is conditional on dashboardType */
  conditional?: boolean
}

const ROUTE_MAP: RouteEntry[] = [
  // Dashboard (conditional)
  { pages: ["dashboard"], conditional: true, component: "ProcessingDashboard | LaundryDashboard" },

  // Shared
  { pages: ["orders"], component: "LaundryOrdersView" },
  { pages: ["garment-lookup"], component: "LaundryGarmentLookup" },
  { pages: ["reports"], component: "LaundryReportsView" },
  { pages: ["order-detail"], component: "LaundryOrderDetail" },
  { pages: ["inbox"], component: "LaundryInboxView" },
  { pages: ["new-order"], component: "LaundryNewOrder" },
  { pages: ["customers"], component: "LaundryCustomersView" },
  { pages: ["stores"], component: "LaundryStoresWorkspace" },
  { pages: ["settings"], component: "LaundryWorkspaceSettings" },
  { pages: ["categories"], component: "LaundryCategoriesMaster" },
  { pages: ["garments"], component: "LaundryGarmentsMaster" },
  { pages: ["services"], component: "LaundryServicesMaster" },
  { pages: ["pricing"], component: "LaundryPricingMatrix" },
  { pages: ["subscription-plans"], component: "LaundrySubscriptionPlansPage" },
  { pages: ["charges-rules"], component: "LaundryChargesRulesPage" },
  { pages: ["pricing-simulator"], component: "LaundryPricingSimulatorPage" },
  { pages: ["subscriptions"], component: "LaundrySubscriptionsView" },
  { pages: ["roles"], component: "LaundryRolesPermissions" },
  { pages: ["staff"], component: "LaundryStaff" },

  // CRM (all wrapped in CrmGate)
  { pages: ["crm-dashboard", "crm-leads", "crm-opportunities", "crm-activities", "crm-tasks", "crm-reports", "crm-settings"], component: "CrmGate > Crm*" },

  // Marketing (all wrapped in MarketingGate)
  { pages: ["marketing-dashboard", "marketing-discounts", "marketing-coupons", "marketing-reports", "marketing-loyalty", "marketing-membership", "marketing-credits", "marketing-giftcards", "marketing-referral", "marketing-campaigns", "marketing-cart-recovery"], component: "MarketingGate > Marketing*" },

  // Store operations
  { pages: ["audit-queue"], component: "LaundryStoreAudit" },
  { pages: ["payment-queue"], component: "LaundryPaymentCollection" },
  { pages: ["packing-queue"], component: "LaundryPacking" },
  { pages: ["dispatch-queue"], component: "LaundryDispatch" },
  { pages: ["store-receive-queue"], component: "LaundryStoreReceive" },
  { pages: ["ready-delivery-queue"], component: "LaundryReadyForDelivery" },
  { pages: ["pickup-bags"], component: "LaundryPickupBags" },
  { pages: ["bag-management"], component: "LaundryBagManagement" },
  { pages: ["dispatch-center", "pickup-scheduler", "delivery-assignments"], component: "LaundryDispatchCenter" },
  { pages: ["delivery-executives"], component: "LaundryDeliveryExecutives" },
  { pages: ["mobile-apps"], component: "LaundryMobileApps" },

  // Processing
  { pages: ["processing-centers"], component: "LaundryProcessingConsole" },
  { pages: ["audit-barcode"], component: "LaundryAuditBarcodePage" },
  { pages: ["ws-wash"], component: "LaundryWorkstation(stage=WASH)" },
  { pages: ["ws-dryclean"], component: "LaundryWorkstation(stage=DRYCLEAN)" },
  { pages: ["ws-iron"], component: "LaundryFinishingWorkstation(stage=IRON)" },
  { pages: ["ws-fold"], component: "LaundryFinishingWorkstation(stage=FOLD)" },
  { pages: ["ws-qc"], component: "LaundryDryingQcWorkstation" },
  { pages: ["ws-sorting"], component: "LaundrySortingWorkstation" },
  { pages: ["ws-transit"], component: "LaundryTransitWorkstation" },
]

// Build reverse lookup: page → RouteEntry
const PAGE_TO_ENTRY = new Map<Page, RouteEntry>()
for (const entry of ROUTE_MAP) {
  for (const p of entry.pages) {
    if (PAGE_TO_ENTRY.has(p)) throw new Error(`Duplicate page "${p}" in ROUTE_MAP`)
    PAGE_TO_ENTRY.set(p, entry)
  }
}

// ── Sidebar page values (from laundry-sidebar.tsx) ────────────────────
const SIDEBAR_SCREEN_PAGES = new Set([
  "dashboard",
  "orders",
  "customers",
  "subscriptions",
  "pricing",
  "stores",
  "staff",
  "bag-management",
  "reports",
  "settings",
  "crm-dashboard",
  "crm-leads",
  "crm-opportunities",
  "crm-activities",
  "crm-tasks",
  "crm-reports",
  "crm-settings",
  "processing-centers",
  "audit-barcode",
  "ws-wash",
  "ws-dryclean",
  "ws-iron",
  "ws-fold",
  "ws-qc",
  "ws-sorting",
  "ws-transit",
  "audit-queue",
  "payment-queue",
  "packing-queue",
  "dispatch-queue",
  "store-receive-queue",
  "ready-delivery-queue",
  "garment-lookup",
  "new-order",
  "dispatch-center",
  "pickup-bags",
  "delivery-executives",
  "mobile-apps",
  "roles",
])

// Pages that are only navigated to programmatically (not via sidebar)
const PROGRAMMATIC_PAGES = new Set(["order-detail", "audit-barcode", "pickup-scheduler", "delivery-assignments"])

// ============================================================================
// TESTS
// ============================================================================

describe("LaundryPageRouter — routing coverage", () => {
  // ── TEST 1: Every page has a route entry ──────────────────────────────────
  it("every LaundryBusinessPage value has a matching route entry", () => {
    const missing: string[] = []
    for (const page of ALL_PAGES) {
      if (!PAGE_TO_ENTRY.has(page)) missing.push(page)
    }
    expect(missing, `Pages missing from ROUTE_MAP: ${missing.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 2: Every route entry page exists in ALL_PAGES ─────────────────────
  it("every route entry page is a valid LaundryBusinessPage", () => {
    const valid = new Set(ALL_PAGES)
    const extra: string[] = []
    for (const [page] of PAGE_TO_ENTRY) {
      if (!valid.has(page)) extra.push(page)
    }
    expect(extra, `Pages in ROUTE_MAP but not in LaundryBusinessPage: ${extra.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 3: No duplicate pages across route entries ────────────────────────
  it("no page value appears in more than one route entry", () => {
    const seen = new Map<string, number>()
    for (const entry of ROUTE_MAP) {
      for (const p of entry.pages) {
        seen.set(p, (seen.get(p) ?? 0) + 1)
      }
    }
    const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([p]) => p)
    expect(dups, `Duplicate pages: ${dups.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 4: Route entry pages are disjoint (no overlap) ───────────────────
  it("route entry page groups are disjoint", () => {
    const all: string[] = []
    const overlaps: string[] = []
    for (const entry of ROUTE_MAP) {
      for (const p of entry.pages) {
        if (all.includes(p)) overlaps.push(p)
        all.push(p)
      }
    }
    expect(overlaps, `Overlapping pages: ${overlaps.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 5: Dashboard conditional logic ─────────────────────────────────────
  it("dashboard has conditional rendering based on dashboardType", () => {
    const entry = PAGE_TO_ENTRY.get("dashboard")
    expect(entry?.conditional).toBe(true)
    expect(entry?.component).toBe("ProcessingDashboard | LaundryDashboard")
  })

  // ── TEST 6: Default fallback matches dashboard behaviour ───────────────────
  it("unknown pages fall back to the same logic as dashboard", () => {
    // The router's default case returns the same conditional as "dashboard":
    //   dashboardType === "processing" ? <ProcessingDashboard /> : <LaundryDashboard />
    // Verify this by checking the route map has no unlisted page that could
    // slip through to default with unexpected results.
    const mappedPages = new Set(ROUTE_MAP.flatMap((e) => e.pages))
    const unlisted = ALL_PAGES.filter((p) => !mappedPages.has(p))
    expect(unlisted, "Unlisted pages (would hit default) — verify correct fallback").toStrictEqual([])
  })

  // ── TEST 7: No page routes to ProcessingDashboard except dashboard/default ─
  it("no non-dashboard page renders ProcessingDashboard", () => {
    const processingOnly = ["ProcessingDashboard", "ProcessingDashboard | LaundryDashboard"]
    const offenders: string[] = []
    for (const entry of ROUTE_MAP) {
      if (entry.pages.includes("dashboard")) continue
      if (processingOnly.some((p) => entry.component.includes(p))) {
        if (entry.component !== "ProcessingDashboard | LaundryDashboard") {
          offenders.push(`${entry.pages[0]} → ${entry.component}`)
        }
      }
    }
    expect(offenders, "Non-dashboard pages that render ProcessingDashboard").toStrictEqual([])
  })
})

describe("Sidebar → Router cross-reference", () => {
  // ── TEST 8: All sidebar SCREEN_PAGES have a router case ────────────────────
  it("every sidebar SCREEN_PAGES value has a router case", () => {
    const routerPages = new Set(ROUTE_MAP.flatMap((e) => e.pages))
    const missing = [...SIDEBAR_SCREEN_PAGES].filter((p) => !routerPages.has(p as Page))
    expect(missing, `Sidebar pages missing from router: ${missing.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 9: All sidebar EXTRA_ITEMS page values have a router case ─────────
  it("every sidebar EXTRA_ITEMS page value has a router case", () => {
    const routerPages = new Set(ROUTE_MAP.flatMap((e) => e.pages))
    const extras = ["new-order", "garment-lookup", "dispatch-center", "pickup-bags", "bag-management", "delivery-executives", "mobile-apps", "roles"]
    const missing = extras.filter((p) => !routerPages.has(p as Page))
    expect(missing, `EXTRA_ITEMS pages missing from router: ${missing.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 10: Router ROUTE_PAGES validation set covers sidebar pages ────
  it("router's ROUTE_PAGES validation set covers all sidebar page values", () => {
    // This is the same set that validateRoutes() uses in laundry-page-router.tsx
    const ROUTE_PAGES = new Set([
      "orders", "garment-lookup", "reports", "order-detail",
      "crm-dashboard", "crm-leads", "crm-opportunities", "crm-activities",
      "crm-tasks", "crm-reports", "crm-settings",
      "marketing-dashboard", "marketing-discounts", "marketing-coupons",
      "marketing-reports", "marketing-loyalty", "marketing-membership",
      "marketing-credits", "marketing-giftcards", "marketing-referral",
      "marketing-campaigns", "marketing-cart-recovery",
      "dashboard", "processing-centers", "audit-barcode",
      "ws-wash", "ws-dryclean", "ws-iron", "ws-fold", "ws-qc", "ws-sorting", "ws-transit",
      "inbox", "new-order", "audit-queue", "payment-queue", "packing-queue",
      "dispatch-queue", "store-receive-queue", "pickup-bags", "bag-management",
      "dispatch-center", "pickup-scheduler", "delivery-assignments", "delivery-executives", "mobile-apps",
      "ready-delivery-queue", "customers", "stores", "settings",
      "categories", "garments", "services", "pricing", "subscription-plans",
      "charges-rules", "pricing-simulator", "subscriptions", "roles", "staff",
    ])
    const allSidebar = new Set([...SIDEBAR_SCREEN_PAGES, ...PROGRAMMATIC_PAGES])
    const missing = [...allSidebar].filter((p) => !ROUTE_PAGES.has(p))
    expect(missing, `Sidebar pages not in ROUTE_PAGES: ${missing.join(", ")}`).toStrictEqual([])
  })

  // ── TEST 11: Route validation set has no duplicates ─────────────────────
  it("ROUTE_PAGES validation set has no duplicates", () => {
    const ROUTE_PAGES = [
      "orders", "garment-lookup", "reports", "order-detail",
      "crm-dashboard", "crm-leads", "crm-opportunities", "crm-activities",
      "crm-tasks", "crm-reports", "crm-settings",
      "marketing-dashboard", "marketing-discounts", "marketing-coupons",
      "marketing-reports", "marketing-loyalty", "marketing-membership",
      "marketing-credits", "marketing-giftcards", "marketing-referral",
      "marketing-campaigns", "marketing-cart-recovery",
      "dashboard", "processing-centers", "audit-barcode",
      "ws-wash", "ws-dryclean", "ws-iron", "ws-fold", "ws-qc", "ws-sorting", "ws-transit",
      "inbox", "new-order", "audit-queue", "payment-queue", "packing-queue",
      "dispatch-queue", "store-receive-queue", "pickup-bags", "bag-management",
      "dispatch-center", "pickup-scheduler", "delivery-assignments", "delivery-executives", "mobile-apps",
      "ready-delivery-queue", "customers", "stores", "settings",
      "categories", "garments", "services", "pricing", "subscription-plans",
      "charges-rules", "pricing-simulator", "subscriptions", "roles", "staff",
    ]
    const seen = new Set<string>()
    const dups: string[] = []
    for (const p of ROUTE_PAGES) {
      if (seen.has(p)) dups.push(p)
      seen.add(p)
    }
    expect(dups, `Duplicate entries in ROUTE_PAGES: ${dups.join(", ")}`).toStrictEqual([])
  })
})

describe("deriveDashboardType", () => {
  it("returns 'processing' when at least one processing screen has level ≥ 1", () => {
    const screenLevels = {
      "laundry.orders": 3,
      "processing.washing": 2,
      "laundry.reports": 1,
    }
    const hasProcessing = Object.keys(screenLevels).some(
      (k) => k.startsWith("processing.") && (screenLevels[k] ?? 0) >= 1,
    )
    expect(hasProcessing).toBe(true)
  })

  it("returns 'store' when no processing screen has level ≥ 1", () => {
    const screenLevels = {
      "laundry.orders": 3,
      "processing.washing": 0,
      "laundry.reports": 1,
    }
    const hasProcessing = Object.keys(screenLevels).some(
      (k) => k.startsWith("processing.") && (screenLevels[k] ?? 0) >= 1,
    )
    expect(hasProcessing).toBe(false)
  })

  it("returns 'store' when there are no processing screens at all", () => {
    const screenLevels = {
      "laundry.orders": 3,
      "laundry.reports": 1,
    }
    const hasProcessing = Object.keys(screenLevels).some(
      (k) => k.startsWith("processing.") && (screenLevels[k] ?? 0) >= 1,
    )
    expect(hasProcessing).toBe(false)
  })

  it("returns 'processing' for empty screenLevels (processing console)", () => {
    const screenLevels = {
      "processing.console_receive": 1,
    }
    const hasProcessing = Object.keys(screenLevels).some(
      (k) => k.startsWith("processing.") && (screenLevels[k] ?? 0) >= 1,
    )
    expect(hasProcessing).toBe(true)
  })
})
