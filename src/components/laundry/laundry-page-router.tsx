"use client"

import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import { PageLoader } from "@/components/ui/page-loader"
import { SCREEN_PAGE_MAP } from "@/lib/laundry-nav-config"

// Dynamic imports for page components
import dynamic from "next/dynamic"

const LaundryDashboard = dynamic(() => import("@/components/laundry/views/laundry-dashboard").then(m => ({ default: m.LaundryDashboard })), { loading: () => <PageLoader /> })
const ProcessingDashboard = dynamic(() => import("@/components/laundry/views/processing-dashboard").then(m => ({ default: m.ProcessingDashboard })), { loading: () => <PageLoader /> })
const LaundryInboxView = dynamic(() => import("@/components/laundry/views/laundry-inbox-view").then(m => ({ default: m.LaundryInboxView })), { loading: () => <PageLoader /> })
const LaundryOrdersView = dynamic(() => import("@/components/laundry/views/laundry-orders-view").then(m => ({ default: m.LaundryOrdersView })), { loading: () => <PageLoader /> })
const LaundryNewOrder = dynamic(() => import("@/components/laundry/views/laundry-new-order").then(m => ({ default: m.default })), { loading: () => <PageLoader /> })
const LaundryStoreAudit = dynamic(() => import("@/components/laundry/views/laundry-store-audit").then(m => ({ default: m.LaundryStoreAudit })), { loading: () => <PageLoader /> })
const LaundryPaymentCollection = dynamic(() => import("@/components/laundry/views/laundry-store-stages").then(m => ({ default: m.LaundryPaymentCollection })), { loading: () => <PageLoader /> })
const LaundryPacking = dynamic(() => import("@/components/laundry/views/laundry-store-stages").then(m => ({ default: m.LaundryPacking })), { loading: () => <PageLoader /> })
const LaundryDispatch = dynamic(() => import("@/components/laundry/views/laundry-store-stages").then(m => ({ default: m.LaundryDispatch })), { loading: () => <PageLoader /> })
const LaundryStoreReceive = dynamic(() => import("@/components/laundry/views/laundry-store-stages").then(m => ({ default: m.LaundryStoreReceive })), { loading: () => <PageLoader /> })
const LaundryPickupBags = dynamic(() => import("@/components/laundry/views/laundry-pickup-bags").then(m => ({ default: m.LaundryPickupBags })), { loading: () => <PageLoader /> })
const LaundryBagManagement = dynamic(() => import("@/components/laundry/views/laundry-bag-management").then(m => ({ default: m.LaundryBagManagement })), { loading: () => <PageLoader /> })
const LaundryDispatchCenter = dynamic(() => import("@/components/laundry/views/laundry-dispatch-center").then(m => ({ default: m.LaundryDispatchCenter })), { loading: () => <PageLoader /> })
const LaundryDeliveryExecutives = dynamic(() => import("@/components/laundry/views/laundry-delivery-executives").then(m => ({ default: m.LaundryDeliveryExecutives })), { loading: () => <PageLoader /> })
const LaundryMobileApps = dynamic(() => import("@/components/laundry/views/laundry-mobile-apps").then(m => ({ default: m.LaundryMobileApps })), { loading: () => <PageLoader /> })
const LaundryReadyForDelivery = dynamic(() => import("@/components/laundry/views/laundry-store-stages").then(m => ({ default: m.LaundryReadyForDelivery })), { loading: () => <PageLoader /> })
const LaundryOrderDetail = dynamic(() => import("@/components/laundry/views/laundry-order-detail").then(m => ({ default: m.LaundryOrderDetail })), { loading: () => <PageLoader /> })
const LaundryCustomersView = dynamic(() => import("@/components/laundry/views/laundry-customers-view").then(m => ({ default: m.LaundryCustomersView })), { loading: () => <PageLoader /> })
const LaundryGarmentLookup = dynamic(() => import("@/components/laundry/views/laundry-garment-lookup").then(m => ({ default: m.LaundryGarmentLookup })), { loading: () => <PageLoader /> })
const LaundryReportsView = dynamic(() => import("@/components/laundry/views/laundry-reports-view").then(m => ({ default: m.LaundryReportsView })), { loading: () => <PageLoader /> })
const LaundryWorkspaceSettings = dynamic(() => import("@/components/laundry/views/laundry-workspace-settings").then(m => ({ default: m.LaundryWorkspaceSettings })), { loading: () => <PageLoader /> })
const LaundryCategoriesMaster = dynamic(() => import("@/components/laundry/views/laundry-categories-master").then(m => ({ default: m.LaundryCategoriesMaster })), { loading: () => <PageLoader /> })
const LaundryGarmentsMaster = dynamic(() => import("@/components/laundry/views/laundry-garments-master").then(m => ({ default: m.LaundryGarmentsMaster })), { loading: () => <PageLoader /> })
const LaundryServicesMaster = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.ServicesMasterPage })), { loading: () => <PageLoader /> })
const LaundryPricingMatrix = dynamic(() => import("@/components/laundry/views/laundry-pricing-matrix").then(m => ({ default: m.LaundryPricingMatrix })), { loading: () => <PageLoader /> })
const LaundrySubscriptionPlansPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.SubscriptionPlansPage })), { loading: () => <PageLoader /> })
const LaundryChargesRulesPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.ChargesRulesPage })), { loading: () => <PageLoader /> })
const LaundryPricingSimulatorPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.PricingSimulatorPage })), { loading: () => <PageLoader /> })
const LaundrySubscriptionsView = dynamic(() => import("@/components/laundry/views/laundry-subscriptions-view").then(m => ({ default: m.LaundrySubscriptionsView })), { loading: () => <PageLoader /> })
const LaundryRolesPermissions = dynamic(() => import("@/components/laundry/views/laundry-roles-permissions").then(m => ({ default: m.LaundryRolesPermissions })), { loading: () => <PageLoader /> })
const LaundryStaff = dynamic(() => import("@/components/laundry/views/laundry-staff").then(m => ({ default: m.LaundryStaff })), { loading: () => <PageLoader /> })
const LaundryProcessingConsole = dynamic(() => import("@/components/laundry/views/laundry-processing-console").then(m => ({ default: m.LaundryProcessingConsole })), { loading: () => <PageLoader /> })
const LaundryWorkstation = dynamic(() => import("@/components/laundry/views/laundry-workstation").then(m => ({ default: m.LaundryWorkstation })), { loading: () => <PageLoader /> })
const LaundryFinishingWorkstation = dynamic(() => import("@/components/laundry/views/laundry-finishing-workstation").then(m => ({ default: m.LaundryFinishingWorkstation })), { loading: () => <PageLoader /> })
const LaundryDryingQcWorkstation = dynamic(() => import("@/components/laundry/views/laundry-drying-qc-workstation").then(m => ({ default: m.LaundryDryingQcWorkstation })), { loading: () => <PageLoader /> })
const LaundrySortingWorkstation = dynamic(() => import("@/components/laundry/views/laundry-sorting-workstation").then(m => ({ default: m.LaundrySortingWorkstation })), { loading: () => <PageLoader /> })
const LaundryTransitWorkstation = dynamic(() => import("@/components/laundry/views/laundry-transit-workstation").then(m => ({ default: m.LaundryTransitWorkstation })), { loading: () => <PageLoader /> })
const LaundryAuditBarcodePage = dynamic(() => import("@/components/laundry/views/laundry-audit-barcode-page").then(m => ({ default: m.LaundryAuditBarcodePage })), { loading: () => <PageLoader /> })
const LaundryStoresWorkspace = dynamic(() => import("@/components/admin/laundry/laundry-stores-view").then(m => ({ default: m.LaundryStoresView })), { loading: () => <PageLoader /> })
const LaundryNavigationManager = dynamic(() => import("@/components/laundry/views/laundry-navigation-settings").then(m => ({ default: m.LaundryNavigationManager })), { loading: () => <PageLoader /> })
const CrmGate = dynamic(() => import("@/components/laundry/views/crm/crm-gate").then(m => ({ default: m.CrmGate })), { loading: () => <PageLoader /> })
const CrmDashboard = dynamic(() => import("@/components/laundry/views/crm/crm-dashboard").then(m => ({ default: m.CrmDashboard })), { loading: () => <PageLoader /> })
const CrmLeads = dynamic(() => import("@/components/laundry/views/crm/crm-leads").then(m => ({ default: m.CrmLeads })), { loading: () => <PageLoader /> })
const CrmOpportunities = dynamic(() => import("@/components/laundry/views/crm/crm-opportunities").then(m => ({ default: m.CrmOpportunities })), { loading: () => <PageLoader /> })
const CrmActivities = dynamic(() => import("@/components/laundry/views/crm/crm-activities").then(m => ({ default: m.CrmActivities })), { loading: () => <PageLoader /> })
const CrmTasks = dynamic(() => import("@/components/laundry/views/crm/crm-tasks").then(m => ({ default: m.CrmTasks })), { loading: () => <PageLoader /> })
const CrmReports = dynamic(() => import("@/components/laundry/views/crm/crm-reports").then(m => ({ default: m.CrmReports })), { loading: () => <PageLoader /> })
const CrmSettings = dynamic(() => import("@/components/laundry/views/crm/crm-settings").then(m => ({ default: m.CrmSettings })), { loading: () => <PageLoader /> })
const MarketingGate = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingGate })), { loading: () => <PageLoader /> })
const MarketingDashboard = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingDashboard })), { loading: () => <PageLoader /> })
const MarketingCoupons = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingCoupons })), { loading: () => <PageLoader /> })
const MarketingDiscounts = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingDiscounts })), { loading: () => <PageLoader /> })
const MarketingReports = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingReports })), { loading: () => <PageLoader /> })
const MarketingPlaceholder = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingPlaceholder })), { loading: () => <PageLoader /> })

function deriveDashboardType(screenLevels: Record<string, number>): "processing" | "store" {
  const hasProcessing = Object.keys(screenLevels).some(
    (k) => k.startsWith("processing.") && (screenLevels[k] ?? 0) >= 1,
  )
  return hasProcessing ? "processing" : "store"
}

export function LaundryPageRouter() {
  const { laundryPage } = useAdminStore()
  const { currentBusinessId } = useAuthStore()
  const { screenLevels } = useRuntimeAuth()

  const wsBusinessId = currentBusinessId || ""
  const dashboardType = deriveDashboardType(screenLevels)

  // Single unified switch. dashboardType affects ONLY the "dashboard" route
  // and the default fallback. Every other page is shared regardless of type.
  switch (laundryPage) {
    // ── Dashboard (type-aware) ─────────────────────────────────────────────
    case "dashboard":
      return dashboardType === "processing" ? <ProcessingDashboard /> : <LaundryDashboard />

    // ── Shared pages — same component for both dashboard types ────────────
    case "orders": return <LaundryOrdersView />
    case "garment-lookup": return <LaundryGarmentLookup />
    case "reports": return <LaundryReportsView />
    case "order-detail": return <LaundryOrderDetail />
    case "inbox": return <LaundryInboxView />
    case "new-order": return <LaundryNewOrder />
    case "customers": return <LaundryCustomersView />
    case "stores": return <LaundryStoresWorkspace businessId={wsBusinessId} />
    case "settings": return <LaundryWorkspaceSettings businessId={wsBusinessId} />
    case "navigation": return <LaundryNavigationManager businessId={wsBusinessId} />
    case "categories": return <LaundryCategoriesMaster />
    case "garments": return <LaundryGarmentsMaster />
    case "services": return <LaundryServicesMaster />
    case "pricing": return <LaundryPricingMatrix />
    case "subscription-plans": return <LaundrySubscriptionPlansPage />
    case "charges-rules": return <LaundryChargesRulesPage />
    case "pricing-simulator": return <LaundryPricingSimulatorPage />
    case "subscriptions": return <LaundrySubscriptionsView />
    case "roles": return <LaundryRolesPermissions businessId={wsBusinessId} />
    case "staff": return <LaundryStaff businessId={wsBusinessId} />

    // ── CRM (cross-cutting) ───────────────────────────────────────────────
    case "crm-dashboard": return <CrmGate><CrmDashboard businessId={wsBusinessId} /></CrmGate>
    case "crm-leads": return <CrmGate><CrmLeads businessId={wsBusinessId} /></CrmGate>
    case "crm-opportunities": return <CrmGate><CrmOpportunities businessId={wsBusinessId} /></CrmGate>
    case "crm-activities": return <CrmGate><CrmActivities businessId={wsBusinessId} /></CrmGate>
    case "crm-tasks": return <CrmGate><CrmTasks businessId={wsBusinessId} /></CrmGate>
    case "crm-reports": return <CrmGate><CrmReports businessId={wsBusinessId} /></CrmGate>
    case "crm-settings": return <CrmGate><CrmSettings businessId={wsBusinessId} /></CrmGate>

    // ── Marketing (cross-cutting) ─────────────────────────────────────────
    case "marketing-dashboard": return <MarketingGate><MarketingDashboard businessId={wsBusinessId} /></MarketingGate>
    case "marketing-discounts": return <MarketingGate><MarketingDiscounts /></MarketingGate>
    case "marketing-coupons": return <MarketingGate><MarketingCoupons businessId={wsBusinessId} /></MarketingGate>
    case "marketing-reports": return <MarketingGate><MarketingReports businessId={wsBusinessId} /></MarketingGate>
    case "marketing-loyalty": return <MarketingGate><MarketingPlaceholder title="Loyalty Program" phase="Phase 2" /></MarketingGate>
    case "marketing-membership": return <MarketingGate><MarketingPlaceholder title="Membership Levels" phase="Phase 2" /></MarketingGate>
    case "marketing-credits": return <MarketingGate><MarketingPlaceholder title="Promotional Credits" phase="Phase 2" /></MarketingGate>
    case "marketing-giftcards": return <MarketingGate><MarketingPlaceholder title="Gift Cards" phase="Phase 3" /></MarketingGate>
    case "marketing-referral": return <MarketingGate><MarketingPlaceholder title="Referral Program" phase="Phase 3" /></MarketingGate>
    case "marketing-campaigns": return <MarketingGate><MarketingPlaceholder title="Campaigns" phase="Phase 3" /></MarketingGate>
    case "marketing-cart-recovery": return <MarketingGate><MarketingPlaceholder title="Cart Recovery" phase="Phase 4" /></MarketingGate>

    // ── Store operations (available to any user with permission) ──────────
    case "audit-queue": return <LaundryStoreAudit />
    case "payment-queue": return <LaundryPaymentCollection />
    case "packing-queue": return <LaundryPacking />
    case "dispatch-queue": return <LaundryDispatch />
    case "store-receive-queue": return <LaundryStoreReceive />
    case "ready-delivery-queue": return <LaundryReadyForDelivery />
    case "pickup-bags": return <LaundryPickupBags />
    case "bag-management": return <LaundryBagManagement />
    case "dispatch-center":
    case "pickup-scheduler":
    case "delivery-assignments": return <LaundryDispatchCenter />
    case "delivery-executives": return <LaundryDeliveryExecutives />
    case "mobile-apps": return <LaundryMobileApps />

    // ── Processing (available to any user with permission) ────────────────
    case "processing-centers": return <LaundryProcessingConsole />
    case "audit-barcode": return <LaundryAuditBarcodePage />
    case "ws-wash": return <LaundryWorkstation stage="WASH" />
    // Drying and Quality Check are a SINGLE combined "Dry & Quality Check"
    // workstation in the approved model — both nav keys render the same merged
    // screen (garment barcodes are the tracking identity through here).
    case "ws-dry": case "ws-qc": return <LaundryDryingQcWorkstation />
    case "ws-dryclean": return <LaundryWorkstation stage="DRYCLEAN" />
    // Sorting is the permanent garment→bag transition: scan every garment, then
    // bind the order's ONE bag (retiring every garment barcode).
    case "ws-sorting": return <LaundrySortingWorkstation />
    // Iron / Folding are the BAG-BASED finishing stations after Sorting — they
    // scan the assigned bag / Processing Package, never garment barcodes.
    case "ws-iron": return <LaundryFinishingWorkstation stage="IRON" />
    case "ws-fold": return <LaundryFinishingWorkstation stage="FOLD" />
    // Transit is the bag-based dispatch terminal at the Processing Center.
    case "ws-transit": return <LaundryTransitWorkstation />
    case "ws-pack": return <LaundryWorkstation stage="PACKED" />

    // ── Fallback ──────────────────────────────────────────────────────────
    default:
      return dashboardType === "processing" ? <ProcessingDashboard /> : <LaundryDashboard />
  }
}
