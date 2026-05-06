'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, type ViewType } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { PlatformOverview } from '@/components/dashboard/platform-overview';
import { BusinessesView } from '@/components/dashboard/businesses-view';
import { SalesView } from '@/components/dashboard/sales-view';
import { SubscriptionsView } from '@/components/dashboard/subscriptions-view';
import { DomainsView } from '@/components/dashboard/domains-view';
import { PlansView } from '@/components/dashboard/plans-view';
import { BusinessDashboard } from '@/components/dashboard/business-dashboard';
import { StoresView } from '@/components/dashboard/stores-view';
import { ProductsView } from '@/components/dashboard/products-view';
import { OrdersView } from '@/components/dashboard/orders-view';
import { CustomersView } from '@/components/dashboard/customers-view';
import { DeliveriesView } from '@/components/dashboard/deliveries-view';
import { SubscriptionPlansView } from '@/components/dashboard/subscription-plans-view';
import { PosView } from '@/components/dashboard/pos-view';
import { InvoicesView } from '@/components/dashboard/invoices-view';
import { SettingsView } from '@/components/dashboard/settings-view';
import { ArchitectureView } from '@/components/dashboard/architecture-view';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const viewComponents: Record<ViewType, React.ComponentType<{ selectedBusiness?: string }>> = {
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
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex">
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            currentView={viewTitles[activeView]}
            selectedBusiness={selectedBusiness}
            onBusinessChange={setSelectedBusiness}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ViewComponent selectedBusiness={selectedBusiness} />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Footer */}
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
