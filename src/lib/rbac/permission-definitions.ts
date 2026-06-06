// ============================================================================
// Enterprise RBAC — Permission Definitions
// Every module, submodule, and action that can be controlled.
// Key format: "{moduleId}:{actionId}"  e.g. "businesses:create"
//             "{moduleId}.{subId}:{actionId}"  e.g. "businesses.stores:delete"
// ============================================================================

export type ActionId =
  | 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import'
  | 'configure' | 'approve' | 'assign' | 'refund' | 'suspend'
  | 'impersonate' | 'billing' | 'send' | 'cancel'
  // Document & HR actions
  | 'print' | 'process' | 'release';

export const STANDARD_ACTION_IDS: ActionId[] = ['view', 'create', 'edit', 'delete', 'export'];
export const EXTENDED_ACTION_IDS: ActionId[] = [
  'import', 'configure', 'approve', 'assign', 'refund', 'suspend',
  'impersonate', 'billing', 'send', 'cancel', 'print', 'process', 'release',
];

export interface ActionDef {
  id: ActionId;
  label: string;
  description: string;
  color: string;
  isExtended: boolean;
}

export const PERMISSION_ACTIONS: ActionDef[] = [
  { id: 'view',        label: 'View',        description: 'Read-only access',            color: '#3b82f6', isExtended: false },
  { id: 'create',      label: 'Create',      description: 'Add new records',             color: '#22c55e', isExtended: false },
  { id: 'edit',        label: 'Edit',        description: 'Modify existing data',        color: '#f59e0b', isExtended: false },
  { id: 'delete',      label: 'Delete',      description: 'Remove records permanently',  color: '#ef4444', isExtended: false },
  { id: 'export',      label: 'Export',      description: 'Download / export data',      color: '#8b5cf6', isExtended: false },
  { id: 'import',      label: 'Import',      description: 'Bulk import data',            color: '#06b6d4', isExtended: true  },
  { id: 'configure',   label: 'Configure',   description: 'Change module settings',      color: '#6366f1', isExtended: true  },
  { id: 'approve',     label: 'Approve',     description: 'Approve / reject items',      color: '#14b8a6', isExtended: true  },
  { id: 'assign',      label: 'Assign',      description: 'Assign records to others',    color: '#f97316', isExtended: true  },
  { id: 'refund',      label: 'Refund',      description: 'Process refunds / reversals', color: '#ec4899', isExtended: true  },
  { id: 'suspend',     label: 'Suspend',     description: 'Suspend / deactivate',        color: '#dc2626', isExtended: true  },
  { id: 'impersonate', label: 'Impersonate', description: 'Login as another user',       color: '#78716c', isExtended: true  },
  { id: 'billing',     label: 'Billing',     description: 'Access billing & invoices',   color: '#ca8a04', isExtended: true  },
  { id: 'send',        label: 'Send',        description: 'Send messages / notifications',color: '#2563eb', isExtended: true  },
  { id: 'cancel',      label: 'Cancel',      description: 'Cancel operations / orders',  color: '#b91c1c', isExtended: true  },
  { id: 'print',       label: 'Print',       description: 'Print / save document as PDF', color: '#0f172a', isExtended: true  },
  { id: 'process',     label: 'Process',     description: 'Process payroll / commissions', color: '#7c3aed', isExtended: true  },
  { id: 'release',     label: 'Release',     description: 'Release payout to recipient',  color: '#16a34a', isExtended: true  },
];

export type ModuleGroup = 'platform' | 'deployment' | 'business' | 'hrms';

export interface SubmoduleDef {
  id: string;        // full key e.g. "businesses.stores"
  label: string;
  actions: ActionId[];
}

export interface ModuleDef {
  id: string;        // e.g. "businesses"
  label: string;
  icon: string;
  group: ModuleGroup;
  description: string;
  actions: ActionId[];
  submodules: SubmoduleDef[];
}

// ─── PLATFORM MODULES ────────────────────────────────────────────────────────
export const PERMISSION_MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    group: 'platform',
    description: 'Platform overview and KPI dashboard',
    actions: ['view', 'export'],
    submodules: [],
  },
  {
    id: 'businesses',
    label: 'Businesses',
    icon: 'Building2',
    group: 'platform',
    description: 'Multi-tenant business accounts',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'configure', 'suspend', 'impersonate'],
    submodules: [
      { id: 'businesses.onboarding',    label: 'Onboarding',         actions: ['view', 'create', 'edit', 'approve'] },
      { id: 'businesses.subscriptions', label: 'Subscriptions',      actions: ['view', 'create', 'edit', 'delete', 'billing'] },
      { id: 'businesses.modules',       label: 'Feature Modules',    actions: ['view', 'configure'] },
      { id: 'businesses.stores',        label: 'Store Management',   actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'businesses.analytics',     label: 'Business Analytics', actions: ['view', 'export'] },
    ],
  },
  {
    id: 'proposals',
    label: 'Quote & Proposals / Documents',
    icon: 'FileText',
    group: 'platform',
    description: 'Generate, manage and archive client proposals and quote documents',
    actions: ['view', 'create', 'delete', 'export'],
    submodules: [],
  },
  {
    id: 'payment_config',
    label: 'Payment Configuration',
    icon: 'CreditCard',
    group: 'platform',
    description: 'Bank details and payment QR for proposals',
    actions: ['view', 'edit'],
    submodules: [],
  },
  {
    id: 'leads',
    label: 'Sales & Leads',
    icon: 'UserCheck',
    group: 'platform',
    description: 'CRM — lead pipeline and prospects',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'assign'],
    submodules: [
      { id: 'leads.pipeline',    label: 'Lead Pipeline',    actions: ['view', 'create', 'edit', 'delete', 'assign', 'export'] },
      { id: 'leads.follow_ups',  label: 'Follow-ups',       actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'leads.reports',     label: 'CRM Reports',      actions: ['view', 'export'] },
    ],
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions & Billing',
    icon: 'CreditCard',
    group: 'platform',
    description: 'Platform billing, plans, invoices',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'refund', 'billing'],
    submodules: [
      { id: 'subscriptions.plans',    label: 'Plan Management', actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'subscriptions.invoices', label: 'Invoices',        actions: ['view', 'export', 'refund'] },
      { id: 'subscriptions.payments', label: 'Payments',        actions: ['view', 'approve', 'refund', 'billing'] },
    ],
  },
  {
    id: 'payment_plugins',
    label: 'Payment Plugins',
    icon: 'Plug',
    group: 'platform',
    description: 'Payment gateway integrations',
    actions: ['view', 'create', 'edit', 'delete', 'configure'],
    submodules: [],
  },
  {
    id: 'domains',
    label: 'Domains & Deploys',
    icon: 'Globe',
    group: 'platform',
    description: 'Custom domains and live deployments',
    actions: ['view', 'create', 'edit', 'delete', 'configure'],
    submodules: [],
  },
  {
    id: 'sales_team',
    label: 'Sales Team',
    icon: 'Users',
    group: 'platform',
    description: 'Sales rep management and commissions',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    submodules: [
      { id: 'sales_team.reps',        label: 'Sales Reps',   actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'sales_team.commissions', label: 'Commissions',  actions: ['view', 'edit', 'approve', 'export'] },
      { id: 'sales_team.targets',     label: 'Targets',      actions: ['view', 'create', 'edit'] },
    ],
  },
  {
    id: 'users',
    label: 'User Management',
    icon: 'ShieldCheck',
    group: 'platform',
    description: 'Platform staff and business user accounts',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'suspend', 'impersonate'],
    submodules: [
      { id: 'users.platform', label: 'Platform Staff',      actions: ['view', 'create', 'edit', 'delete', 'suspend'] },
      { id: 'users.business', label: 'Business Users',      actions: ['view', 'create', 'edit', 'delete', 'suspend', 'impersonate'] },
      { id: 'users.roles',    label: 'Roles & Permissions', actions: ['view', 'edit', 'configure'] },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'Bell',
    group: 'platform',
    description: 'Push, email, and SMS notification management',
    actions: ['view', 'create', 'edit', 'delete', 'send'],
    submodules: [
      { id: 'notifications.push',  label: 'Push Notifications',  actions: ['view', 'create', 'send'] },
      { id: 'notifications.email', label: 'Email Notifications', actions: ['view', 'create', 'send'] },
      { id: 'notifications.sms',   label: 'SMS Notifications',   actions: ['view', 'create', 'send'] },
    ],
  },
  {
    id: 'platform_analytics',
    label: 'Analytics & Reports',
    icon: 'BarChart3',
    group: 'platform',
    description: 'Platform-wide analytics, revenue reports',
    actions: ['view', 'export', 'configure'],
    submodules: [
      { id: 'platform_analytics.revenue',   label: 'Revenue Analytics',   actions: ['view', 'export'] },
      { id: 'platform_analytics.platform',  label: 'Platform Metrics',    actions: ['view', 'export'] },
      { id: 'platform_analytics.customers', label: 'Customer Analytics',  actions: ['view', 'export'] },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue & Payouts',
    icon: 'Wallet',
    group: 'platform',
    description: 'Payout processing and financial reconciliation',
    actions: ['view', 'export', 'approve', 'billing'],
    submodules: [],
  },
  {
    id: 'support',
    label: 'Support & Tickets',
    icon: 'Headphones',
    group: 'platform',
    description: 'Customer support ticket management',
    actions: ['view', 'create', 'edit', 'delete', 'assign', 'export'],
    submodules: [],
  },
  {
    id: 'audit_logs',
    label: 'Audit Logs',
    icon: 'ScrollText',
    group: 'platform',
    description: 'Platform-wide activity and audit trail',
    actions: ['view', 'export'],
    submodules: [],
  },
  {
    id: 'settings',
    label: 'Platform Settings',
    icon: 'Settings',
    group: 'platform',
    description: 'Global platform configuration',
    actions: ['view', 'edit', 'configure'],
    submodules: [
      { id: 'settings.general',      label: 'General',            actions: ['view', 'edit'] },
      { id: 'settings.email',        label: 'Email & SMTP',       actions: ['view', 'edit', 'configure'] },
      { id: 'settings.security',     label: 'Security',           actions: ['view', 'configure'] },
      { id: 'settings.integrations', label: 'Integrations',       actions: ['view', 'create', 'edit', 'delete', 'configure'] },
    ],
  },

  // ─── DEPLOYMENT GROUP ─────────────────────────────────────────────────────
  {
    id: 'mobile_apps',
    label: 'Mobile Apps',
    icon: 'Smartphone',
    group: 'deployment',
    description: 'Android / iOS app management',
    actions: ['view', 'create', 'edit', 'configure'],
    submodules: [],
  },
  {
    id: 'ops_dashboard',
    label: 'Operations Dashboard',
    icon: 'Activity',
    group: 'deployment',
    description: 'Operational health and system status',
    actions: ['view', 'export'],
    submodules: [],
  },
  {
    id: 'deployment',
    label: 'Deployment Pipeline',
    icon: 'Rocket',
    group: 'deployment',
    description: 'CI/CD pipeline and live deployments',
    actions: ['view', 'create', 'edit', 'delete', 'configure', 'approve'],
    submodules: [
      { id: 'deployment.pipeline',     label: 'Pipeline',            actions: ['view', 'create', 'approve'] },
      { id: 'deployment.environments', label: 'Environments',        actions: ['view', 'edit', 'configure'] },
    ],
  },
  {
    id: 'build_automation',
    label: 'Build Automation',
    icon: 'Hammer',
    group: 'deployment',
    description: 'Automated build and test workflows',
    actions: ['view', 'create', 'edit', 'delete', 'configure'],
    submodules: [],
  },
  {
    id: 'releases',
    label: 'Release Management',
    icon: 'GitBranch',
    group: 'deployment',
    description: 'Version releases and changelogs',
    actions: ['view', 'create', 'edit', 'delete', 'approve'],
    submodules: [],
  },
  {
    id: 'play_store',
    label: 'Play Store',
    icon: 'PlayCircle',
    group: 'deployment',
    description: 'App store submission management',
    actions: ['view', 'create', 'edit', 'configure'],
    submodules: [],
  },
  {
    id: 'backup',
    label: 'Backup & Monitoring',
    icon: 'Server',
    group: 'deployment',
    description: 'System backup and health monitoring',
    actions: ['view', 'create', 'configure', 'export'],
    submodules: [],
  },
  {
    id: 'security',
    label: 'Security & Access',
    icon: 'Lock',
    group: 'deployment',
    description: 'Security policies and access controls',
    actions: ['view', 'edit', 'configure'],
    submodules: [],
  },

  // ─── BUSINESS MODULES ─────────────────────────────────────────────────────
  {
    id: 'biz_products',
    label: 'Products',
    icon: 'Package',
    group: 'business',
    description: 'Business product catalog management',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'import', 'configure'],
    submodules: [
      { id: 'biz_products.catalog',   label: 'Catalog',            actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_products.variants',  label: 'Variants',           actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_products.bundles',   label: 'Bundles & Combos',   actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_products.inventory', label: 'Inventory Sync',     actions: ['view', 'edit'] },
    ],
  },
  {
    id: 'biz_orders',
    label: 'Orders',
    icon: 'ShoppingCart',
    group: 'business',
    description: 'Order lifecycle management',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'refund', 'cancel', 'assign'],
    submodules: [
      { id: 'biz_orders.online',    label: 'Online Orders',   actions: ['view', 'create', 'edit', 'cancel', 'refund'] },
      { id: 'biz_orders.pos',       label: 'POS Orders',      actions: ['view', 'create', 'refund', 'cancel'] },
      { id: 'biz_orders.delivery',  label: 'Delivery Orders', actions: ['view', 'assign', 'cancel'] },
    ],
  },
  {
    id: 'biz_inventory',
    label: 'Inventory',
    icon: 'Warehouse',
    group: 'business',
    description: 'Stock levels, adjustments and transfers',
    actions: ['view', 'edit', 'export', 'configure'],
    submodules: [
      { id: 'biz_inventory.stock',       label: 'Stock Management', actions: ['view', 'edit'] },
      { id: 'biz_inventory.adjustments', label: 'Adjustments',      actions: ['view', 'create', 'approve'] },
      { id: 'biz_inventory.transfers',   label: 'Transfers',        actions: ['view', 'create', 'approve'] },
    ],
  },
  {
    id: 'biz_customers',
    label: 'Customers',
    icon: 'UserCircle',
    group: 'business',
    description: 'Customer profiles, addresses, loyalty',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
    submodules: [
      { id: 'biz_customers.profiles',  label: 'Profiles',       actions: ['view', 'edit'] },
      { id: 'biz_customers.addresses', label: 'Addresses',      actions: ['view', 'edit'] },
      { id: 'biz_customers.loyalty',   label: 'Loyalty Points', actions: ['view', 'edit'] },
    ],
  },
  {
    id: 'biz_pos',
    label: 'POS Billing',
    icon: 'Monitor',
    group: 'business',
    description: 'Point-of-sale terminal and billing',
    actions: ['view', 'create', 'billing', 'refund', 'configure'],
    submodules: [],
  },
  {
    id: 'biz_delivery',
    label: 'Delivery Management',
    icon: 'Truck',
    group: 'business',
    description: 'Delivery partners, zones, tracking',
    actions: ['view', 'create', 'edit', 'delete', 'assign'],
    submodules: [
      { id: 'biz_delivery.partners', label: 'Delivery Partners', actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_delivery.zones',    label: 'Delivery Zones',    actions: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    id: 'biz_reports',
    label: 'Business Reports',
    icon: 'BarChart2',
    group: 'business',
    description: 'Sales, inventory and finance reports',
    actions: ['view', 'export'],
    submodules: [
      { id: 'biz_reports.sales',     label: 'Sales Reports',     actions: ['view', 'export'] },
      { id: 'biz_reports.inventory', label: 'Inventory Reports', actions: ['view', 'export'] },
      { id: 'biz_reports.finance',   label: 'Finance Reports',   actions: ['view', 'export'] },
    ],
  },
  {
    id: 'biz_settings',
    label: 'Business Settings',
    icon: 'Settings2',
    group: 'business',
    description: 'Business configuration and preferences',
    actions: ['view', 'edit', 'configure'],
    submodules: [
      { id: 'biz_settings.general', label: 'General',         actions: ['view', 'edit'] },
      { id: 'biz_settings.stores',  label: 'Stores',          actions: ['view', 'create', 'edit', 'configure'] },
      { id: 'biz_settings.staff',   label: 'Staff',           actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_settings.payment', label: 'Payment Methods', actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'biz_settings.tax',     label: 'Tax Config',      actions: ['view', 'create', 'edit', 'configure'] },
    ],
  },

  // ─── HRMS GROUP ───────────────────────────────────────────────────────────
  {
    id: 'hrms',
    label: 'HRMS',
    icon: 'Users2',
    group: 'hrms',
    description: 'Human Resource Management System — employees, documents, payroll',
    actions: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'configure'],
    submodules: [
      {
        id: 'hrms.employees',
        label: 'Employee Master',
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      {
        id: 'hrms.offer_letters',
        label: 'Offer Letters',
        actions: ['view', 'create', 'edit', 'delete', 'print', 'approve'],
      },
      {
        id: 'hrms.commission_slips',
        label: 'Commission Slips',
        actions: ['view', 'create', 'approve', 'export', 'print'],
      },
      {
        id: 'hrms.payslips',
        label: 'Payslips',
        actions: ['view', 'create', 'approve', 'export', 'print'],
      },
      {
        id: 'hrms.templates',
        label: 'Document Templates',
        actions: ['view', 'create', 'edit', 'delete'],
      },
      {
        id: 'hrms.settings',
        label: 'HRMS Settings',
        actions: ['view', 'edit', 'configure'],
      },
    ],
  },
  {
    id: 'revenue_ops',
    label: 'Revenue Operations',
    icon: 'TrendingUp',
    group: 'hrms',
    description: 'Ownership assignment, commission processing and payout management',
    actions: ['view', 'edit', 'approve', 'export', 'process', 'release'],
    submodules: [
      {
        id: 'revenue_ops.signup_ownership',
        label: 'Signup Ownership',
        actions: ['view', 'edit', 'assign'],
      },
      {
        id: 'revenue_ops.renewal_ownership',
        label: 'Renewal Ownership',
        actions: ['view', 'edit', 'assign'],
      },
      {
        id: 'revenue_ops.addon_ownership',
        label: 'Add-On Ownership',
        actions: ['view', 'edit', 'assign'],
      },
      {
        id: 'revenue_ops.commission_processing',
        label: 'Commission Processing',
        actions: ['view', 'approve', 'export', 'process', 'release'],
      },
    ],
  },
  {
    id: 'commission',
    label: 'Commission Calculator',
    icon: 'Calculator',
    group: 'hrms',
    description: 'Sales commission calculation and management',
    actions: ['view', 'create', 'edit', 'export'],
    submodules: [],
  },
  {
    id: 'brand_studio',
    label: 'Brand Studio',
    icon: 'Palette',
    group: 'platform',
    description: 'Company branding — logo, colors, watermark, authorized signatory',
    actions: ['view', 'edit', 'configure'],
    submodules: [],
  },
  {
    id: 'roles_permissions',
    label: 'Roles & Permissions',
    icon: 'ShieldCheck',
    group: 'platform',
    description: 'Platform role management and permission matrix',
    actions: ['view', 'edit', 'configure'],
    submodules: [],
  },
  {
    id: 'website',
    label: 'Website Management',
    icon: 'Globe2',
    group: 'platform',
    description: 'Company website and public-facing content',
    actions: ['view', 'create', 'edit', 'delete', 'configure', 'export'],
    submodules: [],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function permKey(moduleId: string, actionId: ActionId): string {
  return `${moduleId}:${actionId}`;
}

export function allPermissionKeys(): string[] {
  const keys: string[] = [];
  for (const mod of PERMISSION_MODULES) {
    for (const a of mod.actions) keys.push(permKey(mod.id, a));
    for (const sub of mod.submodules) {
      for (const a of sub.actions) keys.push(permKey(sub.id, a));
    }
  }
  return keys;
}

export function getModuleById(id: string): ModuleDef | SubmoduleDef | undefined {
  for (const mod of PERMISSION_MODULES) {
    if (mod.id === id) return mod;
    for (const sub of mod.submodules) {
      if (sub.id === id) return sub;
    }
  }
  return undefined;
}

export const MODULE_GROUPS: { id: ModuleGroup; label: string }[] = [
  { id: 'platform',   label: 'Platform Control' },
  { id: 'deployment', label: 'Deployment & Ops' },
  { id: 'business',   label: 'Business Modules' },
  { id: 'hrms',       label: 'HRMS & Revenue Ops' },
];
