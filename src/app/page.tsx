"use client"

import { AdminLayout } from "@/components/admin/layout/admin-layout"
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

export default function Home() {
  const { activePage } = useAdminStore()

  const renderPage = () => {
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

  return (
    <AdminLayout>
      {renderPage()}
    </AdminLayout>
  )
}
