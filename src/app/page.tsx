'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar, type ViewType } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { Overview } from '@/components/dashboard/overview';
import { BusinessesView } from '@/components/dashboard/businesses-view';
import { StoresView } from '@/components/dashboard/stores-view';
import { ProductsView } from '@/components/dashboard/products-view';
import { OrdersView } from '@/components/dashboard/orders-view';
import { CustomersView } from '@/components/dashboard/customers-view';
import { DeliveriesView } from '@/components/dashboard/deliveries-view';
import { SubscriptionsView } from '@/components/dashboard/subscriptions-view';
import { PosView } from '@/components/dashboard/pos-view';
import { InvoicesView } from '@/components/dashboard/invoices-view';
import { ArchitectureView } from '@/components/dashboard/architecture-view';
import { SettingsView } from '@/components/dashboard/settings-view';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const viewComponents: Record<ViewType, React.ComponentType> = {
  dashboard: Overview,
  businesses: BusinessesView,
  stores: StoresView,
  products: ProductsView,
  orders: OrdersView,
  customers: CustomersView,
  deliveries: DeliveriesView,
  subscriptions: SubscriptionsView,
  pos: PosView,
  invoices: InvoicesView,
  settings: SettingsView,
  architecture: ArchitectureView,
};

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  businesses: 'Businesses',
  stores: 'Stores',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
  deliveries: 'Deliveries',
  subscriptions: 'Subscriptions',
  pos: 'POS Terminal',
  invoices: 'Invoices',
  settings: 'Settings',
  architecture: 'Architecture',
};

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                  <ViewComponent />
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
                  © 2024 Quantix Technology. All rights reserved.
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span>Version 1.0.0</span>
                <span>•</span>
                <span>Made with ❤️ in India</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
