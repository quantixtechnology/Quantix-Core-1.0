// ============================================================================
// Laundry OS — RBAC Permission Catalog (the single source of truth for what
// permissions exist). Structure: Module → Screen → Action. Permission keys are
// `<module>.<screen>.<action>`. Adding a module/screen/action here makes it
// available to every role WITHOUT any schema or resolver change — nothing is
// hardcoded per role. This catalog is Laundry-OS specific and independent of the
// platform auth (`lib/permissions.ts`), which is untouched.
// ============================================================================

export interface ScreenDef { key: string; label: string; actions: string[] }
export interface ModuleDef { key: string; label: string; screens: ScreenDef[] }

// Common action groups.
const WORKSTATION = ["view", "process", "pause", "resume", "complete", "override"]
const STORE_SCREEN = ["view", "operate", "reopen", "override"]
const INBOUND = ["view", "operate", "override"]

export const RBAC_CATALOG: ModuleDef[] = [
  {
    key: "laundry", label: "Laundry", screens: [
      { key: "dashboard", label: "Dashboard", actions: ["view"] },
      { key: "orders", label: "Orders", actions: ["view", "create", "edit", "delete", "cancel", "print", "export", "refund"] },
      { key: "customers", label: "Customers", actions: ["view", "create", "edit", "delete", "merge", "invite"] },
      { key: "subscriptions", label: "Subscriptions", actions: ["view", "create", "edit", "delete", "renew", "cancel", "adjust"] },
      { key: "pricing", label: "Pricing", actions: ["view", "edit_pricing", "edit_billing_type", "delete_rules"] },
      { key: "stores", label: "Stores", actions: ["view", "create", "edit", "delete"] },
      { key: "staff", label: "Staff", actions: ["view", "create", "edit", "delete", "assign_role"] },
      { key: "reports", label: "Reports", actions: ["view", "export"] },
      { key: "settings", label: "Settings", actions: ["view", "edit"] },
    ],
  },
  {
    key: "crm", label: "CRM", screens: [
      { key: "dashboard", label: "Dashboard", actions: ["view"] },
      { key: "leads", label: "Leads", actions: ["view", "create", "edit", "delete", "import", "export"] },
      { key: "opportunity", label: "Opportunity", actions: ["view", "create", "edit", "delete"] },
      { key: "activities", label: "Activities", actions: ["view", "create", "edit", "delete"] },
      { key: "pipeline", label: "Pipeline", actions: ["view", "edit"] },
      { key: "settings", label: "Settings", actions: ["view", "edit"] },
      { key: "templates", label: "Templates", actions: ["view", "edit"] },
      { key: "reports", label: "Reports", actions: ["view", "export"] },
    ],
  },
  {
    key: "processing", label: "Processing Center", screens: [
      { key: "console_receive", label: "Console & Receive", actions: INBOUND },
      { key: "audit_barcode", label: "Barcode Generation", actions: INBOUND }, // Processing Center Receive → one barcode per garment (NOT store audit)
      { key: "washing", label: "Washing", actions: WORKSTATION },
      { key: "drying", label: "Drying", actions: WORKSTATION },
      { key: "dry_cleaning", label: "Dry Cleaning", actions: WORKSTATION },
      { key: "ironing", label: "Ironing", actions: WORKSTATION },
      { key: "folding", label: "Folding", actions: WORKSTATION },
      { key: "quality_check", label: "Quality Check", actions: WORKSTATION },
      { key: "packing", label: "Packing", actions: WORKSTATION },
    ],
  },
  {
    key: "store_ops", label: "Store Operations", screens: [
      { key: "store_audit", label: "Store Audit", actions: STORE_SCREEN },
      { key: "payment_collection", label: "Payment Collection", actions: STORE_SCREEN },
      { key: "packing_qr", label: "Packing & QR", actions: STORE_SCREEN },
      { key: "transit", label: "Transit", actions: STORE_SCREEN },
      { key: "store_receive", label: "Store Receive", actions: STORE_SCREEN },
      { key: "ready_for_delivery", label: "Ready for Delivery", actions: STORE_SCREEN },
    ],
  },
  {
    key: "customer_app", label: "Customer App", screens: [
      { key: "customers", label: "View Customers", actions: ["view"] },
      { key: "invitation", label: "Send Invitation", actions: ["send"] },
      { key: "subscription", label: "View Subscription", actions: ["view"] },
      { key: "orders", label: "View Orders", actions: ["view"] },
    ],
  },
]

// Every permission key in the catalog.
export function allPermissionKeys(): string[] {
  const keys: string[] = []
  for (const m of RBAC_CATALOG) for (const s of m.screens) for (const a of s.actions) keys.push(`${m.key}.${s.key}.${a}`)
  return keys
}
export function isValidPermissionKey(key: string): boolean {
  return allPermissionKeys().includes(key)
}
// All keys within a module (used for menu-section gating).
export function moduleKeys(moduleKey: string): string[] {
  const m = RBAC_CATALOG.find((x) => x.key === moduleKey)
  if (!m) return []
  return m.screens.flatMap((s) => s.actions.map((a) => `${m.key}.${s.key}.${a}`))
}

// ── Default permission sets for the 10 system roles (data, not hardcoded gates).
// Derived from the catalog so new actions flow in automatically per the rules.
const keys = () => allPermissionKeys()
const viewKeys = () => keys().filter((k) => k.endsWith(".view"))
const moduleAll = (mod: string) => keys().filter((k) => k.startsWith(`${mod}.`))
const screenAll = (mod: string, screen: string) => keys().filter((k) => k.startsWith(`${mod}.${screen}.`))
const workstationOps = () => keys().filter((k) => k.startsWith("processing.") && /\.(view|process|pause|resume|complete)$/.test(k))
// The Laundry dashboard is the home landing — every role can see it (custom
// roles may remove it). Owner + Viewer + Store Manager already include it via
// their broad sets; this is the shared grant for the more scoped roles.
const DASH = "laundry.dashboard.view"

export interface SystemRoleDef { code: string; name: string; description: string; isOwner?: boolean; perms: () => string[] }

export const SYSTEM_ROLES: SystemRoleDef[] = [
  { code: "BUSINESS_OWNER", name: "Business Owner", description: "Full, unrestricted access. Cannot be deleted or lose access.", isOwner: true, perms: () => keys() },
  { code: "STORE_MANAGER", name: "Store Manager", description: "Operational management across store + processing.", perms: () => [...moduleAll("laundry").filter((k) => !k.startsWith("laundry.settings")), ...moduleAll("store_ops"), ...moduleAll("processing"), ...screenAll("laundry", "reports")] },
  { code: "COUNTER_EXECUTIVE", name: "Counter Executive", description: "Order creation and customer handling.", perms: () => [DASH, ...screenAll("laundry", "orders").filter((k) => /\.(view|create|edit|print)$/.test(k)), ...screenAll("laundry", "customers").filter((k) => /\.(view|create|edit|invite)$/.test(k)), ...screenAll("laundry", "subscriptions").filter((k) => k.endsWith(".view")), ...screenAll("store_ops", "store_audit"), ...screenAll("store_ops", "payment_collection"), ...screenAll("store_ops", "packing_qr")] },
  { code: "PROCESSING_MANAGER", name: "Processing Manager", description: "Processing Center management.", perms: () => [DASH, ...moduleAll("processing")] },
  { code: "PROCESSING_STAFF", name: "Processing Staff", description: "Workstation operations only (no override).", perms: () => [DASH, ...workstationOps()] },
  { code: "DELIVERY_EXECUTIVE", name: "Delivery Executive", description: "Delivery operations only.", perms: () => [DASH, ...screenAll("store_ops", "ready_for_delivery"), ...screenAll("store_ops", "transit").filter((k) => /\.(view|operate)$/.test(k))] },
  { code: "CRM_MANAGER", name: "CRM Manager", description: "Full CRM access.", perms: () => [DASH, ...moduleAll("crm")] },
  { code: "CRM_EXECUTIVE", name: "CRM Executive", description: "Leads and Opportunities only.", perms: () => [DASH, ...screenAll("crm", "dashboard"), ...screenAll("crm", "leads").filter((k) => /\.(view|create|edit)$/.test(k)), ...screenAll("crm", "opportunity").filter((k) => /\.(view|create|edit)$/.test(k)), ...screenAll("crm", "activities").filter((k) => /\.(view|create|edit)$/.test(k))] },
  { code: "ACCOUNTANT", name: "Accountant", description: "Payments, invoices, reports.", perms: () => [DASH, ...screenAll("laundry", "orders").filter((k) => /\.(view|print|export|refund)$/.test(k)), ...screenAll("laundry", "subscriptions").filter((k) => k.endsWith(".view")), ...screenAll("laundry", "pricing").filter((k) => k.endsWith(".view")), ...moduleAll("laundry").filter((k) => k.startsWith("laundry.reports")), ...screenAll("store_ops", "payment_collection")] },
  { code: "VIEWER", name: "Viewer", description: "Read-only access.", perms: () => viewKeys() },
]
