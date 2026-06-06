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

// ─── NEW NAMED PLATFORM ROLES ─────────────────────────────────────────────────

const SALES_MANAGER_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                  ['view']],
    ['workflow',                   ['view']],
    // Full lead lifecycle including delete
    ['leads',                      ['view', 'create', 'edit', 'delete', 'assign', 'export']],
    ['leads.pipeline',             ['view', 'create', 'edit', 'delete', 'assign', 'export']],
    ['leads.follow_ups',           ['view', 'create', 'edit', 'delete']],
    ['leads.reports',              ['view', 'export']],
    // Business: create + edit (no delete)
    ['businesses',                 ['view', 'create', 'edit', 'export']],
    ['businesses.onboarding',      ['view', 'create', 'edit', 'approve']],
    ['businesses.analytics',       ['view', 'export']],
    ['subscriptions',              ['view']],
    ['subscriptions.plans',        ['view']],
    // Sales team management
    ['sales_team',                 ['view', 'create', 'edit', 'delete', 'export']],
    ['sales_team.reps',            ['view', 'create', 'edit', 'delete']],
    ['sales_team.commissions',     ['view', 'edit', 'approve', 'export']],
    ['sales_team.targets',         ['view', 'create', 'edit']],
    ['platform_analytics',         ['view', 'export']],
    ['platform_analytics.revenue', ['view', 'export']],
    ['notifications',              ['view', 'send']],
    ['notifications.email',        ['view', 'send']],
    ['proposals',                  ['view', 'create', 'delete', 'export']],
    ['payment_config',             ['view']],
    ['commission',                 ['view', 'create', 'edit', 'export']],
    ['revenue_ops',                ['view']],
    ['revenue_ops.signup_ownership', ['view', 'assign']],
    ['revenue_ops.renewal_ownership',['view', 'assign']],
  ),
];

const BD_EXECUTIVE_PERMISSIONS: string[] = [
  ...keys(
    ['leads',                   ['view', 'create', 'edit', 'assign', 'export']],
    ['leads.pipeline',          ['view', 'create', 'edit', 'assign', 'export']],
    ['leads.follow_ups',        ['view', 'create', 'edit']],
    ['businesses',              ['view']],
    ['businesses.onboarding',   ['view', 'create', 'edit']],
    ['sales_team',              ['view']],
    ['sales_team.reps',         ['view']],
    ['sales_team.commissions',  ['view']],
    ['subscriptions',           ['view']],
    ['notifications',           ['view']],
    ['proposals',               ['view', 'create', 'export']],
    ['commission',              ['view']],
  ),
];

const HR_ADMIN_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                          ['view']],
    // Full HRMS access
    ['hrms',                               ['view', 'create', 'edit', 'delete', 'export', 'approve', 'configure']],
    ['hrms.employees',                     ['view', 'create', 'edit', 'delete', 'export']],
    ['hrms.offer_letters',                 ['view', 'create', 'edit', 'delete', 'print', 'approve']],
    ['hrms.commission_slips',              ['view', 'create', 'approve', 'export', 'print']],
    ['hrms.payslips',                      ['view', 'create', 'approve', 'export', 'print']],
    ['hrms.templates',                     ['view', 'create', 'edit', 'delete']],
    ['hrms.settings',                      ['view', 'edit', 'configure']],
    ['revenue_ops',                        ['view']],
    ['revenue_ops.signup_ownership',       ['view']],
    ['revenue_ops.renewal_ownership',      ['view']],
    ['revenue_ops.commission_processing',  ['view', 'export']],
    // User visibility (no management)
    ['users',                              ['view']],
    ['users.platform',                     ['view']],
    ['notifications',                      ['view', 'send']],
    ['notifications.email',                ['view', 'send']],
  ),
];

const FINANCE_MANAGER_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                          ['view']],
    ['subscriptions',                      ['view', 'create', 'edit', 'delete', 'export', 'approve', 'refund', 'billing']],
    ['subscriptions.plans',                ['view', 'create', 'edit', 'delete']],
    ['subscriptions.invoices',             ['view', 'export', 'refund']],
    ['subscriptions.payments',             ['view', 'approve', 'refund', 'billing']],
    ['revenue',                            ['view', 'export', 'approve', 'billing']],
    ['platform_analytics',                 ['view', 'export']],
    ['platform_analytics.revenue',         ['view', 'export']],
    ['platform_analytics.customers',       ['view', 'export']],
    ['audit_logs',                         ['view', 'export']],
    ['businesses',                         ['view']],
    ['businesses.subscriptions',           ['view', 'billing']],
    ['payment_plugins',                    ['view']],
    ['payment_config',                     ['view', 'edit']],
    // Revenue ops — can approve and release commission
    ['revenue_ops',                        ['view', 'approve', 'export']],
    ['revenue_ops.signup_ownership',       ['view', 'edit', 'assign']],
    ['revenue_ops.renewal_ownership',      ['view', 'edit', 'assign']],
    ['revenue_ops.addon_ownership',        ['view', 'edit', 'assign']],
    ['revenue_ops.commission_processing',  ['view', 'approve', 'export', 'process', 'release']],
    ['commission',                         ['view', 'create', 'edit', 'export']],
    ['notifications',                      ['view']],
  ),
];

const OPERATIONS_MANAGER_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',               ['view']],
    ['workflow',                ['view']],
    // Business provisioning & operations
    ['businesses',              ['view', 'create', 'edit']],
    ['businesses.onboarding',   ['view', 'create', 'edit', 'approve']],
    ['businesses.stores',       ['view', 'create', 'edit']],
    ['businesses.modules',      ['view', 'configure']],
    // Subscriptions view
    ['subscriptions',           ['view']],
    ['subscriptions.plans',     ['view']],
    // Deployment monitoring
    ['mobile_apps',             ['view', 'create', 'edit']],
    ['ops_dashboard',           ['view', 'export']],
    ['deployment',              ['view', 'approve']],
    ['deployment.pipeline',     ['view', 'approve']],
    ['releases',                ['view', 'approve']],
    ['backup',                  ['view', 'export']],
    // Domains
    ['domains',                 ['view', 'create', 'edit']],
    // Analytics
    ['platform_analytics',      ['view', 'export']],
    // Users view
    ['users',                   ['view']],
    ['users.business',          ['view', 'suspend']],
    // Notifications
    ['notifications',           ['view', 'create', 'send']],
    ['notifications.push',      ['view', 'create', 'send']],
    ['notifications.email',     ['view', 'create', 'send']],
    ['audit_logs',              ['view']],
  ),
];

const SUPPORT_MANAGER_PERMISSIONS: string[] = [
  ...keys(
    ['dashboard',                 ['view']],
    ['support',                   ['view', 'create', 'edit', 'delete', 'assign', 'export']],
    ['leads',                     ['view']],
    ['businesses',                ['view']],
    ['businesses.stores',         ['view']],
    ['subscriptions',             ['view']],
    // Customer & order visibility
    ['biz_orders',                ['view', 'edit']],
    ['biz_orders.online',         ['view', 'edit', 'cancel']],
    ['biz_customers',             ['view', 'edit', 'export']],
    ['biz_customers.profiles',    ['view', 'edit']],
    ['biz_customers.addresses',   ['view', 'edit']],
    // Notifications — full management
    ['notifications',             ['view', 'create', 'edit', 'delete', 'send']],
    ['notifications.push',        ['view', 'create', 'send']],
    ['notifications.email',       ['view', 'create', 'send']],
    ['notifications.sms',         ['view', 'create', 'send']],
    ['audit_logs',                ['view', 'export']],
    ['users',                     ['view']],
  ),
];

const READ_ONLY_AUDITOR_PERMISSIONS: string[] = [
  ...keys(
    // All view-only across every major module
    ['dashboard',             ['view']],
    ['businesses',            ['view']],
    ['businesses.analytics',  ['view']],
    ['leads',                 ['view']],
    ['leads.pipeline',        ['view']],
    ['leads.reports',         ['view', 'export']],
    ['subscriptions',         ['view']],
    ['subscriptions.plans',   ['view']],
    ['subscriptions.invoices',['view', 'export']],
    ['sales_team',            ['view']],
    ['sales_team.reps',       ['view']],
    ['sales_team.commissions',['view', 'export']],
    ['users',                 ['view']],
    ['users.platform',        ['view']],
    ['users.business',        ['view']],
    ['notifications',         ['view']],
    ['platform_analytics',    ['view', 'export']],
    ['platform_analytics.revenue',   ['view', 'export']],
    ['platform_analytics.platform',  ['view', 'export']],
    ['platform_analytics.customers', ['view', 'export']],
    ['revenue',               ['view', 'export']],
    ['support',               ['view']],
    ['audit_logs',            ['view', 'export']],
    ['proposals',             ['view', 'export']],
    ['payment_config',        ['view']],
    ['commission',            ['view']],
    ['hrms',                  ['view']],
    ['hrms.employees',        ['view', 'export']],
    ['hrms.offer_letters',    ['view']],
    ['hrms.commission_slips', ['view', 'export']],
    ['hrms.payslips',         ['view', 'export']],
    ['hrms.templates',        ['view']],
    ['revenue_ops',           ['view', 'export']],
    ['revenue_ops.signup_ownership',      ['view']],
    ['revenue_ops.renewal_ownership',     ['view']],
    ['revenue_ops.addon_ownership',       ['view']],
    ['revenue_ops.commission_processing', ['view', 'export']],
    ['mobile_apps',           ['view']],
    ['ops_dashboard',         ['view']],
    ['deployment',            ['view']],
    ['releases',              ['view']],
    ['backup',                ['view']],
    ['brand_studio',          ['view']],
    ['roles_permissions',     ['view']],
    ['website',               ['view']],
    ['settings',              ['view']],
  ),
];

// ─── REGISTRY ────────────────────────────────────────────────────────────────

export type RoleId =
  | 'QUANTIX_SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'QUANTIX_SALES_TEAM'
  | 'SUPPORT_TEAM' | 'FINANCE_TEAM' | 'DEPLOYMENT_TEAM'
  | 'SALES_MANAGER' | 'BD_EXECUTIVE' | 'HR_ADMIN'
  | 'FINANCE_MANAGER' | 'OPERATIONS_MANAGER' | 'SUPPORT_MANAGER' | 'READ_ONLY_AUDITOR'
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
  // ── Core Platform ──────────────────────────────────────────────────────────
  { id: 'QUANTIX_SUPER_ADMIN',  label: 'Quantix Super Admin',            group: 'platform', color: '#dc2626', description: 'Full platform access — no restrictions. QS only.' },
  { id: 'PLATFORM_ADMIN',       label: 'Platform Administrator',         group: 'platform', color: '#7c3aed', description: 'Near-full admin, cannot impersonate or delete platform staff' },
  // ── Named Roles ────────────────────────────────────────────────────────────
  { id: 'SALES_MANAGER',        label: 'Sales Manager',                  group: 'platform', color: '#2563eb', description: 'Manages leads, sales team, CRM and commission approvals' },
  { id: 'BD_EXECUTIVE',         label: 'Business Development Executive', group: 'platform', color: '#0284c7', description: 'Lead generation, prospect management and proposals' },
  { id: 'HR_ADMIN',             label: 'HR Administrator',               group: 'platform', color: '#16a34a', description: 'Full HRMS — employees, offer letters, payslips, templates' },
  { id: 'FINANCE_MANAGER',      label: 'Finance Manager',                group: 'platform', color: '#d97706', description: 'Billing, revenue, subscriptions and commission processing' },
  { id: 'OPERATIONS_MANAGER',   label: 'Operations Manager',             group: 'platform', color: '#0891b2', description: 'Business provisioning, deployments and operational monitoring' },
  { id: 'SUPPORT_MANAGER',      label: 'Support Manager',                group: 'platform', color: '#059669', description: 'Support tickets, notifications and customer escalations' },
  { id: 'READ_ONLY_AUDITOR',    label: 'Read Only Auditor',              group: 'platform', color: '#6b7280', description: 'View-only access to all modules for compliance and auditing' },
  // ── Legacy Team Roles ──────────────────────────────────────────────────────
  { id: 'QUANTIX_SALES_TEAM',   label: 'Sales Team',                     group: 'platform', color: '#3b82f6', description: 'Leads, CRM, and business prospect management' },
  { id: 'SUPPORT_TEAM',         label: 'Support Team',                   group: 'platform', color: '#10b981', description: 'Customer support and ticket management' },
  { id: 'FINANCE_TEAM',         label: 'Finance Team',                   group: 'platform', color: '#f59e0b', description: 'Billing, invoices, revenue, payouts' },
  { id: 'DEPLOYMENT_TEAM',      label: 'Deployment Team',                group: 'platform', color: '#06b6d4', description: 'CI/CD, releases, mobile apps and monitoring' },
  // ── Business Roles ─────────────────────────────────────────────────────────
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
  SALES_MANAGER:        SALES_MANAGER_PERMISSIONS,
  BD_EXECUTIVE:         BD_EXECUTIVE_PERMISSIONS,
  HR_ADMIN:             HR_ADMIN_PERMISSIONS,
  FINANCE_MANAGER:      FINANCE_MANAGER_PERMISSIONS,
  OPERATIONS_MANAGER:   OPERATIONS_MANAGER_PERMISSIONS,
  SUPPORT_MANAGER:      SUPPORT_MANAGER_PERMISSIONS,
  READ_ONLY_AUDITOR:    READ_ONLY_AUDITOR_PERMISSIONS,
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
