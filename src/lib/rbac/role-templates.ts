// ============================================================================
// Enterprise RBAC — Role Templates
// Default permission sets for every platform and business role.
// These are the factory defaults; DB overrides (RolePermission table) win.
// ============================================================================

import { allPermissionKeys, PERMISSION_MODULES, permKey, type ActionId } from './permission-definitions';

function keys(...pairs: [string, ActionId[]][]): string[] {
  return pairs.flatMap(([mod, actions]) => actions.map(a => permKey(mod, a)));
}

function allForModule(moduleId: string): string[] {
  const mod = PERMISSION_MODULES.find(m => m.id === moduleId);
  if (!mod) return [];
  const k: string[] = mod.actions.map(a => permKey(mod.id, a));
  for (const sub of mod.submodules) {
    k.push(...sub.actions.map(a => permKey(sub.id, a)));
  }
  return k;
}

// ─── PLATFORM ROLES ──────────────────────────────────────────────────────────

const QUANTIX_SUPER_ADMIN_PERMISSIONS = allPermissionKeys();

const PLATFORM_ADMIN_PERMISSIONS: string[] = [
  ...allForModule('dashboard'),
  ...allForModule('businesses'),
  ...allForModule('leads'),
  ...allForModule('subscriptions'),
  ...allForModule('payment_plugins'),
  ...allForModule('domains'),
  ...allForModule('sales_team'),
  ...allForModule('users'),
  ...allForModule('notifications'),
  ...allForModule('platform_analytics'),
  ...allForModule('revenue'),
  ...allForModule('support'),
  ...allForModule('audit_logs'),
  ...allForModule('settings'),
  ...allForModule('mobile_apps'),
  ...allForModule('ops_dashboard'),
  // No impersonate, no delete users, limited deployment
  ...keys(
    ['deployment',       ['view', 'configure']],
    ['build_automation', ['view']],
    ['releases',         ['view', 'approve']],
    ['backup',           ['view']],
    ['security',         ['view']],
  ),
].filter(k =>
  !k.includes(':impersonate') &&
  !k.includes('users.platform:delete') &&
  !k.includes('users.business:delete') &&
  !k.includes('businesses:delete') &&
  !k.includes('leads:delete') &&
  !k.includes('leads.pipeline:delete') &&
  !k.includes('leads.follow_ups:delete') &&
  !k.includes('sales_team.reps:delete')
);

const QUANTIX_SALES_TEAM_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                 ['view']],
    ['businesses',                ['view', 'export']],
    ['businesses.onboarding',     ['view', 'create', 'edit']],
    ['businesses.analytics',      ['view']],
    // Sales team can view/create/edit/assign leads — NO delete
    ['leads',                     ['view', 'create', 'edit', 'assign', 'export']],
    ['leads.pipeline',            ['view', 'create', 'edit', 'assign', 'export']],
    ['leads.follow_ups',          ['view', 'create', 'edit']],
    ['leads.reports',             ['view', 'export']],
    ['sales_team',                ['view', 'export']],
    ['sales_team.reps',           ['view']],
    ['sales_team.commissions',    ['view']],
    ['sales_team.targets',        ['view']],
    ['subscriptions',             ['view']],
    ['platform_analytics',        ['view']],
    ['platform_analytics.revenue',['view']],
    ['notifications',             ['view', 'send']],
    ['notifications.push',        ['view', 'send']],
    ['notifications.email',       ['view', 'send']],
  ),
];

const SUPPORT_TEAM_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                 ['view']],
    ['businesses',                ['view', 'export']],
    ['businesses.stores',         ['view']],
    ['leads',                     ['view']],
    ['subscriptions',             ['view']],
    ['support',                   ['view', 'create', 'edit', 'assign', 'export']],
    ['audit_logs',                ['view']],
    ['notifications',             ['view', 'create', 'send']],
    ['notifications.push',        ['view', 'create', 'send']],
    ['notifications.email',       ['view', 'create', 'send']],
    ['biz_orders',                ['view']],
    ['biz_orders.online',         ['view']],
    ['biz_customers',             ['view', 'edit', 'export']],
    ['biz_customers.profiles',    ['view', 'edit']],
    ['biz_customers.addresses',   ['view', 'edit']],
  ),
];

const FINANCE_TEAM_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                        ['view']],
    ['subscriptions',                    ['view', 'create', 'edit', 'export', 'approve', 'refund', 'billing']],
    ['subscriptions.plans',              ['view', 'create', 'edit']],
    ['subscriptions.invoices',           ['view', 'export', 'refund']],
    ['subscriptions.payments',           ['view', 'approve', 'refund', 'billing']],
    ['revenue',                          ['view', 'export', 'approve', 'billing']],
    ['platform_analytics',               ['view', 'export']],
    ['platform_analytics.revenue',       ['view', 'export']],
    ['platform_analytics.customers',     ['view', 'export']],
    ['audit_logs',                       ['view', 'export']],
    ['businesses',                       ['view']],
    ['businesses.subscriptions',         ['view', 'billing']],
    ['payment_plugins',                  ['view']],
  ),
];

const DEPLOYMENT_TEAM_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',            ['view']],
    ['mobile_apps',          ['view', 'create', 'edit', 'configure']],
    ['ops_dashboard',        ['view', 'export']],
    ['deployment',           ['view', 'create', 'edit', 'configure', 'approve']],
    ['deployment.pipeline',  ['view', 'create', 'approve']],
    ['deployment.environments', ['view', 'edit', 'configure']],
    ['build_automation',     ['view', 'create', 'edit', 'configure']],
    ['releases',             ['view', 'create', 'edit', 'approve']],
    ['play_store',           ['view', 'create', 'edit', 'configure']],
    ['backup',               ['view', 'create', 'configure', 'export']],
    ['security',             ['view']],
    ['audit_logs',           ['view']],
    ['settings.integrations',['view', 'configure']],
  ),
];

// ─── BUSINESS ROLES ──────────────────────────────────────────────────────────

const CLIENT_OWNER_PERMISSIONS: string[] = [
  ...allForModule('biz_products'),
  ...allForModule('biz_orders'),
  ...allForModule('biz_inventory'),
  ...allForModule('biz_customers'),
  ...allForModule('biz_pos'),
  ...allForModule('biz_delivery'),
  ...allForModule('biz_reports'),
  ...allForModule('biz_settings'),
];

const STORE_MANAGER_PERMISSIONS: string[] = [
  ...keys(
    ['biz_products',             ['view', 'create', 'edit', 'export', 'import']],
    ['biz_products.catalog',     ['view', 'create', 'edit']],
    ['biz_products.variants',    ['view', 'create', 'edit']],
    ['biz_products.inventory',   ['view', 'edit']],
    ['biz_orders',               ['view', 'create', 'edit', 'export', 'cancel', 'assign']],
    ['biz_orders.online',        ['view', 'create', 'edit', 'cancel']],
    ['biz_orders.pos',           ['view', 'create', 'cancel']],
    ['biz_orders.delivery',      ['view', 'assign']],
    ['biz_inventory',            ['view', 'edit', 'export']],
    ['biz_inventory.stock',      ['view', 'edit']],
    ['biz_inventory.adjustments',['view', 'create']],
    ['biz_customers',            ['view', 'edit', 'export']],
    ['biz_customers.profiles',   ['view', 'edit']],
    ['biz_customers.loyalty',    ['view', 'edit']],
    ['biz_pos',                  ['view', 'create', 'billing']],
    ['biz_delivery',             ['view', 'create', 'edit', 'assign']],
    ['biz_delivery.partners',    ['view', 'create', 'edit']],
    ['biz_delivery.zones',       ['view', 'edit']],
    ['biz_reports',              ['view', 'export']],
    ['biz_reports.sales',        ['view', 'export']],
    ['biz_reports.inventory',    ['view', 'export']],
    ['biz_settings',             ['view', 'edit']],
    ['biz_settings.general',     ['view', 'edit']],
    ['biz_settings.stores',      ['view']],
    ['biz_settings.staff',       ['view']],
  ),
];

const BILLING_STAFF_PERMISSIONS: string[] = [
  ...keys(
    ['biz_pos',               ['view', 'create', 'billing', 'refund']],
    ['biz_orders',            ['view', 'create', 'export']],
    ['biz_orders.online',     ['view', 'create']],
    ['biz_orders.pos',        ['view', 'create', 'refund']],
    ['biz_customers',         ['view', 'export']],
    ['biz_customers.profiles',['view']],
    ['biz_reports',           ['view', 'export']],
    ['biz_reports.sales',     ['view', 'export']],
    ['biz_reports.finance',   ['view', 'export']],
  ),
];

const INVENTORY_STAFF_PERMISSIONS: string[] = [
  ...keys(
    ['biz_products',              ['view', 'edit', 'import', 'export']],
    ['biz_products.catalog',      ['view', 'edit']],
    ['biz_products.variants',     ['view', 'edit']],
    ['biz_products.inventory',    ['view', 'edit']],
    ['biz_inventory',             ['view', 'edit', 'export']],
    ['biz_inventory.stock',       ['view', 'edit']],
    ['biz_inventory.adjustments', ['view', 'create', 'approve']],
    ['biz_inventory.transfers',   ['view', 'create', 'approve']],
    ['biz_reports',               ['view', 'export']],
    ['biz_reports.inventory',     ['view', 'export']],
  ),
];

const DELIVERY_STAFF_PERMISSIONS: string[] = [
  ...keys(
    ['biz_orders',             ['view']],
    ['biz_orders.delivery',    ['view', 'assign']],
    ['biz_delivery',           ['view', 'assign']],
    ['biz_delivery.partners',  ['view']],
    ['biz_delivery.zones',     ['view']],
    ['biz_customers',          ['view']],
    ['biz_customers.addresses',['view']],
  ),
];

const SUPPORT_STAFF_PERMISSIONS: string[] = [
  ...keys(
    ['biz_orders',             ['view', 'edit']],
    ['biz_orders.online',      ['view', 'edit']],
    ['biz_customers',          ['view', 'edit', 'export']],
    ['biz_customers.profiles', ['view', 'edit']],
    ['biz_customers.addresses',['view', 'edit']],
    ['biz_customers.loyalty',  ['view']],
    ['biz_products',           ['view']],
    ['biz_products.catalog',   ['view']],
  ),
];

// ─── REGISTRY ────────────────────────────────────────────────────────────────

export type RoleId =
  | 'QUANTIX_SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'QUANTIX_SALES_TEAM'
  | 'SUPPORT_TEAM' | 'FINANCE_TEAM' | 'DEPLOYMENT_TEAM'
  | 'CLIENT_OWNER' | 'STORE_MANAGER' | 'BILLING_STAFF'
  | 'INVENTORY_STAFF' | 'DELIVERY_STAFF' | 'SUPPORT_STAFF';

export interface RoleMeta {
  id: RoleId;
  label: string;
  group: 'platform' | 'business';
  color: string;
  description: string;
}

export const ROLE_META: RoleMeta[] = [
  { id: 'QUANTIX_SUPER_ADMIN',  label: 'Super Admin',      group: 'platform', color: '#dc2626', description: 'Full platform access — no restrictions' },
  { id: 'PLATFORM_ADMIN',       label: 'Platform Admin',   group: 'platform', color: '#7c3aed', description: 'Near-full admin, cannot impersonate or delete platform staff' },
  { id: 'QUANTIX_SALES_TEAM',   label: 'Sales Team',       group: 'platform', color: '#2563eb', description: 'Leads, CRM, and business prospect management' },
  { id: 'SUPPORT_TEAM',         label: 'Support Team',     group: 'platform', color: '#059669', description: 'Customer support and ticket management' },
  { id: 'FINANCE_TEAM',         label: 'Finance Team',     group: 'platform', color: '#d97706', description: 'Billing, invoices, revenue, payouts' },
  { id: 'DEPLOYMENT_TEAM',      label: 'Deployment Team',  group: 'platform', color: '#0891b2', description: 'CI/CD, releases, mobile apps and monitoring' },
  { id: 'CLIENT_OWNER',         label: 'Business Owner',   group: 'business', color: '#16a34a', description: 'Full access to all business modules' },
  { id: 'STORE_MANAGER',        label: 'Store Manager',    group: 'business', color: '#ca8a04', description: 'Manage products, orders, inventory, staff' },
  { id: 'BILLING_STAFF',        label: 'Billing Staff',    group: 'business', color: '#9333ea', description: 'POS billing, order processing and finance reports' },
  { id: 'INVENTORY_STAFF',      label: 'Inventory Staff',  group: 'business', color: '#0284c7', description: 'Stock management and product catalog updates' },
  { id: 'DELIVERY_STAFF',       label: 'Delivery Staff',   group: 'business', color: '#7c3aed', description: 'Delivery order visibility and route management' },
  { id: 'SUPPORT_STAFF',        label: 'Support Staff',    group: 'business', color: '#db2777', description: 'Customer queries, order edits, product lookup' },
];

export const ROLE_TEMPLATES: Record<RoleId, string[]> = {
  QUANTIX_SUPER_ADMIN:  QUANTIX_SUPER_ADMIN_PERMISSIONS,
  PLATFORM_ADMIN:       PLATFORM_ADMIN_PERMISSIONS,
  QUANTIX_SALES_TEAM:   QUANTIX_SALES_TEAM_PERMISSIONS,
  SUPPORT_TEAM:         SUPPORT_TEAM_PERMISSIONS,
  FINANCE_TEAM:         FINANCE_TEAM_PERMISSIONS,
  DEPLOYMENT_TEAM:      DEPLOYMENT_TEAM_PERMISSIONS,
  CLIENT_OWNER:         CLIENT_OWNER_PERMISSIONS,
  STORE_MANAGER:        STORE_MANAGER_PERMISSIONS,
  BILLING_STAFF:        BILLING_STAFF_PERMISSIONS,
  INVENTORY_STAFF:      INVENTORY_STAFF_PERMISSIONS,
  DELIVERY_STAFF:       DELIVERY_STAFF_PERMISSIONS,
  SUPPORT_STAFF:        SUPPORT_STAFF_PERMISSIONS,
};

export function getTemplatePermissions(roleId: string): string[] {
  return ROLE_TEMPLATES[roleId as RoleId] ?? [];
}
