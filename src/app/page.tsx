"use client"

import { AdminLayout } from "@/components/admin/layout/admin-layout"
import { BusinessLayout } from "@/components/business/layout/business-layout"
import { CustomerLayout } from "@/components/customer/layout/customer-layout"
import { DeliveryLayout } from "@/components/delivery/layout/delivery-layout"
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
import { DeliveryLogin } from "@/components/delivery/auth/delivery-login"
import { DeliveryDashboard } from "@/components/delivery/dashboard/delivery-dashboard"
import { DeliveryOrderDetail } from "@/components/delivery/orders/delivery-order-detail"
import { DeliveryEarnings } from "@/components/delivery/earnings/delivery-earnings"
import { DeliveryProfile } from "@/components/delivery/profile/delivery-profile"

export default function Home() {
  const { viewMode, activePage, businessPage, customerPage, deliveryPage } = useAdminStore()

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

  const renderCustomerPage = () => {
    switch (customerPage) {
      case "auth":
        return <CustomerAuth />
      case "home":
        return <CustomerHome />
      case "products":
        return <CustomerProducts />
      case "product-detail":
        return <CustomerProductDetail />
      case "cart":
        return <CustomerCart />
      case "checkout":
        return <CustomerCheckout />
      case "order-tracking":
        return <CustomerOrderTracking />
      case "profile":
        return <CustomerProfile />
      case "orders":
        return <CustomerOrders />
      case "addresses":
        return <CustomerAddresses />
      case "support":
        return <CustomerProfile />
      default:
        return <CustomerHome />
    }
  }

  const renderDeliveryPage = () => {
    switch (deliveryPage) {
      case "login":
        return <DeliveryLogin />
      case "dashboard":
        return <DeliveryDashboard />
      case "order-detail":
        return <DeliveryOrderDetail />
      case "earnings":
        return <DeliveryEarnings />
      case "profile":
        return <DeliveryProfile />
      default:
        return <DeliveryDashboard />
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
