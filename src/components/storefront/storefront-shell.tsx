'use client';

import { useAdminStore, DEMO_BUSINESSES } from '@/stores/admin-store';
import { getDemoBusinessName } from '@/lib/demo-data';
import { CustomerLayout } from '@/components/customer/layout/customer-layout';
import { CustomerHome } from '@/components/customer/home/customer-home';
import { CustomerProducts } from '@/components/customer/products/customer-products';
import { CustomerProductDetail } from '@/components/customer/products/customer-product-detail';
import { CustomerCart } from '@/components/customer/cart/customer-cart';
import { CustomerCheckout } from '@/components/customer/checkout/customer-checkout';
import { CustomerOrders } from '@/components/customer/orders/customer-orders';
import { CustomerOrderTracking } from '@/components/customer/orders/customer-order-tracking';
import { CustomerProfile } from '@/components/customer/profile/customer-profile';
import { CustomerAuth } from '@/components/customer/auth/customer-auth';
import { CustomerAddresses } from '@/components/customer/addresses/customer-addresses';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

function CustomerApp() {
  const { customerPage } = useAdminStore();

  const renderPage = () => {
    switch (customerPage) {
      case 'auth':
        return <CustomerAuth />;
      case 'home':
        return <CustomerHome />;
      case 'products':
        return <CustomerProducts />;
      case 'product-detail':
        return <CustomerProductDetail />;
      case 'cart':
        return <CustomerCart />;
      case 'checkout':
        return <CustomerCheckout />;
      case 'orders':
        return <CustomerOrders />;
      case 'order-tracking':
        return <CustomerOrderTracking />;
      case 'profile':
        return <CustomerProfile />;
      case 'addresses':
        return <CustomerAddresses />;
      default:
        return <CustomerHome />;
    }
  };

  return (
    <CustomerLayout>
      {renderPage()}
    </CustomerLayout>
  );
}

export function StorefrontShell() {
  const { demoBusinessId } = useAdminStore()
  const businessName = getDemoBusinessName(demoBusinessId)
  const demoBusiness = DEMO_BUSINESSES.find((b) => b.id === demoBusinessId) || DEMO_BUSINESSES[1]

  return (
    <div className="animate-in fade-in duration-300">
      {/* Omni-Channel Architecture Badge */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-700">LIVE STOREFRONT</span>
        </div>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] text-slate-400 font-medium">{businessName}</span>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] text-slate-400">{demoBusiness.planTier === "PRO" ? "⭐ Pro" : "Standard"} Plan</span>
      </div>

      {/* Storefront Container */}
      <QueryClientProvider client={queryClient}>
        <div className="flex justify-center">
          <div className="w-full max-w-md border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white">
            <CustomerApp />
          </div>
        </div>
      </QueryClientProvider>

      {/* Architecture Info */}
      <div className="mt-4 max-w-md mx-auto">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold text-slate-700">UNIFIED OMNI-CHANNEL COMMERCE</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: 'Website', active: true, icon: '🌐' },
              { label: 'Mobile', active: true, icon: '📱' },
              { label: 'POS', active: true, icon: '💳' },
              { label: 'Admin', active: true, icon: '⚙️' },
              { label: 'Delivery', active: true, icon: '🚚' },
            ].map(ch => (
              <div key={ch.label} className={`text-center p-1.5 rounded-md ${ch.active ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-100'}`}>
                <span className="text-sm">{ch.icon}</span>
                <p className="text-[8px] font-medium text-slate-600 mt-0.5">{ch.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[9px]">
            <span className="bg-white px-1.5 py-0.5 rounded border text-slate-500">Shared Products</span>
            <span className="text-emerald-400">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border text-slate-500">Shared Inventory</span>
            <span className="text-emerald-400">→</span>
            <span className="bg-white px-1.5 py-0.5 rounded border text-slate-500">Shared Orders</span>
            <span className="text-emerald-400">→</span>
            <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 text-emerald-600 font-medium">Real-time Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
