// SINGLE SOURCE OF TRUTH for Laundry OS permissions.
// Any new screen requires:
//   1. Registry entry below (module + screen key/label)
//   2. Sidebar registration (if UI-visible)
//   3. Route/API protection using requireLaundryLevel(screenKey, Level.*)
//   4. Default role mapping in laundry-rbac-catalog.ts
// Do NOT add screens anywhere else without registering them here first.

export enum Level {
  HIDE = 0,
  VIEW = 1,
  CREATE = 2,
  EDIT = 3,
}

export const LEVEL_LABELS: Record<number, string> = {
  [Level.VIEW]: "View — Read-only (search, filter, print, export, lookup, scan)",
  [Level.CREATE]: "Create — Create records + workflow progression (process, pack, dispatch, receive, deliver, QC pass/fail, pause, resume, bulk)",
  [Level.EDIT]: "Edit — Destructive/exceptional actions (delete, cancel, reject, override, reverse workflow, manual release, return to queue, merge)",
}

export interface ScreenEntry {
  key: string
  label: string
}

export interface ModuleEntry {
  key: string
  label: string
  screens: ScreenEntry[]
}

export interface ScreenLevel {
  screenKey: string
  level: number
}

export const SCREEN_MODULES: ModuleEntry[] = [
  {
    key: "laundry", label: "Laundry", screens: [
      { key: "dashboard", label: "Dashboard" },
      { key: "orders", label: "Orders" },
      { key: "new_order", label: "New Order" },
      { key: "customers", label: "Customers" },
      { key: "garment_lookup", label: "Garment Lookup" },
      { key: "subscriptions", label: "Subscriptions" },
      { key: "subscription_plans", label: "Subscription Plans" },
      { key: "charges_rules", label: "Charges & Rules" },
      { key: "pricing_simulator", label: "Pricing Simulator" },
      { key: "services", label: "Services" },
      { key: "pricing", label: "Pricing" },
      { key: "stores", label: "Stores" },
      { key: "staff", label: "Staff" },
      { key: "bags", label: "Reusable Bags" },
      { key: "reports", label: "Reports" },
      { key: "settings", label: "Settings" },
      { key: "hardware", label: "Hardware Manager" },
      { key: "navigation", label: "Navigation Manager" },
      { key: "delivery_executives", label: "Delivery Executives" },
      { key: "mobile_apps", label: "Mobile Apps" },
      { key: "roles", label: "Roles & Permissions" },
      { key: "order_detail", label: "Order Detail" },
      { key: "inbox", label: "Inbox" },
    ],
  },
  {
    key: "crm", label: "CRM", screens: [
      { key: "dashboard", label: "Dashboard" },
      { key: "leads", label: "Leads" },
      { key: "opportunity", label: "Opportunity" },
      { key: "activities", label: "Activities" },
      { key: "pipeline", label: "Pipeline" },
      { key: "settings", label: "Settings" },
      { key: "reports", label: "Reports" },
    ],
  },
  {
    key: "processing", label: "Processing Center", screens: [
      { key: "console_receive", label: "Console & Receive" },
      { key: "audit_barcode", label: "Barcode Generation" },
      { key: "washing", label: "Washing" },
      { key: "dry_cleaning", label: "Dry Cleaning" },
      { key: "ironing", label: "Ironing" },
      { key: "folding", label: "Folding" },
      { key: "quality_check", label: "Dry & Quality Check" },
      { key: "sorting", label: "Sorting" },
      { key: "transit", label: "Transit" },
    ],
  },
  {
    key: "store_ops", label: "Store Operations", screens: [
      { key: "store_audit", label: "Store Audit" },
      { key: "payment_collection", label: "Payment Collection" },
      { key: "packing_qr", label: "Packing & QR" },
      { key: "transit", label: "Transit" },
      { key: "store_receive", label: "Store Receive" },
      { key: "ready_for_delivery", label: "Ready for Delivery" },
      { key: "pickup_scheduler", label: "Pickup Scheduler" },
      { key: "pickup_bags", label: "Assign Bags" },
      { key: "dispatch_center", label: "Dispatch Center" },
      { key: "delivery_assignments", label: "Delivery Assignments" },
      { key: "bag_management", label: "Bag Management" },
    ],
  },
  {
    key: "marketing", label: "Marketing", screens: [
      { key: "dashboard", label: "Dashboard" },
      { key: "discounts", label: "Discounts" },
      { key: "coupons", label: "Coupons" },
      { key: "reports", label: "Reports" },
      { key: "loyalty", label: "Loyalty Program" },
      { key: "membership", label: "Membership Levels" },
      { key: "credits", label: "Promotional Credits" },
      { key: "giftcards", label: "Gift Cards" },
      { key: "referral", label: "Referral Program" },
      { key: "campaigns", label: "Campaigns" },
      { key: "cart_recovery", label: "Cart Recovery" },
    ],
  },
  {
    key: "customer_app", label: "Customer App", screens: [
      { key: "customers", label: "View Customers" },
      { key: "invitation", label: "Send Invitation" },
      { key: "subscription", label: "View Subscription" },
      { key: "orders", label: "View Orders" },
    ],
  },
]

export function allScreenKeys(): string[] {
  const keys: string[] = []
  for (const m of SCREEN_MODULES) for (const s of m.screens) keys.push(`${m.key}.${s.key}`)
  return keys
}

export function isValidScreenKey(key: string): boolean {
  return allScreenKeys().includes(key)
}

export function screenLabel(screenKey: string): string {
  for (const m of SCREEN_MODULES) for (const s of m.screens) if (`${m.key}.${s.key}` === screenKey) return s.label
  return screenKey
}

const VIEW_ACTIONS = new Set(["view", "list", "search", "filter", "print", "export", "lookup"])
const CREATE_ACTIONS = new Set(["create", "add", "new", "invite", "send", "import", "operate", "process", "complete", "pause", "resume", "pack", "dispatch", "receive", "deliver", "start", "progress", "collect", "convert"])
// Compound action names have to be listed explicitly. An action this set does
// not recognise falls through to VIEW, which is the safe default for a READ but
// silently disarms a WRITE: "laundry.pricing.edit_pricing" guards fourteen
// create/update/delete endpoints across Services, Categories, Garments and the
// Pricing Matrix, and resolved to VIEW — so every role holding Pricing at
// read-only, the Viewer included, could rewrite the tenant's masters.
const EDIT_ACTIONS = new Set(["edit", "update", "modify", "change", "cancel", "delete", "remove", "reject", "override", "refund", "adjust", "release", "merge", "reopen", "return", "approve", "deny", "assign_role", "edit_pricing", "delete_rules"])

export function actionToLevel(action: string): Level {
  if (EDIT_ACTIONS.has(action)) return Level.EDIT
  if (CREATE_ACTIONS.has(action)) return Level.CREATE
  return Level.VIEW
}

export function permKeyToScreenLevel(permKey: string): { screenKey: string; level: Level } | null {
  const parts = permKey.split(".")
  if (parts.length < 3) return null
  const action = parts.pop()!
  const screenKey = parts.join(".")
  if (!isValidScreenKey(screenKey)) return null
  return { screenKey, level: actionToLevel(action) }
}

/**
 * THE single authorization resolver for the platform. Every surface — sidebar,
 * Roles & Permissions, workspace entry, landing, deep links, route guards and
 * server APIs — decides access through this one function using ONLY the
 * resolved screenKey → level map and the session's owner flag. No role names,
 * module names or legacy fallback permissions are ever consulted, and a
 * screenKey that is not registered in SCREEN_MODULES is never accessible.
 */
/**
 * A detail screen belongs to its section, and is reached BY the section.
 *
 * Granting "Orders" and then discovering the employee cannot open an order is
 * not a permission an administrator meant to withhold — it is one they never
 * knew existed. A small business configures sections, not screens, so the
 * parent's grant satisfies the child.
 *
 * Only genuine detail pages belong here: a screen reachable on its own from
 * navigation is its own section and must keep its own grant. Garment Lookup,
 * for instance, is a top-level tool rather than a detail of anything.
 */
export const SCREEN_PARENTS: Record<string, string> = {
  "laundry.order_detail": "laundry.orders",
}

export function isScreenAccessible(
  screenLevels: Record<string, number>,
  isOwner: boolean,
  screenKey: string,
): boolean {
  if (isOwner) return true
  if (!isValidScreenKey(screenKey)) return false
  if ((screenLevels[screenKey] ?? 0) >= Level.VIEW) return true
  // Inherit VIEW from the section this screen is part of. Deliberately VIEW
  // only: it decides whether the screen OPENS. What may be done inside it
  // still reads that screen's own level, so CREATE/EDIT semantics are
  // unchanged, and no store or tenant scope is bypassed — those are enforced
  // by the data queries, not here.
  const parent = SCREEN_PARENTS[screenKey]
  return !!parent && (screenLevels[parent] ?? 0) >= Level.VIEW
}
