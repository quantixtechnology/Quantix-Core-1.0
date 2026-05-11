"use client"

import { AuthProvider } from "@/components/auth/auth-provider"
import { useAuthStore } from "@/stores/auth-store"
import { AdminLayout } from "@/components/admin/layout/admin-layout"
import { BusinessLayout } from "@/components/business/layout/business-layout"
import { CustomerLayout } from "@/components/customer/layout/customer-layout"
import { DeliveryLayout } from "@/components/delivery/layout/delivery-layout"
import { useAdminStore } from "@/stores/admin-store"
// Admin pages
import { DashboardView } from "@/components/admin/dashboard/dashboard-view"
import { LeadsView } from "@/components/admin/leads/leads-view"
import { BusinessesView } from "@/components/admin/businesses/businesses-view"
import { SubscriptionsView } from "@/components/admin/subscriptions/subscriptions-view"
import { OnboardingView } from "@/components/admin/onboarding/onboarding-view"
import { DomainsView } from "@/components/admin/domains/domains-view"
import { DemoTenantsView } from "@/components/admin/demo-tenants/demo-tenants-view"
import { SalesView } from "@/components/admin/sales/sales-view"
import { NotificationsView } from "@/components/admin/notifications/notifications-view"
import { SettingsView } from "@/components/admin/settings/settings-view"
// Phase 6 — Deployment & Operations
import { OpsDashboardView } from "@/components/dashboard/ops-dashboard-view"
import { DeploymentPipelineView } from "@/components/dashboard/deployment-pipeline-view"
import { BuildAutomationView } from "@/components/dashboard/build-automation-view"
import { ReleaseManagementView } from "@/components/dashboard/release-management-view"
import { PlayStoreView } from "@/components/dashboard/play-store-view"
import { MobileVersionsView } from "@/components/dashboard/mobile-versions-view"
import { MobileAppsView } from "@/components/dashboard/mobile-apps-view"
// Phase 6 — Client Operations
import { ClientAssetsView } from "@/components/dashboard/client-assets-view"
import { TenantProvisioningView } from "@/components/dashboard/tenant-provisioning-view"
import { ProductImportView } from "@/components/dashboard/product-import-view"
import { OnboardingChecklistView } from "@/components/dashboard/onboarding-checklist-view"
// Phase 6 — Platform Operations
import { PlatformAnalyticsView } from "@/components/dashboard/platform-analytics-view"
import { RevenueView } from "@/components/dashboard/revenue-view"
import { SupportView } from "@/components/dashboard/support-view"
// Phase 6 — System
import { BackupMonitoringView } from "@/components/dashboard/backup-monitoring-view"
import { SecurityAccessView } from "@/components/dashboard/security-access-view"
import { AuditLogsView } from "@/components/dashboard/audit-logs-view"
// Business Owner pages
import { BusinessDashboard } from "@/components/business/dashboard/business-dashboard"
import { OrdersView } from "@/components/business/orders/orders-view"
import { ProductsView } from "@/components/business/products/products-view"
import { POSView } from "@/components/business/pos/pos-view"
import { CustomersView } from "@/components/business/customers/customers-view"
import { ReportsView } from "@/components/business/reports/reports-view"
import { StoreSettingsView } from "@/components/business/settings/store-settings"
// Business Owner — extended modules
import { InventoryView } from "@/components/dashboard/inventory-view"
import { MarketingView } from "@/components/dashboard/marketing-view"
import { OffersView } from "@/components/dashboard/offers-view"
import { ReviewsView } from "@/components/dashboard/reviews-view"
import { StaffView } from "@/components/dashboard/staff-view"
import { TaxView } from "@/components/dashboard/tax-view"
import { LoyaltyView } from "@/components/dashboard/loyalty-view"
import { DeliveryZonesView } from "@/components/dashboard/delivery-zones-view"
// Customer App (live storefront)
import { CustomerAuth } from "@/components/customer/auth/customer-auth"
import { CustomerHome } from "@/components/customer/home/customer-home"
import { CustomerProducts } from "@/components/customer/products/customer-products"
import { CustomerProductDetail } from "@/components/customer/products/customer-product-detail"
import { CustomerCart } from "@/components/customer/cart/customer-cart"
import { CustomerCheckout } from "@/components/customer/checkout/customer-checkout"
import { CustomerOrderTracking } from "@/components/customer/orders/customer-order-tracking"
import { CustomerProfile } from "@/components/customer/profile/customer-profile"
import { CustomerOrders } from "@/components/customer/orders/customer-orders"
import { CustomerAddresses } from "@/components/customer/addresses/customer-addresses"
// Storefront Shell (for business owner storefront preview)
import { StorefrontShell } from "@/components/storefront/storefront-shell"
// Delivery Partner
import { DeliveryLogin } from "@/components/delivery/auth/delivery-login"
import { DeliveryDashboard } from "@/components/delivery/dashboard/delivery-dashboard"
import { DeliveryOrderDetail } from "@/components/delivery/orders/delivery-order-detail"
import { DeliveryEarnings } from "@/components/delivery/earnings/delivery-earnings"
import { DeliveryProfile } from "@/components/delivery/profile/delivery-profile"
// Workflow Engine
import { WorkflowEngineView } from "@/components/workflow/workflow-engine-view"
import { WorkflowConfigView } from "@/components/workflow/workflow-config-view"
import { PlanComparison } from "@/components/workflow/plan-comparison"

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
      case "pos": return <POSView />
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
