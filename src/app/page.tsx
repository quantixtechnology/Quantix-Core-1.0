"use client"

import dynamic from "next/dynamic"
import { AuthProvider } from "@/components/auth/auth-provider"
import { useAuthStore } from "@/stores/auth-store"
import { AdminLayout } from "@/components/admin/layout/admin-layout"
import { BusinessLayout } from "@/components/business/layout/business-layout"
import { CustomerLayout } from "@/components/customer/layout/customer-layout"
import { DeliveryLayout } from "@/components/delivery/layout/delivery-layout"
import { useAdminStore } from "@/stores/admin-store"

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

// ── Admin pages (lazy) ────────────────────────────────────────────────────
const DashboardView = dynamic(() => import("@/components/admin/dashboard/dashboard-view").then(m => ({ default: m.DashboardView })), { loading: () => <PageLoader /> })
const LeadsView = dynamic(() => import("@/components/admin/leads/leads-view").then(m => ({ default: m.LeadsView })), { loading: () => <PageLoader /> })
const BusinessesView = dynamic(() => import("@/components/admin/businesses/businesses-view").then(m => ({ default: m.BusinessesView })), { loading: () => <PageLoader /> })
const SubscriptionsView = dynamic(() => import("@/components/admin/subscriptions/subscriptions-view").then(m => ({ default: m.SubscriptionsView })), { loading: () => <PageLoader /> })
const OnboardingView = dynamic(() => import("@/components/admin/onboarding/onboarding-view").then(m => ({ default: m.OnboardingView })), { loading: () => <PageLoader /> })
const DomainsView = dynamic(() => import("@/components/admin/domains/domains-view").then(m => ({ default: m.DomainsView })), { loading: () => <PageLoader /> })
const DemoTenantsView = dynamic(() => import("@/components/admin/demo-tenants/demo-tenants-view").then(m => ({ default: m.DemoTenantsView })), { loading: () => <PageLoader /> })
const SalesView = dynamic(() => import("@/components/admin/sales/sales-view").then(m => ({ default: m.SalesView })), { loading: () => <PageLoader /> })
const NotificationsView = dynamic(() => import("@/components/admin/notifications/notifications-view").then(m => ({ default: m.NotificationsView })), { loading: () => <PageLoader /> })
const SettingsView = dynamic(() => import("@/components/admin/settings/settings-view").then(m => ({ default: m.SettingsView })), { loading: () => <PageLoader /> })

// ── Deployment & Operations (lazy) ────────────────────────────────────────
const OpsDashboardView = dynamic(() => import("@/components/dashboard/ops-dashboard-view").then(m => ({ default: m.OpsDashboardView })), { loading: () => <PageLoader /> })
const DeploymentPipelineView = dynamic(() => import("@/components/dashboard/deployment-pipeline-view").then(m => ({ default: m.DeploymentPipelineView })), { loading: () => <PageLoader /> })
const BuildAutomationView = dynamic(() => import("@/components/dashboard/build-automation-view").then(m => ({ default: m.BuildAutomationView })), { loading: () => <PageLoader /> })
const ReleaseManagementView = dynamic(() => import("@/components/dashboard/release-management-view").then(m => ({ default: m.ReleaseManagementView })), { loading: () => <PageLoader /> })
const PlayStoreView = dynamic(() => import("@/components/dashboard/play-store-view").then(m => ({ default: m.PlayStoreView })), { loading: () => <PageLoader /> })
const MobileVersionsView = dynamic(() => import("@/components/dashboard/mobile-versions-view").then(m => ({ default: m.MobileVersionsView })), { loading: () => <PageLoader /> })
const MobileAppsView = dynamic(() => import("@/components/dashboard/mobile-apps-view").then(m => ({ default: m.MobileAppsView })), { loading: () => <PageLoader /> })

// ── Client Operations (lazy) ──────────────────────────────────────────────
const ClientAssetsView = dynamic(() => import("@/components/dashboard/client-assets-view").then(m => ({ default: m.ClientAssetsView })), { loading: () => <PageLoader /> })
const TenantProvisioningView = dynamic(() => import("@/components/dashboard/tenant-provisioning-view").then(m => ({ default: m.TenantProvisioningView })), { loading: () => <PageLoader /> })
const ProductImportView = dynamic(() => import("@/components/dashboard/product-import-view").then(m => ({ default: m.ProductImportView })), { loading: () => <PageLoader /> })
const OnboardingChecklistView = dynamic(() => import("@/components/dashboard/onboarding-checklist-view").then(m => ({ default: m.OnboardingChecklistView })), { loading: () => <PageLoader /> })

// ── Platform Operations (lazy) ────────────────────────────────────────────
const PlatformAnalyticsView = dynamic(() => import("@/components/dashboard/platform-analytics-view").then(m => ({ default: m.PlatformAnalyticsView })), { loading: () => <PageLoader /> })
const RevenueView = dynamic(() => import("@/components/dashboard/revenue-view").then(m => ({ default: m.RevenueView })), { loading: () => <PageLoader /> })
const SupportView = dynamic(() => import("@/components/dashboard/support-view").then(m => ({ default: m.SupportView })), { loading: () => <PageLoader /> })

// ── System (lazy) ─────────────────────────────────────────────────────────
const BackupMonitoringView = dynamic(() => import("@/components/dashboard/backup-monitoring-view").then(m => ({ default: m.BackupMonitoringView })), { loading: () => <PageLoader /> })
const SecurityAccessView = dynamic(() => import("@/components/dashboard/security-access-view").then(m => ({ default: m.SecurityAccessView })), { loading: () => <PageLoader /> })
const AuditLogsView = dynamic(() => import("@/components/dashboard/audit-logs-view").then(m => ({ default: m.AuditLogsView })), { loading: () => <PageLoader /> })

// ── Business Owner pages (lazy) ───────────────────────────────────────────
const BusinessDashboard = dynamic(() => import("@/components/business/dashboard/business-dashboard").then(m => ({ default: m.BusinessDashboard })), { loading: () => <PageLoader /> })
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

// ── Storefront Shell (lazy) ───────────────────────────────────────────────
const StorefrontShell = dynamic(() => import("@/components/storefront/storefront-shell").then(m => ({ default: m.StorefrontShell })), { loading: () => <PageLoader /> })

// ── Delivery Partner (lazy) ───────────────────────────────────────────────
const DeliveryLogin = dynamic(() => import("@/components/delivery/auth/delivery-login").then(m => ({ default: m.DeliveryLogin })), { loading: () => <PageLoader /> })
const DeliveryDashboard = dynamic(() => import("@/components/delivery/dashboard/delivery-dashboard").then(m => ({ default: m.DeliveryDashboard })), { loading: () => <PageLoader /> })
const DeliveryOrderDetail = dynamic(() => import("@/components/delivery/orders/delivery-order-detail").then(m => ({ default: m.DeliveryOrderDetail })), { loading: () => <PageLoader /> })
const DeliveryEarnings = dynamic(() => import("@/components/delivery/earnings/delivery-earnings").then(m => ({ default: m.DeliveryEarnings })), { loading: () => <PageLoader /> })
const DeliveryProfile = dynamic(() => import("@/components/delivery/profile/delivery-profile").then(m => ({ default: m.DeliveryProfile })), { loading: () => <PageLoader /> })

// ── Workflow Engine (lazy) ────────────────────────────────────────────────
const WorkflowEngineView = dynamic(() => import("@/components/workflow/workflow-engine-view").then(m => ({ default: m.WorkflowEngineView })), { loading: () => <PageLoader /> })
const WorkflowConfigView = dynamic(() => import("@/components/workflow/workflow-config-view").then(m => ({ default: m.WorkflowConfigView })), { loading: () => <PageLoader /> })
const PlanComparison = dynamic(() => import("@/components/workflow/plan-comparison").then(m => ({ default: m.PlanComparison })), { loading: () => <PageLoader /> })

// ── Payment (lazy) ────────────────────────────────────────────────────────
const PaymentPluginsView = dynamic(() => import("@/components/admin/payment-plugins/payment-plugins-view").then(m => ({ default: m.PaymentPluginsView })), { loading: () => <PageLoader /> })
const GatewayConfigView = dynamic(() => import("@/components/business/payment/gateway-config-view").then(m => ({ default: m.GatewayConfigView })), { loading: () => <PageLoader /> })
const POSEnterprise = dynamic(() => import("@/components/business/pos/pos-enterprise").then(m => ({ default: m.POSEnterprise })), { loading: () => <PageLoader /> })

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { viewMode, activePage, businessPage, customerPage, deliveryPage } = useAdminStore()

  const renderSuperAdminPage = () => {
    switch (activePage) {
      // Workflow Engine
      case "workflow-engine": return <WorkflowEngineView />
      case "plan-management": return <PlanComparison />
      // Payment
      case "payment-plugins": return <PaymentPluginsView />
      // Core
      case "dashboard": return <DashboardView />
      case "leads": return <LeadsView />
      case "businesses": return <BusinessesView />
      case "subscriptions": return <SubscriptionsView />
      case "onboarding": return <OnboardingView />
      case "domains": return <DomainsView />
      case "demo-tenants": return <DemoTenantsView />
      case "sales": return <SalesView />
      case "notifications": return <NotificationsView />
      case "settings": return <SettingsView />
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
      // Platform Operations
      case "platform-analytics": return <PlatformAnalyticsView />
      case "revenue": return <RevenueView />
      case "support": return <SupportView />
      // System
      case "backup-monitoring": return <BackupMonitoringView />
      case "security-access": return <SecurityAccessView />
      case "audit-logs": return <AuditLogsView />
      default: return <WorkflowEngineView />
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
      case "delivery-zones": return <DeliveryZonesView />
      case "storefront": return <StorefrontShell />
      // Workflow Engine
      case "workflow-config": return <WorkflowConfigView />
      case "workflows": return <WorkflowEngineView />
      // Payment
      case "gateway-config": return <GatewayConfigView />
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
      case "support": return <CustomerProfile />
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

  if (viewMode === "customer") {
    return (
      <CustomerLayout>
        {renderCustomerPage()}
      </CustomerLayout>
    )
  }

  if (viewMode === "delivery_partner") {
    return (
      <DeliveryLayout>
        {renderDeliveryPage()}
      </DeliveryLayout>
    )
  }

  if (viewMode === "business_owner") {
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
