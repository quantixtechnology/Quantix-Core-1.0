'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Building2, TrendingUp, CreditCard, Globe, Layers,
  Store, Package, ClipboardList, Users, Truck, Repeat, Monitor, FileText, Settings,
  Database, ChevronDown, ChevronRight, Zap, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewType =
  | 'platform_dashboard'
  | 'businesses'
  | 'sales'
  | 'subscriptions'
  | 'domains'
  | 'plans'
  | 'business_dashboard'
  | 'stores'
  | 'products'
  | 'orders'
  | 'customers'
  | 'deliveries'
  | 'sub_plans'
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

const platformNav = [
  { id: 'platform_dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'businesses' as ViewType, label: 'Businesses', icon: Building2 },
  { id: 'sales' as ViewType, label: 'Sales & Leads', icon: TrendingUp },
  { id: 'subscriptions' as ViewType, label: 'Subscriptions', icon: CreditCard },
  { id: 'domains' as ViewType, label: 'Domains & Deploys', icon: Globe },
  { id: 'plans' as ViewType, label: 'Platform Plans', icon: Layers },
];

const businessNav = [
  { id: 'business_dashboard' as ViewType, label: 'Business Hub', icon: Zap },
  { id: 'stores' as ViewType, label: 'Stores', icon: Store },
  { id: 'products' as ViewType, label: 'Products', icon: Package },
  { id: 'orders' as ViewType, label: 'Orders', icon: ClipboardList },
  { id: 'customers' as ViewType, label: 'Customers', icon: Users },
  { id: 'deliveries' as ViewType, label: 'Deliveries', icon: Truck },
  { id: 'sub_plans' as ViewType, label: 'Subscriptions', icon: Repeat },
  { id: 'pos' as ViewType, label: 'POS Terminal', icon: Monitor },
  { id: 'invoices' as ViewType, label: 'Invoices', icon: FileText },
  { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
];

const systemNav = [
  { id: 'architecture' as ViewType, label: 'Architecture', icon: Database },
];

export function Sidebar({ activeView, onViewChange, collapsed, onToggle }: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    platform: true,
    business: false,
    system: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className={cn(
      'h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300',
      collapsed ? 'w-[68px]' : 'w-[250px]'
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center border-b border-slate-200 px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs">QX</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">Quantix</h1>
              <p className="text-[9px] text-emerald-600 font-medium truncate">Run Your Business Smarter</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="ml-auto p-1 rounded hover:bg-slate-100 flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
        </button>
      </div>

      {/* Mode Badge */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
            <Shield className="h-3 w-3" />
            SUPER ADMIN MODE
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {/* Platform Control */}
        <SidebarSection
          title="Platform Control"
          collapsed={collapsed}
          expanded={expandedSections.platform}
          onToggle={() => toggleSection('platform')}
          items={platformNav}
          activeView={activeView}
          onViewChange={onViewChange}
        />

        {/* Client Operations */}
        <SidebarSection
          title="Client Operations"
          collapsed={collapsed}
          expanded={expandedSections.business}
          onToggle={() => toggleSection('business')}
          items={businessNav}
          activeView={activeView}
          onViewChange={onViewChange}
        />

        {/* System */}
        <SidebarSection
          title="System"
          collapsed={collapsed}
          expanded={expandedSections.system}
          onToggle={() => toggleSection('system')}
          items={systemNav}
          activeView={activeView}
          onViewChange={onViewChange}
        />
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200">
          <div className="text-[10px] text-slate-400 text-center">
            quantixtechnology.in
          </div>
        </div>
      )}
    </aside>
  );
}

function SidebarSection({
  title, collapsed, expanded, onToggle, items, activeView, onViewChange
}: {
  title: string; collapsed: boolean; expanded: boolean; onToggle: () => void;
  items: { id: ViewType; label: string; icon: React.ElementType }[];
  activeView: ViewType; onViewChange: (v: ViewType) => void;
}) {
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full flex items-center justify-center p-2 rounded-md transition-colors',
              activeView === item.id
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600"
      >
        {title}
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="space-y-0.5 mt-0.5">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                activeView === item.id
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
