'use client';

import { useState, lazy, Suspense } from 'react';
import { Sidebar, type ViewType } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const PlatformOverview = lazy(() => import('@/components/dashboard/platform-overview').then(m => ({ default: m.PlatformOverview })));
const BusinessesView = lazy(() => import('@/components/dashboard/businesses-view').then(m => ({ default: m.BusinessesView })));
const SalesView = lazy(() => import('@/components/dashboard/sales-view').then(m => ({ default: m.SalesView })));
const SubscriptionsView = lazy(() => import('@/components/dashboard/subscriptions-view').then(m => ({ default: m.SubscriptionsView })));
const DomainsView = lazy(() => import('@/components/dashboard/domains-view').then(m => ({ default: m.DomainsView })));
const PlansView = lazy(() => import('@/components/dashboard/plans-view').then(m => ({ default: m.PlansView })));
const BusinessDashboard = lazy(() => import('@/components/dashboard/business-dashboard').then(m => ({ default: m.BusinessDashboard })));
const StoresView = lazy(() => import('@/components/dashboard/stores-view').then(m => ({ default: m.StoresView })));
const ProductsView = lazy(() => import('@/components/dashboard/products-view').then(m => ({ default: m.ProductsView })));
const OrdersView = lazy(() => import('@/components/dashboard/orders-view').then(m => ({ default: m.OrdersView })));
const CustomersView = lazy(() => import('@/components/dashboard/customers-view').then(m => ({ default: m.CustomersView })));
const DeliveriesView = lazy(() => import('@/components/dashboard/deliveries-view').then(m => ({ default: m.DeliveriesView })));
const SubscriptionPlansView = lazy(() => import('@/components/dashboard/subscription-plans-view').then(m => ({ default: m.SubscriptionPlansView })));
const PosView = lazy(() => import('@/components/dashboard/pos-view').then(m => ({ default: m.PosView })));
const InvoicesView = lazy(() => import('@/components/dashboard/invoices-view').then(m => ({ default: m.InvoicesView })));
const SettingsView = lazy(() => import('@/components/dashboard/settings-view').then(m => ({ default: m.SettingsView })));
const ArchitectureView = lazy(() => import('@/components/dashboard/architecture-view').then(m => ({ default: m.ArchitectureView })));

const viewComponents: Record<ViewType, React.LazyExoticComponent<React.ComponentType<{ selectedBusiness?: string }>>> = {
  platform_dashboard: PlatformOverview,
  businesses: BusinessesView,
  sales: SalesView,
  subscriptions: SubscriptionsView,
  domains: DomainsView,
  plans: PlansView,
  business_dashboard: BusinessDashboard,
  stores: StoresView,
  products: ProductsView,
  orders: OrdersView,
  customers: CustomersView,
  deliveries: DeliveriesView,
  sub_plans: SubscriptionPlansView,
  pos: PosView,
  invoices: InvoicesView,
  settings: SettingsView,
  architecture: ArchitectureView,
};

const viewTitles: Record<ViewType, string> = {
  platform_dashboard: 'Platform Dashboard',
  businesses: 'Businesses',
  sales: 'Sales & Leads',
  subscriptions: 'Client Subscriptions',
  domains: 'Domains & Deployments',
  plans: 'Platform Plans',
  business_dashboard: 'Business Dashboard',
  stores: 'Stores',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
  deliveries: 'Deliveries',
  sub_plans: 'Subscription Packages',
  pos: 'POS Terminal',
  invoices: 'Invoices',
  settings: 'Settings',
  architecture: 'Architecture Documentation',
};

function ViewLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('platform_dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState('biz_1');

  const handleViewChange = (view: ViewType) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const ViewComponent = viewComponents[activeView];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex flex-1 min-h-0">
        <div className="hidden lg:flex">
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[260px]">
            <Sidebar
              activeView={activeView}
              onViewChange={handleViewChange}
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            currentView={viewTitles[activeView]}
            selectedBusiness={selectedBusiness}
            onBusinessChange={setSelectedBusiness}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              <Suspense fallback={<ViewLoader />}>
                <ViewComponent selectedBusiness={selectedBusiness} />
              </Suspense>
            </div>
          </main>

          <footer className="bg-white border-t border-slate-200 px-4 lg:px-6 py-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center">
                  <span className="text-white font-bold text-[8px]">QX</span>
                </div>
                <span className="text-xs text-slate-500">
                  © 2025 Quantix Technology · Run Your Business Smarter
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span>quantixtechnology.in</span>
                <span>·</span>
                <span>v2.0.0</span>
                <span>·</span>
                <span>Managed White-Label SaaS</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
