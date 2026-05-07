"use client"

import { AdminLayout } from "@/components/admin/layout/admin-layout"
import { BusinessLayout } from "@/components/business/layout/business-layout"
import { useAdminStore } from "@/stores/admin-store"
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
import { BusinessDashboard } from "@/components/business/dashboard/business-dashboard"
import { OrdersView } from "@/components/business/orders/orders-view"
import { ProductsView } from "@/components/business/products/products-view"
import { POSView } from "@/components/business/pos/pos-view"
import { CustomersView } from "@/components/business/customers/customers-view"
import { ReportsView } from "@/components/business/reports/reports-view"
import { StoreSettingsView } from "@/components/business/settings/store-settings"

export default function Home() {
  const { viewMode, activePage, businessPage } = useAdminStore()

  const renderSuperAdminPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardView />
      case "leads":
        return <LeadsView />
      case "businesses":
        return <BusinessesView />
      case "subscriptions":
        return <SubscriptionsView />
      case "onboarding":
        return <OnboardingView />
      case "domains":
        return <DomainsView />
      case "demo-tenants":
        return <DemoTenantsView />
      case "sales":
        return <SalesView />
      case "notifications":
        return <NotificationsView />
      case "settings":
        return <SettingsView />
      default:
        return <DashboardView />
    }
  }

  const renderBusinessPage = () => {
    switch (businessPage) {
      case "dashboard":
        return <BusinessDashboard />
      case "orders":
        return <OrdersView />
      case "products":
        return <ProductsView />
      case "pos":
        return <POSView />
      case "customers":
        return <CustomersView />
      case "reports":
        return <ReportsView />
      case "settings":
        return <StoreSettingsView />
      default:
        return <BusinessDashboard />
    }
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
