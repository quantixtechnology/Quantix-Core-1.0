'use client';

import {
  LayoutDashboard,
  Building2,
  Store,
  Package,
  ShoppingCart,
  Users,
  Truck,
  CreditCard,
  Monitor,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ViewType =
  | 'dashboard'
  | 'businesses'
  | 'stores'
  | 'products'
  | 'orders'
  | 'customers'
  | 'deliveries'
  | 'subscriptions'
  | 'pos'
  | 'invoices'
  | 'settings'
  | 'architecture';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const navItems: { id: ViewType; label: string; icon: React.ElementType; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'businesses', label: 'Businesses', icon: Building2, group: 'Management' },
  { id: 'stores', label: 'Stores', icon: Store, group: 'Management' },
  { id: 'products', label: 'Products', icon: Package, group: 'Management' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, group: 'Operations' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'Operations' },
  { id: 'deliveries', label: 'Deliveries', icon: Truck, group: 'Operations' },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, group: 'Finance' },
  { id: 'pos', label: 'POS', icon: Monitor, group: 'Finance' },
  { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Finance' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'System' },
  { id: 'architecture', label: 'Architecture', icon: Layers, group: 'System' },
];

const groups = ['Overview', 'Management', 'Operations', 'Finance', 'System'];

export function Sidebar({ activeView, onViewChange, collapsed, onToggle }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out relative',
          collapsed ? 'w-[68px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-slate-200">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">QX</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 truncate">Quantix</span>
                <span className="text-[10px] text-slate-500 truncate">Technology Platform</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {groups.map((group) => {
            const groupItems = navItems.filter((item) => item.group === group);
            return (
              <div key={group}>
                {!collapsed && (
                  <div className="px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {group}
                    </span>
                  </div>
                )}
                {collapsed && <div className="my-1"><Separator className="mx-2 bg-slate-100" /></div>}
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  const button = (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <Icon
                        className={cn(
                          'flex-shrink-0 h-[18px] w-[18px]',
                          isActive ? 'text-emerald-600' : 'text-slate-400'
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return button;
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-slate-200 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
