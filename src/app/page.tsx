"use client"

import { useEffect, Suspense, useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { AuthProvider } from "@/components/auth/auth-provider"
import { useAuthStore } from "@/stores/auth-store"
import { ADMIN_NAV_PERMISSIONS } from "@/lib/permissions"
import { AdminLayout } from "@/components/admin/layout/admin-layout"
import { BusinessLayout } from "@/components/business/layout/business-layout"
import { LaundryLayout } from "@/components/laundry/layout/laundry-layout"
import { CustomerLayout } from "@/components/customer/layout/customer-layout"
import { DeliveryLayout } from "@/components/delivery/layout/delivery-layout"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { getProductHostPrefixes, getProductCodeForHost } from "@/lib/product-hosts"
import { ErrorBoundary } from "@/components/error/error-boundary"

// ── Storefront context loader ─────────────────────────────────────────────
// Receives slug directly (no useSearchParams needed here).
// Fetches store-context and hydrates business/store state + sets viewMode.
// Does NOT bail out on isAuthenticated — authenticated customers (CUSTOMER role)
// must also load store context. Platform/business admins are handled separately
// by the auth effect in AppContent.
function StorefrontContextLoader({
  slug,
  onNotFound,
  onLoaded,
}: {
  slug: string
  onNotFound: () => void
  onLoaded: () => void
}) {
  const {
    setCurrentBusiness, setViewMode,
    setCurrentStoreId, setCurrentStoreName,
    setCurrentBusinessPrimaryColor,
    setCurrentBusinessLogo, setCurrentBusinessFavicon,
    setOrderStages, setImageConfig, setBusinessTheme,
    setStorefrontWhyChooseUs, setStorefrontPromiseBar,
    setPwaAppearance,
  } = useAdminStore()
  const { setCartStoreId, setStoreContext } = useCartStore()
  const { isAuthenticated, currentRole } = useAuthStore()

  useEffect(() => {
    // Platform/business admins visiting a storefront URL keep their admin session
    const isAdminSession = isAuthenticated && currentRole &&
      !['CUSTOMER', 'DELIVERY_STAFF'].includes(currentRole)
    if (isAdminSession) { onLoaded(); return }

    fetch(`/api/core/storefront/store-context?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.data?.business) { onNotFound(); return }
        const biz = json.data.business
        setCurrentBusiness(biz.id, biz.name, biz.businessType, biz.slug)
        if (biz.primaryColor) setCurrentBusinessPrimaryColor(biz.primaryColor)
        if (biz.logo) setCurrentBusinessLogo(biz.logo)
        // Always inject a favicon — use business favicon if set, otherwise the
        // platform logo. This ensures the browser tab always shows something.
        if (typeof document !== 'undefined') {
          const rawFavicon = biz.favicon || '/placeholder-logo.svg'
          const faviconUrl = rawFavicon + '?v=' + Date.now()
          if (biz.favicon) setCurrentBusinessFavicon(biz.favicon)
          // Remove ALL existing icon links to guarantee a clean inject
          document.querySelectorAll("link[rel~='icon'], link[rel~='shortcut icon']").forEach(el => el.remove())
          const link = document.createElement('link')
          link.rel = 'icon'
          link.href = faviconUrl
          document.head.appendChild(link)
        }
        const store = json.data.store
        if (store?.id) {
          setCurrentStoreId(store.id)
          setCurrentStoreName(store.name || "")
          setCartStoreId(store.id)
          setStoreContext(store.deliveryFee ?? null, store.minOrderAmount ?? null, json.data.paymentGateways || [])
        }
        if (json.data.orderStages?.length) setOrderStages(json.data.orderStages)
        if (json.data.ecommerceConfig?.imageConfig) setImageConfig(json.data.ecommerceConfig.imageConfig)
        if (json.data.ecommerceConfig?.theme) setBusinessTheme(json.data.ecommerceConfig.theme)
        if (json.data.ecommerceConfig?.pwaAppearance) setPwaAppearance(json.data.ecommerceConfig.pwaAppearance)
        // Business-controlled homepage content — always set (empty = hide section)
        setStorefrontWhyChooseUs(json.data.whyChooseUs || [])
        setStorefrontPromiseBar(json.data.promiseBar || [])
        setViewMode("customer")
        onLoaded()
      })
      .catch((err) => { console.error("[StorefrontContextLoader] fetch error", err); onNotFound() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, isAuthenticated, currentRole])

  return null
}

// ── Loading fallback ──────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <span className="text-xl font-bold text-muted-foreground">&#x1F512;</span>
      </div>
      <h2 className="text-base font-semibold text-foreground">Access Denied</h2>
      <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>
    </div>
  )
}

// Terminal recovery for a stale/expired session that is stuck in a workspace
// view it cannot authorise AND is neither a platform (Super Admin) nor a
// business role nor an impersonator — i.e. genuinely misplaced. Resets the view
// to the admin app so the user lands on a usable screen instead of a blank page.
//
// It NEVER calls the server logout: doing so would invalidate the refresh token
// and destroy a still-valid session (a Super Admin, in particular, bypasses
// permissions and must never be treated as unauthorised — the "Session not
// found" regression). If the local session really is gone, AuthProvider already
// renders the Login page; if it is valid, the admin app renders normally.
function SessionRecovery() {
  const { setViewMode } = useAdminStore()
  useEffect(() => { setViewMode("super_admin") }, [setViewMode])
  return <PageLoader />
}

// Page access derives directly from ADMIN_NAV_PERMISSIONS — the single source
// of truth for all navigation and route visibility. No hardcoded role checks.
function canAccessPage(page: string, permissions: string[]): boolean {
  const required = ADMIN_NAV_PERMISSIONS[page]
  if (!required) return true  // unmapped pages (e.g. sub-routes) are unrestricted
  return permissions.includes(required)
}

// ── Admin pages (lazy) ────────────────────────────────────────────────────
const DashboardView = dynamic(() => import("@/components/admin/dashboard/dashboard-view").then(m => ({ default: m.DashboardView })), { loading: () => <PageLoader /> })
const LeadsView = dynamic(() => import("@/components/admin/leads/leads-view").then(m => ({ default: m.LeadsView })), { loading: () => <PageLoader /> })
const BusinessesView = dynamic(() => import("@/components/admin/businesses/businesses-view").then(m => ({ default: m.BusinessesView })), { loading: () => <PageLoader /> })
const SubscriptionsView = dynamic(() => import("@/components/admin/subscriptions/subscriptions-view").then(m => ({ default: m.SubscriptionsView })), { loading: () => <PageLoader /> })
const PlatformInvoicesView = dynamic(() => import("@/components/admin/invoices/platform-invoices-view").then(m => ({ default: m.PlatformInvoicesView })), { loading: () => <PageLoader /> })
const AddonsView = dynamic(() => import("@/components/admin/addons/addons-view").then(m => ({ default: m.AddonsView })), { loading: () => <PageLoader /> })
const AccountBillingView = dynamic(() => import("@/components/admin/account-billing/account-billing-view").then(m => ({ default: m.AccountBillingView })), { loading: () => <PageLoader /> })
const OnboardingView = dynamic(() => import("@/components/admin/onboarding/onboarding-view").then(m => ({ default: m.OnboardingView })), { loading: () => <PageLoader /> })
// Single business experience: one wizard for Create + Manage (replaces the onboarding wizard).
const BusinessManagementWizard = dynamic(() => import("@/components/admin/businesses/business-management-wizard").then(m => ({ default: m.BusinessManagementWizard })), { loading: () => <PageLoader /> })
const DomainsView = dynamic(() => import("@/components/admin/domains/domains-view").then(m => ({ default: m.DomainsView })), { loading: () => <PageLoader /> })
const SalesView = dynamic(() => import("@/components/admin/sales/sales-view").then(m => ({ default: m.SalesView })), { loading: () => <PageLoader /> })
const NotificationsView = dynamic(() => import("@/components/admin/notifications/notifications-view").then(m => ({ default: m.NotificationsView })), { loading: () => <PageLoader /> })
const SettingsView = dynamic(() => import("@/components/admin/settings/settings-view").then(m => ({ default: m.SettingsView })), { loading: () => <PageLoader /> })
const PlatformSettingsView = dynamic(() => import("@/components/admin/settings/platform-settings-view").then(m => ({ default: m.PlatformSettingsView })), { loading: () => <PageLoader /> })
const BrandStudioView = dynamic(() => import("@/components/admin/brand-studio/brand-studio-view").then(m => ({ default: m.BrandStudioView })), { loading: () => <PageLoader /> })
const CommissionView = dynamic(() => import("@/components/admin/commission/commission-view").then(m => ({ default: m.CommissionView })), { loading: () => <PageLoader /> })
const PlatformUsersView = dynamic(() => import("@/components/admin/users/platform-users-view").then(m => ({ default: m.PlatformUsersView })), { loading: () => <PageLoader /> })
const PermissionMatrixView = dynamic(() => import("@/components/admin/rbac/permission-matrix-view").then(m => ({ default: m.PermissionMatrixView })), { loading: () => <PageLoader /> })

// ── Deployment & Operations (lazy) ────────────────────────────────────────
const OpsDashboardView = dynamic(() => import("@/components/dashboard/ops-dashboard-view").then(m => ({ default: m.OpsDashboardView })), { loading: () => <PageLoader /> })
const DeploymentPipelineView = dynamic(() => import("@/components/dashboard/deployment-pipeline-view").then(m => ({ default: m.DeploymentPipelineView })), { loading: () => <PageLoader /> })
const BuildAutomationView = dynamic(() => import("@/components/dashboard/build-automation-view").then(m => ({ default: m.BuildAutomationView })), { loading: () => <PageLoader /> })
const ReleaseManagementView = dynamic(() => import("@/components/dashboard/release-management-view").then(m => ({ default: m.ReleaseManagementView })), { loading: () => <PageLoader /> })
const PlayStoreView = dynamic(() => import("@/components/dashboard/play-store-view").then(m => ({ default: m.PlayStoreView })), { loading: () => <PageLoader /> })
const MobileVersionsView = dynamic(() => import("@/components/dashboard/mobile-versions-view").then(m => ({ default: m.MobileVersionsView })), { loading: () => <PageLoader /> })
const MobileAppsView = dynamic(() => import("@/components/dashboard/mobile-apps-view").then(m => ({ default: m.MobileAppsView })), { loading: () => <PageLoader /> })

// ── Data Imports (lazy) ───────────────────────────────────────────────────
const LeadsImportView = dynamic(() => import("@/components/admin/imports/leads-import-view").then(m => ({ default: m.LeadsImportView })), { loading: () => <PageLoader /> })
const BusinessImportView = dynamic(() => import("@/components/admin/imports/business-import-view").then(m => ({ default: m.BusinessImportView })), { loading: () => <PageLoader /> })
const QuoteProposalView = dynamic(() => import("@/components/admin/leads/quote-proposal-view").then(m => ({ default: m.QuoteProposalView })), { loading: () => <PageLoader /> })
const ProposalDocumentsView = dynamic(() => import("@/components/admin/documents/proposal-documents-view").then(m => ({ default: m.ProposalDocumentsView })), { loading: () => <PageLoader /> })
const PaymentConfigView = dynamic(() => import("@/components/admin/settings/payment-config-view").then(m => ({ default: m.PaymentConfigView })), { loading: () => <PageLoader /> })

// ── Client Operations (lazy) ──────────────────────────────────────────────
const ClientAssetsView = dynamic(() => import("@/components/dashboard/client-assets-view").then(m => ({ default: m.ClientAssetsView })), { loading: () => <PageLoader /> })
const TenantProvisioningView = dynamic(() => import("@/components/dashboard/tenant-provisioning-view").then(m => ({ default: m.TenantProvisioningView })), { loading: () => <PageLoader /> })
const ProductImportView = dynamic(() => import("@/components/dashboard/product-import-view").then(m => ({ default: m.ProductImportView })), { loading: () => <PageLoader /> })
const BulkCustomerUploadView = dynamic(() => import("@/components/business/customers/bulk-customer-upload").then(m => ({ default: m.BulkCustomerUploadView })), { loading: () => <PageLoader /> })
const UserCreationView = dynamic(() => import("@/components/business/users/user-creation-view").then(m => ({ default: m.UserCreationView })), { loading: () => <PageLoader /> })
const UserManagementView = dynamic(() => import("@/components/business/users/user-management-view").then(m => ({ default: m.UserManagementView })), { loading: () => <PageLoader /> })
const OnboardingChecklistView = dynamic(() => import("@/components/dashboard/onboarding-checklist-view").then(m => ({ default: m.OnboardingChecklistView })), { loading: () => <PageLoader /> })

// ── Platform Operations (lazy) ────────────────────────────────────────────
const PlatformAnalyticsView = dynamic(() => import("@/components/dashboard/platform-analytics-view").then(m => ({ default: m.PlatformAnalyticsView })), { loading: () => <PageLoader /> })
const RevenueView = dynamic(() => import("@/components/dashboard/revenue-view").then(m => ({ default: m.RevenueView })), { loading: () => <PageLoader /> })
const SupportView = dynamic(() => import("@/components/dashboard/support-view").then(m => ({ default: m.SupportView })), { loading: () => <PageLoader /> })

// ── System (lazy) ─────────────────────────────────────────────────────────
const BackupMonitoringView = dynamic(() => import("@/components/dashboard/backup-monitoring-view").then(m => ({ default: m.BackupMonitoringView })), { loading: () => <PageLoader /> })
const SecurityAccessView = dynamic(() => import("@/components/dashboard/security-access-view").then(m => ({ default: m.SecurityAccessView })), { loading: () => <PageLoader /> })
const AuditLogsView = dynamic(() => import("@/components/dashboard/audit-logs-view").then(m => ({ default: m.AuditLogsView })), { loading: () => <PageLoader /> })
const ProductsRegistryView = dynamic(() => import("@/components/admin/products/products-view").then(m => ({ default: m.ProductsView })), { loading: () => <PageLoader /> })
const WorkspacesRegistryView = dynamic(() => import("@/components/admin/workspaces/workspaces-view").then(m => ({ default: m.WorkspacesView })), { loading: () => <PageLoader /> })
const CommerceTemplateLibrary = dynamic(() => import("@/components/admin/commerce/commerce-template-library").then(m => ({ default: m.CommerceTemplateLibrary })), { loading: () => <PageLoader /> })
const QuantixWebsiteView = dynamic(() => import("@/components/admin/websites/quantix-website-view").then(m => ({ default: m.QuantixWebsiteView })), { loading: () => <PageLoader /> })
const LaundryOsView = dynamic(() => import("@/components/admin/laundry/laundry-os-dashboard").then(m => ({ default: m.LaundryOsDashboard })), { loading: () => <PageLoader /> })
const LaundryBusinessesView = dynamic(() => import("@/components/admin/laundry/laundry-businesses-view").then(m => ({ default: m.LaundryBusinessesView })), { loading: () => <PageLoader /> })
const LaundryDashboard = dynamic(() => import("@/components/laundry/views/laundry-dashboard").then(m => ({ default: m.LaundryDashboard })), { loading: () => <PageLoader /> })
const LaundryInboxView = dynamic(() => import("@/components/laundry/views/laundry-inbox-view").then(m => ({ default: m.LaundryInboxView })), { loading: () => <PageLoader /> })
const LaundryOrdersView = dynamic(() => import("@/components/laundry/views/laundry-orders-view").then(m => ({ default: m.LaundryOrdersView })), { loading: () => <PageLoader /> })
const LaundryNewOrder = dynamic(() => import("@/components/laundry/views/laundry-new-order").then(m => ({ default: m.default })), { loading: () => <PageLoader /> })
const LaundryCounterQueue = dynamic(() => import("@/components/laundry/views/laundry-counter-queue").then(m => ({ default: m.LaundryCounterQueue })), { loading: () => <PageLoader /> })
// Operational store-counter stages (real business actions, not status dropdowns)
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
const LaundryCategoriesMaster = dynamic(() => import("@/components/laundry/views/laundry-categories-master").then(m => ({ default: m.LaundryCategoriesMaster })), { loading: () => <PageLoader /> })
const LaundryGarmentsMaster = dynamic(() => import("@/components/laundry/views/laundry-garments-master").then(m => ({ default: m.LaundryGarmentsMaster })), { loading: () => <PageLoader /> })
const LaundryServicesMaster = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.ServicesMasterPage })), { loading: () => <PageLoader /> })
const LaundryPricingMatrix = dynamic(() => import("@/components/laundry/views/laundry-pricing-matrix").then(m => ({ default: m.LaundryPricingMatrix })), { loading: () => <PageLoader /> })
const LaundrySubscriptionPlansPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.SubscriptionPlansPage })), { loading: () => <PageLoader /> })
const LaundryChargesRulesPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.ChargesRulesPage })), { loading: () => <PageLoader /> })
const LaundryPricingSimulatorPage = dynamic(() => import("@/components/laundry/views/pricing/pricing-page-wrappers").then(m => ({ default: m.PricingSimulatorPage })), { loading: () => <PageLoader /> })
const LaundrySubscriptionsView = dynamic(() => import("@/components/laundry/views/laundry-subscriptions-view").then(m => ({ default: m.LaundrySubscriptionsView })), { loading: () => <PageLoader /> })
const LaundryStoreAudit = dynamic(() => import("@/components/laundry/views/laundry-store-audit").then(m => ({ default: m.LaundryStoreAudit })), { loading: () => <PageLoader /> })
const LaundryCustomersView = dynamic(() => import("@/components/laundry/views/laundry-customers-view").then(m => ({ default: m.LaundryCustomersView })), { loading: () => <PageLoader /> })
const LaundryRolesPermissions = dynamic(() => import("@/components/laundry/views/laundry-roles-permissions").then(m => ({ default: m.LaundryRolesPermissions })), { loading: () => <PageLoader /> })
const LaundryStaff = dynamic(() => import("@/components/laundry/views/laundry-staff").then(m => ({ default: m.LaundryStaff })), { loading: () => <PageLoader /> })
const LaundryProcessingConsole = dynamic(() => import("@/components/laundry/views/laundry-processing-console").then(m => ({ default: m.LaundryProcessingConsole })), { loading: () => <PageLoader /> })
const LaundryWorkstation = dynamic(() => import("@/components/laundry/views/laundry-workstation").then(m => ({ default: m.LaundryWorkstation })), { loading: () => <PageLoader /> })
const LaundryAuditBarcodePage = dynamic(() => import("@/components/laundry/views/laundry-audit-barcode-page").then(m => ({ default: m.LaundryAuditBarcodePage })), { loading: () => <PageLoader /> })
const LaundryReportsView = dynamic(() => import("@/components/laundry/views/laundry-reports-view").then(m => ({ default: m.LaundryReportsView })), { loading: () => <PageLoader /> })
const LaundryStoresWorkspace = dynamic(() => import("@/components/admin/laundry/laundry-stores-view").then(m => ({ default: m.LaundryStoresView })), { loading: () => <PageLoader /> })
const LaundryWorkspaceSettings = dynamic(() => import("@/components/laundry/views/laundry-workspace-settings").then(m => ({ default: m.LaundryWorkspaceSettings })), { loading: () => <PageLoader /> })
const ProcessingDashboard = dynamic(() => import("@/components/laundry/views/processing-dashboard").then(m => ({ default: m.ProcessingDashboard })), { loading: () => <PageLoader /> })
const LaundryGarmentLookup = dynamic(() => import("@/components/laundry/views/laundry-garment-lookup").then(m => ({ default: m.LaundryGarmentLookup })), { loading: () => <PageLoader /> })
// Optional CRM module (feature-gated per tenant; CrmGate + server enforce entitlement)
const CrmGate = dynamic(() => import("@/components/laundry/views/crm/crm-gate").then(m => ({ default: m.CrmGate })), { loading: () => <PageLoader /> })
const CrmDashboard = dynamic(() => import("@/components/laundry/views/crm/crm-dashboard").then(m => ({ default: m.CrmDashboard })), { loading: () => <PageLoader /> })
// Marketing module (Phase 1)
const MarketingGate = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingGate })), { loading: () => <PageLoader /> })
const MarketingDashboard = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingDashboard })), { loading: () => <PageLoader /> })
const MarketingCoupons = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingCoupons })), { loading: () => <PageLoader /> })
const MarketingDiscounts = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingDiscounts })), { loading: () => <PageLoader /> })
const MarketingReports = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingReports })), { loading: () => <PageLoader /> })
const MarketingPlaceholder = dynamic(() => import("@/components/laundry/views/marketing/marketing-views").then(m => ({ default: m.MarketingPlaceholder })), { loading: () => <PageLoader /> })
const CrmLeads = dynamic(() => import("@/components/laundry/views/crm/crm-leads").then(m => ({ default: m.CrmLeads })), { loading: () => <PageLoader /> })
const CrmOpportunities = dynamic(() => import("@/components/laundry/views/crm/crm-opportunities").then(m => ({ default: m.CrmOpportunities })), { loading: () => <PageLoader /> })
const CrmActivities = dynamic(() => import("@/components/laundry/views/crm/crm-activities").then(m => ({ default: m.CrmActivities })), { loading: () => <PageLoader /> })
const CrmTasks = dynamic(() => import("@/components/laundry/views/crm/crm-tasks").then(m => ({ default: m.CrmTasks })), { loading: () => <PageLoader /> })
const CrmReports = dynamic(() => import("@/components/laundry/views/crm/crm-reports").then(m => ({ default: m.CrmReports })), { loading: () => <PageLoader /> })
const CrmSettings = dynamic(() => import("@/components/laundry/views/crm/crm-settings").then(m => ({ default: m.CrmSettings })), { loading: () => <PageLoader /> })

// ── HRMS pages (lazy) ─────────────────────────────────────────────────────
const HrmsSettingsView = dynamic(() => import("@/components/admin/hrms/hrms-settings").then(m => ({ default: m.HrmsSettingsView })), { loading: () => <PageLoader /> })
const HrmsEmployeesView = dynamic(() => import("@/components/admin/hrms/hrms-employees").then(m => ({ default: m.HrmsEmployeesView })), { loading: () => <PageLoader /> })
const HrmsOwnershipView = dynamic(() => import("@/components/admin/hrms/hrms-ownership").then(m => ({ default: m.HrmsOwnershipView })), { loading: () => <PageLoader /> })
const HrmsCommissionPolicyView = dynamic(() => import("@/components/admin/hrms/hrms-commission-policy").then(m => ({ default: m.HrmsCommissionPolicyView })), { loading: () => <PageLoader /> })
const HrmsCommissionSlipView = dynamic(() => import("@/components/admin/hrms/hrms-commission-slip").then(m => ({ default: m.HrmsCommissionSlipView })), { loading: () => <PageLoader /> })
const HrmsOfferLetterView = dynamic(() => import("@/components/admin/hrms/hrms-offer-letter").then(m => ({ default: m.HrmsOfferLetterView })), { loading: () => <PageLoader /> })
const HrmsAnnexureView = dynamic(() => import("@/components/admin/hrms/hrms-annexure").then(m => ({ default: m.HrmsAnnexureView })), { loading: () => <PageLoader /> })
const HrmsTemplatesView = dynamic(() => import("@/components/admin/hrms/hrms-templates").then(m => ({ default: m.HrmsTemplatesView })), { loading: () => <PageLoader /> })
const HrmsPayslipView = dynamic(() => import("@/components/admin/hrms/hrms-payslip").then(m => ({ default: m.HrmsPayslipView })), { loading: () => <PageLoader /> })
const RevenueSignupOwnershipView   = dynamic(() => import("@/components/admin/revenue-ops/revenue-signup-ownership").then(m => ({ default: m.RevenueSignupOwnershipView })), { loading: () => <PageLoader /> })
const RevenueRenewalOwnershipView  = dynamic(() => import("@/components/admin/revenue-ops/revenue-renewal-ownership").then(m => ({ default: m.RevenueRenewalOwnershipView })), { loading: () => <PageLoader /> })
const RevenueAddonOwnershipView    = dynamic(() => import("@/components/admin/revenue-ops/revenue-addon-ownership").then(m => ({ default: m.RevenueAddonOwnershipView })), { loading: () => <PageLoader /> })
const RevenueCommissionProcessingView = dynamic(() => import("@/components/admin/revenue-ops/revenue-commission-processing").then(m => ({ default: m.RevenueCommissionProcessingView })), { loading: () => <PageLoader /> })

// ── Business Owner pages (lazy) ───────────────────────────────────────────
const BusinessDashboard = dynamic(() => import("@/components/business/dashboard/business-dashboard").then(m => ({ default: m.BusinessDashboard })), { loading: () => <PageLoader /> })
const BusinessInvoicesView = dynamic(() => import("@/components/business/invoices/business-invoices-view").then(m => ({ default: m.BusinessInvoicesView })), { loading: () => <PageLoader /> })
const OrdersView = dynamic(() => import("@/components/business/orders/orders-view").then(m => ({ default: m.OrdersView })), { loading: () => <PageLoader /> })
const ProductsView = dynamic(() => import("@/components/business/products/products-view").then(m => ({ default: m.ProductsView })), { loading: () => <PageLoader /> })
const CustomersView = dynamic(() => import("@/components/business/customers/customers-view").then(m => ({ default: m.CustomersView })), { loading: () => <PageLoader /> })
const ReportsView = dynamic(() => import("@/components/business/reports/reports-view").then(m => ({ default: m.ReportsView })), { loading: () => <PageLoader /> })
const StoreSettingsView = dynamic(() => import("@/components/business/settings/store-settings").then(m => ({ default: m.StoreSettingsView })), { loading: () => <PageLoader /> })

// ── Business Owner — extended modules (lazy) ──────────────────────────────
const InventoryView = dynamic(() => import("@/components/dashboard/inventory-view").then(m => ({ default: m.InventoryView })), { loading: () => <PageLoader /> })
const MarketingView = dynamic(() => import("@/components/dashboard/marketing-view").then(m => ({ default: m.MarketingView })), { loading: () => <PageLoader /> })
const OffersView = dynamic(() => import("@/components/dashboard/offers-view").then(m => ({ default: m.OffersView })), { loading: () => <PageLoader /> })
const ReviewsView = dynamic(() => import("@/components/dashboard/reviews-view").then(m => ({ default: m.ReviewsView })), { loading: () => <PageLoader /> })
const StaffView = dynamic(() => import("@/components/dashboard/staff-view").then(m => ({ default: m.StaffView })), { loading: () => <PageLoader /> })
const TaxView = dynamic(() => import("@/components/dashboard/tax-view").then(m => ({ default: m.TaxView })), { loading: () => <PageLoader /> })
const LoyaltyView = dynamic(() => import("@/components/dashboard/loyalty-view").then(m => ({ default: m.LoyaltyView })), { loading: () => <PageLoader /> })
const DeliveryZonesView = dynamic(() => import("@/components/dashboard/delivery-zones-view").then(m => ({ default: m.DeliveryZonesView })), { loading: () => <PageLoader /> })
const DeliveryPartnersView = dynamic(() => import("@/components/business/operations/delivery-partners-view").then(m => ({ default: m.DeliveryPartnersView })), { loading: () => <PageLoader /> })
const StoresView = dynamic(() => import("@/components/business/stores/stores-view").then(m => ({ default: m.StoresView })), { loading: () => <PageLoader /> })
const CategoriesView = dynamic(() => import("@/components/business/categories/categories-view").then(m => ({ default: m.CategoriesView })), { loading: () => <PageLoader /> })
const BrandingView = dynamic(() => import("@/components/business/branding/branding-view").then(m => ({ default: m.BrandingView })), { loading: () => <PageLoader /> })
const FeatureFlagsView = dynamic(() => import("@/components/business/feature-flags/feature-flags-view").then(m => ({ default: m.FeatureFlagsView })), { loading: () => <PageLoader /> })
const SubscriptionView = dynamic(() => import("@/components/business/subscription/subscription-view").then(m => ({ default: m.SubscriptionView })), { loading: () => <PageLoader /> })
const AppsView = dynamic(() => import("@/components/business/apps/apps-view").then(m => ({ default: m.AppsView })), { loading: () => <PageLoader /> })
const DeliveryAppView = dynamic(() => import("@/components/business/apps/delivery-app-view").then(m => ({ default: m.DeliveryAppView })), { loading: () => <PageLoader /> })
const WorkspaceOverview = dynamic(() => import("@/components/business/workspace/workspace-overview").then(m => ({ default: m.WorkspaceOverview })), { loading: () => <PageLoader /> })

// ── Customer App (lazy) ───────────────────────────────────────────────────
const CustomerAuth = dynamic(() => import("@/components/customer/auth/customer-auth").then(m => ({ default: m.CustomerAuth })), { loading: () => <PageLoader /> })
const CustomerHome = dynamic(() => import("@/components/customer/home/customer-home").then(m => ({ default: m.CustomerHome })), { loading: () => <PageLoader /> })
const CustomerProducts = dynamic(() => import("@/components/customer/products/customer-products").then(m => ({ default: m.CustomerProducts })), { loading: () => <PageLoader /> })
const CustomerProductDetail = dynamic(() => import("@/components/customer/products/customer-product-detail").then(m => ({ default: m.CustomerProductDetail })), { loading: () => <PageLoader /> })
const CustomerCart = dynamic(() => import("@/components/customer/cart/customer-cart").then(m => ({ default: m.CustomerCart })), { loading: () => <PageLoader /> })
const CustomerCheckout = dynamic(() => import("@/components/customer/checkout/customer-checkout").then(m => ({ default: m.CustomerCheckout })), { loading: () => <PageLoader /> })
const CustomerOrderTracking = dynamic(() => import("@/components/customer/orders/customer-order-tracking").then(m => ({ default: m.CustomerOrderTracking })), { loading: () => <PageLoader /> })
const CustomerProfile = dynamic(() => import("@/components/customer/profile/customer-profile").then(m => ({ default: m.CustomerProfile })), { loading: () => <PageLoader /> })
const CustomerOrders = dynamic(() => import("@/components/customer/orders/customer-orders").then(m => ({ default: m.CustomerOrders })), { loading: () => <PageLoader /> })
const CustomerAddresses = dynamic(() => import("@/components/customer/addresses/customer-addresses").then(m => ({ default: m.CustomerAddresses })), { loading: () => <PageLoader /> })
const CustomerNotifications = dynamic(() => import("@/components/customer/notifications/customer-notifications").then(m => ({ default: m.CustomerNotifications })), { loading: () => <PageLoader /> })
const CustomerSupport = dynamic(() => import("@/components/customer/support/customer-support").then(m => ({ default: m.CustomerSupport })), { loading: () => <PageLoader /> })
const CustomerWishlist = dynamic(() => import("@/components/customer/wishlist/customer-wishlist").then(m => ({ default: m.CustomerWishlist })), { loading: () => <PageLoader /> })
const CustomerReview = dynamic(() => import("@/components/customer/review/customer-review").then(m => ({ default: m.CustomerReview })), { loading: () => <PageLoader /> })
const CustomerCoupons = dynamic(() => import("@/components/customer/coupons/customer-coupons").then(m => ({ default: m.CustomerCoupons })), { loading: () => <PageLoader /> })
const CustomerInvoices = dynamic(() => import("@/components/customer/invoices/customer-invoices").then(m => ({ default: m.CustomerInvoices })), { loading: () => <PageLoader /> })
const CustomerInvoiceDetail = dynamic(() => import("@/components/customer/invoices/customer-invoice-detail").then(m => ({ default: m.CustomerInvoiceDetail })), { loading: () => <PageLoader /> })

// ── Storefront Shell (lazy) ───────────────────────────────────────────────
const StorefrontShell = dynamic(() => import("@/components/storefront/storefront-shell").then(m => ({ default: m.StorefrontShell })), { loading: () => <PageLoader /> })

// ── Web Storefront (desktop ecommerce website) ────────────────────────────
const StorefrontWebsite = dynamic(() => import("@/components/storefront/web/storefront-website").then(m => ({ default: m.StorefrontWebsite })), { loading: () => <SplashLoader /> })

// ── Delivery Partner (lazy) ───────────────────────────────────────────────
const DeliveryLogin = dynamic(() => import("@/components/delivery/auth/delivery-login").then(m => ({ default: m.DeliveryLogin })), { loading: () => <PageLoader /> })
const DeliveryDashboard = dynamic(() => import("@/components/delivery/dashboard/delivery-dashboard").then(m => ({ default: m.DeliveryDashboard })), { loading: () => <PageLoader /> })
const DeliveryOrderDetail = dynamic(() => import("@/components/delivery/orders/delivery-order-detail").then(m => ({ default: m.DeliveryOrderDetail })), { loading: () => <PageLoader /> })
const DeliveryEarnings = dynamic(() => import("@/components/delivery/earnings/delivery-earnings").then(m => ({ default: m.DeliveryEarnings })), { loading: () => <PageLoader /> })
const DeliveryProfile = dynamic(() => import("@/components/delivery/profile/delivery-profile").then(m => ({ default: m.DeliveryProfile })), { loading: () => <PageLoader /> })

// ── Workflow Engine (lazy) ────────────────────────────────────────────────
const WorkflowEngineView = dynamic(() => import("@/components/workflow/workflow-engine-view").then(m => ({ default: m.WorkflowEngineView })), { loading: () => <PageLoader /> })
const WorkflowConfigView = dynamic(() => import("@/components/workflow/workflow-config-view").then(m => ({ default: m.WorkflowConfigView })), { loading: () => <PageLoader /> })
const WorkflowInfoView = dynamic(() => import("@/components/workflow/workflow-info-view").then(m => ({ default: m.WorkflowInfoView })), { loading: () => <PageLoader /> })
const PlanComparison = dynamic(() => import("@/components/workflow/plan-comparison").then(m => ({ default: m.PlanComparison })), { loading: () => <PageLoader /> })

// ── Payment (lazy) ────────────────────────────────────────────────────────
const PaymentPluginsView = dynamic(() => import("@/components/admin/payment-plugins/payment-plugins-view").then(m => ({ default: m.PaymentPluginsView })), { loading: () => <PageLoader /> })
const GatewayConfigView = dynamic(() => import("@/components/business/payment/gateway-config-view").then(m => ({ default: m.GatewayConfigView })), { loading: () => <PageLoader /> })
const POSEnterprise = dynamic(() => import("@/components/business/pos/pos-enterprise").then(m => ({ default: m.POSEnterprise })), { loading: () => <PageLoader /> })

// ── Top-level routing ────────────────────────────────────────────────────
// AppRouter reads ?_storefront via useSearchParams() SYNCHRONOUSLY before
// any layout renders. This eliminates the admin login flash entirely:
// the slug is known at first render, so the correct layout is chosen
// before the browser paints anything.
//
// Suspense fallback shows a spinner (not the login page) while the
// client-side router initialises, which takes <100 ms.
export default function Home() {
  return (
    <AuthProvider>
      <Suspense fallback={<SplashLoader />}>
        <AppRouter />
      </Suspense>
    </AuthProvider>
  )
}

function SplashLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}

// Detect storefront slug from two sources so SSR and client always agree:
//
//   Server (SSR):  proxy.ts rewrites /?_storefront=slug — searchParams has the value.
//   Client:        browser URL stays as slug.quantixtechnology.in (no query param) —
//                  searchParams returns null after hydration.  Read hostname directly.
//
// page.tsx runs inside <Suspense> + useSearchParams() which makes it client-only
// (server renders the SplashLoader fallback). All subdomain routing is therefore
// done from window.location.hostname on the client — no server-side middleware.
//
// Reserved subdomains are NEVER treated as storefronts:
//   app, www, admin, api, mail → Quantix Core admin app
// Everything else → storefront slug (validated against DB by StorefrontContextLoader)
const _SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
// Reserved subdomains that are NEVER tenant storefronts: platform hosts plus
// product workspace hosts (commerce, laundry, …). Without reserving the product
// prefixes the SPA would treat commerce.<base> as a storefront slug instead of
// rendering the product workspace. Product prefixes come from the single source
// (product-hosts) so this stays in sync as products are added.
const _SF_RESERVED = new Set(["www", "app", "admin", "api", "mail", ...getProductHostPrefixes()])

// Hosts that are ALWAYS the Quantix Core admin app — never a storefront.
// Belt-and-suspenders: _SF_RESERVED already blocks "app", but an explicit
// allowlist is clearer and prevents future mismatches.
const PLATFORM_HOSTS = new Set([
  `app.${_SF_BASE}`,
  _SF_BASE,
  `www.${_SF_BASE}`,
])

function detectStorefrontSlug(searchParams: ReturnType<typeof useSearchParams>): string | null {
  // Support ?_storefront=slug if a server-side rewrite ever injects it
  const param = searchParams.get("_storefront")
  if (param && !_SF_RESERVED.has(param)) return param

  // Primary path: client-side hostname detection
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.split(":")[0]
    // Explicit platform host check — always admin, never storefront
    if (PLATFORM_HOSTS.has(hostname)) return null
    if (hostname.endsWith(`.${_SF_BASE}`)) {
      const slug = hostname.slice(0, -(_SF_BASE.length + 1))
      if (slug && !_SF_RESERVED.has(slug)) return slug
    }
  }
  return null
}

// Detect the Delivery PWA entry point ({slug}.domain/delivery) from both
// sources, mirroring detectStorefrontSlug:
//   Server (SSR):  proxy.ts rewrites /delivery → /?_storefront=slug&_delivery=1
//   Client:        browser URL keeps /delivery as the visible pathname
function detectDeliveryEntry(searchParams: ReturnType<typeof useSearchParams>): boolean {
  if (searchParams.get("_delivery") === "1") return true
  if (typeof window !== "undefined") {
    const p = window.location.pathname
    return p === "/delivery" || p.startsWith("/delivery/")
  }
  return false
}

// Detect a PRODUCT workspace request (commerce.<base>, laundry.<base>, …).
// Mirrors detectStorefrontSlug: the proxy injects ?_product & ?businessId on the
// server, but after hydration the browser URL is the original product host, so
// derive the product from the hostname and the businessId from the first path
// segment (workspace URLs are <product>.<base>/<businessId>).
function detectProductWorkspace(
  searchParams: ReturnType<typeof useSearchParams>,
): { productCode: string | null; businessId: string | null } {
  let productCode = searchParams.get("_product")
  let businessId = searchParams.get("businessId")
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.split(":")[0]
    const fromHost = getProductCodeForHost(hostname, _SF_BASE)
    if (fromHost) productCode = fromHost
    if (!businessId) {
      const seg = window.location.pathname.split("/").filter(Boolean)[0]
      if (seg) businessId = seg
    }
  }
  return { productCode: productCode || null, businessId: businessId || null }
}

function AppRouter() {
  const searchParams = useSearchParams()
  const storefrontSlug = detectStorefrontSlug(searchParams)
  const deliveryEntry = detectDeliveryEntry(searchParams)
  const { productCode: productWorkspaceCode, businessId: workspaceBusinessId } = detectProductWorkspace(searchParams)
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    console.log(
      "[AppRouter] host=", host,
      "| isPlatformHost=", PLATFORM_HOSTS.has(host),
      "| storefrontSlug=", storefrontSlug,
      "| productWorkspace=", productWorkspaceCode,
      "| workspaceBusinessId=", workspaceBusinessId,
      "| deliveryEntry=", deliveryEntry,
    )
  }
  return (
    <AppContent
      storefrontSlug={storefrontSlug}
      deliveryEntry={deliveryEntry}
      productWorkspaceCode={productWorkspaceCode}
      workspaceBusinessId={workspaceBusinessId}
    />
  )
}

const BUSINESS_ROLES = new Set(["CLIENT_OWNER", "STORE_MANAGER", "BILLING_STAFF", "INVENTORY_STAFF", "SUPPORT_STAFF", "LAUNDRY_OWNER", "LAUNDRY_STORE_MANAGER", "STORE_EXECUTIVE", "AUDIT_EXECUTIVE", "PROCESSING_MANAGER", "PROCESSING_STAFF", "QC_EXECUTIVE", "DELIVERY_EXECUTIVE"])

// Platform (Quantix) roles. Super Admin has UNRESTRICTED access and is NOT
// permission-driven — it must never be gated by a permission check (e.g.
// businesses:impersonate) nor treated as a misplaced/stale session. Business
// users are the permission-driven ones (Business → Store → Role → Permission).
const PLATFORM_ROLES = new Set(["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN", "QUANTIX_SALES_TEAM", "SUPPORT_TEAM", "FINANCE_TEAM", "DEPLOYMENT_TEAM"])

function AppContent({ storefrontSlug, deliveryEntry, productWorkspaceCode, workspaceBusinessId }: { storefrontSlug?: string | null; deliveryEntry?: boolean; productWorkspaceCode?: string | null; workspaceBusinessId?: string | null }) {
  const { viewMode, activePage, businessPage, customerPage, deliveryPage, deliveryLoggedIn, setDeliveryPage, setViewMode, setBusinessOwnerContext, laundryPage, supportMode, resumeBusinessId, manageBusinessId } = useAdminStore()
  const { isAuthenticated, currentRole, currentBusinessId, currentBusinessName, currentBusinessType, permissions, _isHydrated, _isSynced, setActiveBusinessId } = useAuthStore()

  const [storefrontNotFound, setStorefrontNotFound] = useState(false)
  // True only after store-context API confirms the business exists in DB.
  // Prevents StorefrontWebsite from rendering before the check completes —
  // eliminates the flash of customer OTP screen for deleted/invalid slugs.
  const [storefrontContextLoaded, setStorefrontContextLoaded] = useState(false)

  const isBusinessRole = BUSINESS_ROLES.has(currentRole || "")
  const isPlatformRole = PLATFORM_ROLES.has(currentRole || "")
  const canImpersonate = (permissions as string[]).includes("businesses:impersonate")
  // Business id the workspace operates on: the one launched on a product host
  // (Open Workspace) when present, otherwise the authenticated session business.
  const wsBusinessId = (productWorkspaceCode ? (workspaceBusinessId || currentBusinessId) : currentBusinessId) || ""

  // Guard: on admin host (no storefront slug), ALWAYS reset stale customer/delivery
  // viewMode — regardless of auth state. An authenticated CUSTOMER visiting
  // app.quantixtechnology.in must see the admin login, not their storefront session.
  useEffect(() => {
    if (storefrontSlug) return // legitimate storefront — keep customer/delivery mode
    if (!_isHydrated) return
    if (viewMode === "customer") setViewMode("super_admin")
    if (viewMode === "delivery_partner") setViewMode("super_admin")
  }, [storefrontSlug, viewMode, _isHydrated, setViewMode])

  // Delivery PWA entry: {slug}.domain/delivery boots straight into delivery
  // mode (login screen when unauthenticated) instead of the customer storefront.
  useEffect(() => {
    if (!storefrontSlug || !deliveryEntry || !_isHydrated) return
    if (viewMode !== "delivery_partner") setViewMode("delivery_partner")
    if (!deliveryLoggedIn && deliveryPage !== "login") setDeliveryPage("login")
  }, [storefrontSlug, deliveryEntry, _isHydrated, viewMode, deliveryLoggedIn, deliveryPage, setViewMode, setDeliveryPage])

  // Sync viewMode from auth session on mount / auth change
  useEffect(() => {
    if (!isAuthenticated) return

    // Don't override viewMode when Laundry OS support mode is active
    if (supportMode.active) return

    // Product workspace host (commerce.*, laundry.*): initialize the selected
    // business's PRODUCT workspace — for its owner, or for a platform admin who
    // launched "Open Workspace". Keyed off ROLE (stable across permission sync),
    // not the canImpersonate PERMISSION, which could flip during syncPermissions()
    // and bounce the user back to the PLATFORM workspace → Access Denied.
    if (productWorkspaceCode && (isBusinessRole || isPlatformRole)) {
      const bizId = workspaceBusinessId || currentBusinessId
      if (bizId) {
        // The product workspace operates on this business; a platform admin's
        // session has no business, so set it here. Laundry/commerce APIs accept
        // either the LaundryBusiness.id or the platform business id.
        if (currentBusinessId !== bizId) setActiveBusinessId(bizId)
        if (viewMode !== "business_owner") {
          const bizType = productWorkspaceCode === "LAUNDRY" ? "LAUNDRY" : (currentBusinessType || "COMMERCE")
          setBusinessOwnerContext(bizId, currentBusinessName || "", bizType)
        }
        return
      }
    }

    if (isPlatformRole) {
      if (viewMode !== "super_admin") setViewMode("super_admin")
    } else if (BUSINESS_ROLES.has(currentRole || "")) {
      if (currentBusinessId && viewMode !== "business_owner") {
        setBusinessOwnerContext(currentBusinessId, currentBusinessName || "", currentBusinessType || "")
      }
    } else if (currentRole === "CUSTOMER") {
      // Only enter customer mode when actually on a storefront subdomain.
      // On app.quantixtechnology.in an authenticated CUSTOMER must see admin login.
      if (storefrontSlug && viewMode !== "customer") setViewMode("customer")
    } else if (currentRole === "DELIVERY_STAFF") {
      if (storefrontSlug && viewMode !== "delivery_partner") setViewMode("delivery_partner")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentRole, currentBusinessId, supportMode.active, productWorkspaceCode, workspaceBusinessId])

  // Guard: if somehow in business_owner view without the right role/permission,
  // redirect via effect (never setState during render — that triggers the error boundary loop).
  // Skip on a product workspace host: there business_owner is the intended mode
  // (set from the product host above), and reverting it on a transient
  // canImpersonate=false during permission sync caused the Access Denied flicker.
  useEffect(() => {
    if (supportMode.active) return
    if (productWorkspaceCode) return
    if (viewMode === "business_owner" && _isHydrated && !isBusinessRole && !isPlatformRole && !canImpersonate) {
      setViewMode("super_admin")
    }
  }, [viewMode, _isHydrated, isBusinessRole, isPlatformRole, canImpersonate, supportMode.active, setViewMode, productWorkspaceCode])

  const renderSuperAdminPage = () => {
    // Wait for syncPermissions() to finish before running access checks —
    // avoids showing AccessDenied for users whose localStorage cache predates
    // a new permission being added to a role.
    if (!_isSynced) return <PageLoader />
    // Super Admin has UNRESTRICTED access and is not permission-driven — it
    // bypasses the per-page permission gate entirely. Every other role (business
    // users, other platform teams) remains authorization-driven.
    if (currentRole !== "QUANTIX_SUPER_ADMIN" && !canAccessPage(activePage, permissions as string[])) {
      return <AccessDenied />
    }
    switch (activePage) {
      // Workflow Engine
      case "workflow-engine": return <WorkflowEngineView />
      case "plan-management": return <PlanComparison />
      // Payment
      case "payment-plugins": return <PaymentPluginsView />
      // Core
      case "dashboard": return <DashboardView />
      case "leads": return <LeadsView />
      case "proposals": return <QuoteProposalView />
      case "proposal-documents": return <ErrorBoundary view="admin"><ProposalDocumentsView /></ErrorBoundary>
      case "payment-config": return <PaymentConfigView />
      case "businesses": return <BusinessesView />
      // Single business experience: same wizard for Create (no id / resume draft) and Manage (existing id).
      case "create-business": return <BusinessManagementWizard businessId={resumeBusinessId ?? undefined} />
      case "manage-business": return <BusinessManagementWizard businessId={manageBusinessId ?? undefined} />
      case "account-billing": return <AccountBillingView />
      case "subscriptions": return <SubscriptionsView />
      case "platform-invoices": return <PlatformInvoicesView />
      case "addons": return <AddonsView />
      case "onboarding": return <OnboardingView />
      case "domains": return <DomainsView />
      case "sales": return <SalesView />
      case "platform-users": return <PlatformUsersView />
      case "roles-permissions": return <PermissionMatrixView />
      case "notifications": return <NotificationsView />
      case "settings": return <SettingsView />
      case "platform-settings": return <PlatformSettingsView />
      case "brand-studio": return <BrandStudioView />
      case "commission-calculator": return <CommissionView />
      // HRMS
      case "hrms-employees":        return <HrmsEmployeesView />
      case "hrms-offer-letter":     return <HrmsOfferLetterView />
      case "hrms-annexure":         return <HrmsAnnexureView />
      case "hrms-commission-slip":  return <HrmsCommissionSlipView />
      case "hrms-payslip":          return <HrmsPayslipView />
      case "hrms-templates":        return <HrmsTemplatesView />
      case "hrms-settings":         return <HrmsSettingsView />
      // Revenue Operations
      case "rev-signup-ownership":      return <RevenueSignupOwnershipView />
      case "rev-renewal-ownership":     return <RevenueRenewalOwnershipView />
      case "rev-addon-ownership":       return <RevenueAddonOwnershipView />
      case "rev-commission-processing": return <RevenueCommissionProcessingView />
      // Mobile & Apps
      case "mobile-apps": return <MobileAppsView />
      // Deployment & Operations
      case "ops-dashboard": return <OpsDashboardView />
      case "deployment-pipeline": return <DeploymentPipelineView />
      case "build-automation": return <BuildAutomationView />
      case "release-management": return <ReleaseManagementView />
      case "play-store": return <PlayStoreView />
      case "mobile-versions": return <MobileVersionsView />
      // Client Operations
      case "client-assets": return <ClientAssetsView />
      case "tenant-provisioning": return <TenantProvisioningView />
      case "product-import": return <ProductImportView />
      case "onboarding-checklist": return <OnboardingChecklistView />
      // Data Imports
      case "leads-import": return <LeadsImportView />
      case "business-data-import": return <BusinessImportView />
      // Platform Operations
      case "platform-analytics": return <PlatformAnalyticsView />
      case "revenue": return <RevenueView />
      case "support": return <SupportView />
      // System
      case "backup-monitoring": return <BackupMonitoringView />
      case "security-access": return <SecurityAccessView />
      case "audit-logs": return <AuditLogsView />
      case "products": return <ProductsRegistryView />
      case "commerce-templates": return <CommerceTemplateLibrary />
      case "workspaces": return <WorkspacesRegistryView />
      // Website
      case "quantix-website": return <QuantixWebsiteView />
      // Laundry OS
      case "laundry-os": return <LaundryOsView />
      case "laundry-businesses": return <LaundryBusinessesView />
      default: return <WorkflowEngineView />
    }
  }

  const PROCESSING_ROLES = new Set(["PROCESSING_MANAGER", "PROCESSING_STAFF", "QC_EXECUTIVE"])
  const isProcessingRole = currentRole ? PROCESSING_ROLES.has(currentRole) : false

  const renderLaundryPage = () => {
    if (isProcessingRole) {
      switch (laundryPage) {
        case "dashboard": return <ProcessingDashboard />
        case "processing-centers": return <LaundryProcessingConsole />
        case "audit-barcode": return <LaundryAuditBarcodePage />
        case "ws-wash": return <LaundryWorkstation stage="WASH" />
        case "ws-dry": return <LaundryWorkstation stage="DRY" />
        case "ws-dryclean": return <LaundryWorkstation stage="DRYCLEAN" />
        case "ws-iron": return <LaundryWorkstation stage="IRON" />
        case "ws-fold": return <LaundryWorkstation stage="FOLD" />
        case "ws-qc": return <LaundryWorkstation stage="QC" />
        case "ws-pack": return <LaundryWorkstation stage="PACKED" />
        case "orders": return <LaundryOrdersView />
        case "reports": return <LaundryReportsView />
        case "garment-lookup": return <LaundryGarmentLookup />
        default: return <ProcessingDashboard />
      }
    }
    switch (laundryPage) {
      // Optional CRM module — separate screens from Laundry OS operations
      case "crm-dashboard": return <CrmGate><CrmDashboard businessId={wsBusinessId} /></CrmGate>
      case "crm-leads": return <CrmGate><CrmLeads businessId={wsBusinessId} /></CrmGate>
      case "crm-opportunities": return <CrmGate><CrmOpportunities businessId={wsBusinessId} /></CrmGate>
      case "crm-activities": return <CrmGate><CrmActivities businessId={wsBusinessId} /></CrmGate>
      case "crm-tasks": return <CrmGate><CrmTasks businessId={wsBusinessId} /></CrmGate>
      case "crm-reports": return <CrmGate><CrmReports businessId={wsBusinessId} /></CrmGate>
      case "crm-settings": return <CrmGate><CrmSettings businessId={wsBusinessId} /></CrmGate>
      // Marketing module (Phase 1: live screens; later-phase modules = placeholder)
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
      case "dashboard": return <LaundryDashboard />
      case "inbox": return <LaundryInboxView />
      case "orders": return <LaundryOrdersView />
      case "new-order": return <LaundryNewOrder />
      case "audit-queue": return <LaundryStoreAudit />
      case "payment-queue": return <LaundryPaymentCollection />
      case "packing-queue": return <LaundryPacking />
      case "dispatch-queue": return <LaundryDispatch />
      case "store-receive-queue": return <LaundryStoreReceive />
      case "pickup-bags": return <LaundryPickupBags />
      case "bag-management": return <LaundryBagManagement />
      case "dispatch-center": return <LaundryDispatchCenter />
      // Legacy deep links now land on the unified Dispatch Center.
      case "pickup-scheduler": return <LaundryDispatchCenter />
      case "delivery-assignments": return <LaundryDispatchCenter />
      case "delivery-executives": return <LaundryDeliveryExecutives />
      case "mobile-apps": return <LaundryMobileApps />
      case "ready-delivery-queue": return <LaundryReadyForDelivery />
      case "order-detail": return <LaundryOrderDetail />
      case "customers": return <LaundryCustomersView />
      case "stores": return <LaundryStoresWorkspace businessId={wsBusinessId} />
      case "processing-centers": return <LaundryProcessingConsole />
      case "audit-barcode": return <LaundryAuditBarcodePage />
      case "ws-wash": return <LaundryWorkstation stage="WASH" />
      case "ws-dry": return <LaundryWorkstation stage="DRY" />
      case "ws-dryclean": return <LaundryWorkstation stage="DRYCLEAN" />
      case "ws-iron": return <LaundryWorkstation stage="IRON" />
      case "ws-fold": return <LaundryWorkstation stage="FOLD" />
      case "ws-qc": return <LaundryWorkstation stage="QC" />
      case "ws-pack": return <LaundryWorkstation stage="PACKED" />
      case "reports": return <LaundryReportsView />
      case "settings": return <LaundryWorkspaceSettings businessId={wsBusinessId} />
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
      case "garment-lookup": return <LaundryGarmentLookup />
      default: return <LaundryDashboard />
    }
  }

  const renderBusinessPage = () => {
    switch (businessPage) {
      case "dashboard": return <BusinessDashboard />
      case "orders": return <OrdersView />
      case "products": return <ProductsView />
      case "inventory": return <InventoryView />
      case "pos": return <POSEnterprise />
      case "customers": return <CustomersView />
      case "reports": return <ReportsView />
      case "settings": return <StoreSettingsView />
      case "marketing": return <MarketingView />
      case "offers": return <OffersView />
      case "reviews": return <ReviewsView />
      case "staff": return <StaffView />
      case "tax": return <TaxView />
      case "loyalty": return <LoyaltyView />
      case "product-import": return <ProductImportView />
      case "business-data-import": return <BusinessImportView />
      case "customer-import": return <BulkCustomerUploadView />
      case "user-creation": return <UserCreationView />
      case "user-management": return <UserManagementView />
      case "delivery-zones": return <DeliveryZonesView />
      case "delivery-partners": return <DeliveryPartnersView />
      case "stores": return <StoresView />
      case "storefront": return <StorefrontShell />
      // Workflow Engine
      case "workflow-config": return <WorkflowInfoView />
      case "workflows": return <WorkflowEngineView />
      // Payment
      case "gateway-config": return <GatewayConfigView />
      // Platform config
      case "categories": return <CategoriesView />
      case "branding": return <BrandingView />
      case "feature-flags": return <FeatureFlagsView />
      case "subscription-view": return <SubscriptionView />
      case "customer-app": return <AppsView />
      case "delivery-app": return <DeliveryAppView />
      case "admin-app": return <AppsView />
      case "website": return <AppsView />
      case "onboarding-progress": return <WorkspaceOverview />
      case "invoices": return <BusinessInvoicesView />
      default: return <BusinessDashboard />
    }
  }

  const renderCustomerPage = () => {
    switch (customerPage) {
      case "auth": return <CustomerAuth />
      case "home": return <CustomerHome />
      case "products": return <CustomerProducts />
      case "product-detail": return <CustomerProductDetail />
      case "cart": return <CustomerCart />
      case "checkout": return <CustomerCheckout />
      case "order-tracking": return <CustomerOrderTracking />
      case "profile": return <CustomerProfile />
      case "orders": return <CustomerOrders />
      case "addresses": return <CustomerAddresses />
      case "notifications": return <CustomerNotifications />
      case "support": return <CustomerSupport />
      case "wishlist": return <CustomerWishlist />
      case "review": return <CustomerReview />
      case "coupons": return <CustomerCoupons />
      case "invoices": return <CustomerInvoices />
      case "invoice-detail": return <CustomerInvoiceDetail />
      default: return <CustomerHome />
    }
  }

  const renderDeliveryPage = () => {
    switch (deliveryPage) {
      case "login": return <DeliveryLogin />
      case "dashboard": return <DeliveryDashboard />
      case "order-detail": return <DeliveryOrderDetail />
      case "earnings": return <DeliveryEarnings />
      case "profile": return <DeliveryProfile />
      default: return <DeliveryDashboard />
    }
  }

  // ── Storefront subdomain request ────────────────────────────────────────
  // storefrontSlug comes from middleware rewrite (?_storefront=slug) on the server
  // or hostname detection on the client. StorefrontContextLoader validates the slug
  // against the DB before StorefrontWebsite is allowed to render — no flash of
  // customer UI for deleted or invalid subdomains.
  if (storefrontSlug) {
    // Delivery PWA entry ({slug}.domain/delivery) MUST be handled before
    // StorefrontContextLoader runs. StorefrontContextLoader calls setViewMode("customer")
    // after its API fetch completes, which permanently overrides delivery_partner mode —
    // the storefront wins every time because storefrontContextLoaded stays true even
    // after the delivery entry effect fires. Skip the storefront path entirely here.
    if (deliveryEntry) {
      return (
        <DeliveryLayout>
          {deliveryLoggedIn ? renderDeliveryPage() : <DeliveryLogin />}
        </DeliveryLayout>
      )
    }

    const isAdminSession = _isHydrated && isAuthenticated && currentRole &&
      !['CUSTOMER', 'DELIVERY_STAFF'].includes(currentRole)

    if (!isAdminSession) {
      // Slug was looked up in DB and business does not exist / is not active.
      if (storefrontNotFound) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-center px-4 gap-6">
            <div className="text-7xl font-black text-white/10 select-none">404</div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">Business Not Found</h1>
              <p className="text-sm text-white/40 max-w-xs">
                <span className="font-mono text-white/60">{storefrontSlug}.{process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in'}</span>
                {' '}does not exist or has been removed.
              </p>
            </div>
            <a
              href={`https://app.${process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN ?? 'quantixtechnology.in'}`}
              className="text-xs text-white/20 hover:text-white/50 transition-colors"
            >
              Quantix Technology
            </a>
          </div>
        )
      }

      // storefrontContextLoaded is false until StorefrontContextLoader confirms
      // the business exists in DB. Always show SplashLoader until then so a
      // deleted slug never renders the customer UI even for a millisecond.
      return (
        <>
          <StorefrontContextLoader
            slug={storefrontSlug}
            onNotFound={() => setStorefrontNotFound(true)}
            onLoaded={() => setStorefrontContextLoaded(true)}
          />
          {storefrontContextLoaded ? <StorefrontWebsite /> : <SplashLoader />}
        </>
      )
    }
  }

  // ── Standard SPA routing ─────────────────────────────────────────────────
  if (viewMode === "customer") {
    // CustomerLayout MUST only render on a real storefront subdomain.
    // If storefrontSlug is null we are on the admin host — show spinner while
    // the reset effect above flips viewMode back to super_admin.
    if (!storefrontSlug) return <SplashLoader />
    return (
      <CustomerLayout>
        {renderCustomerPage()}
      </CustomerLayout>
    )
  }

  if (viewMode === "delivery_partner") {
    if (!storefrontSlug) return <SplashLoader />
    return (
      <DeliveryLayout>
        {renderDeliveryPage()}
      </DeliveryLayout>
    )
  }

  if (viewMode === "business_owner") {
    // Session no longer authorises a business workspace (wrong role / lost
    // impersonate permission — e.g. a stale or expired session, common on a
    // product-workspace host where the reset effect is intentionally skipped).
    // NEVER render a blank screen here: show a loader while permissions are
    // still syncing, then clear the stale session and drop to Login once we
    // know for certain the session cannot use this workspace.
    // Super Admin / platform roles have unrestricted access and are NEVER gated
    // here (they legitimately open any workspace without an impersonate
    // permission). Business roles and impersonators also pass. Only a session
    // that is none of these is genuinely misplaced.
    if (_isHydrated && !isBusinessRole && !isPlatformRole && !canImpersonate) {
      if (!_isSynced) return <PageLoader />
      return <SessionRecovery />
    }
    // Laundry workspace is chosen by the business type OR, on a product host,
    // by the product itself (so a platform admin launching laundry.* gets the
    // Laundry workspace even though their session has no business type).
    if (currentBusinessType === "LAUNDRY" || productWorkspaceCode === "LAUNDRY") {
      return (
        <LaundryLayout>
          {renderLaundryPage()}
        </LaundryLayout>
      )
    }
    return (
      <BusinessLayout>
        {renderBusinessPage()}
      </BusinessLayout>
    )
  }

  return (
    <AdminLayout>
      {renderSuperAdminPage()}
    </AdminLayout>
  )
}
