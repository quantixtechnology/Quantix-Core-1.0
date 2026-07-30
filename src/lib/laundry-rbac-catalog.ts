import { SCREEN_MODULES, allScreenKeys, isValidScreenKey, Level, type ScreenLevel, type ModuleEntry, type ScreenEntry } from "@/lib/laundry-rbac-registry"

export type { ModuleEntry, ScreenEntry }
export { SCREEN_MODULES as RBAC_CATALOG }

export function allPermissionKeys(): string[] {
  return allScreenKeys()
}

export function isValidPermissionKey(key: string): boolean {
  return isValidScreenKey(key)
}

export function moduleKeys(moduleKey: string): string[] {
  const m = SCREEN_MODULES.find((x) => x.key === moduleKey)
  if (!m) return []
  return m.screens.map((s) => `${m.key}.${s.key}`)
}

const keys = () => allScreenKeys()
const moduleKeysAll = (mod: string) => keys().filter((k) => k.startsWith(`${mod}.`))
const screenKey = (mod: string, screen: string) => `${mod}.${screen}`

export interface SystemRoleDef { code: string; name: string; description: string; isOwner?: boolean; screens: () => ScreenLevel[] }

export const SYSTEM_ROLES: SystemRoleDef[] = [
  { code: "BUSINESS_OWNER", name: "Business Owner", description: "Full, unrestricted access. Cannot be deleted or lose access.", isOwner: true, screens: () => keys().map((sk) => ({ screenKey: sk, level: Level.EDIT })) },
  { code: "STORE_MANAGER", name: "Store Manager", description: "Operational management across store + processing.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "laundry.orders", level: Level.CREATE },
    { screenKey: "laundry.customers", level: Level.CREATE },
    { screenKey: "laundry.subscriptions", level: Level.CREATE },
    { screenKey: "laundry.services", level: Level.VIEW },
    { screenKey: "laundry.stores", level: Level.CREATE },
    { screenKey: "laundry.staff", level: Level.CREATE },
    { screenKey: "laundry.bags", level: Level.VIEW },
    { screenKey: "laundry.reports", level: Level.VIEW },
    ...moduleKeysAll("store_ops").map((sk) => ({ screenKey: sk, level: Level.CREATE })),
    ...moduleKeysAll("processing").map((sk) => ({ screenKey: sk, level: Level.CREATE })),
  ]},
  { code: "STORE_SUPERVISOR", name: "Store Supervisor", description: "Supervises store-floor operations across the counter.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    ...moduleKeysAll("store_ops").map((sk) => ({ screenKey: sk, level: Level.CREATE })),
    { screenKey: "laundry.orders", level: Level.CREATE },
    { screenKey: "laundry.customers", level: Level.CREATE },
    { screenKey: "laundry.subscriptions", level: Level.VIEW },
    { screenKey: "laundry.reports", level: Level.VIEW },
    { screenKey: "laundry.bags", level: Level.VIEW },
  ]},
  { code: "COUNTER_EXECUTIVE", name: "Counter Executive", description: "Order creation and customer handling.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "laundry.orders", level: Level.CREATE },
    { screenKey: "laundry.customers", level: Level.CREATE },
    { screenKey: "laundry.subscriptions", level: Level.VIEW },
    { screenKey: "store_ops.store_audit", level: Level.CREATE },
    { screenKey: "store_ops.payment_collection", level: Level.CREATE },
    { screenKey: "store_ops.packing_qr", level: Level.CREATE },
  ]},
  { code: "PROCESSING_MANAGER", name: "Processing Manager", description: "Processing Center management.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    ...moduleKeysAll("processing").map((sk) => ({ screenKey: sk, level: Level.CREATE })),
  ]},
  { code: "PROCESSING_STAFF", name: "Processing Staff", description: "Workstation operations only (no override).", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "processing.console_receive", level: Level.CREATE },
    { screenKey: "processing.audit_barcode", level: Level.CREATE },
    { screenKey: "processing.washing", level: Level.CREATE },
    { screenKey: "processing.drying", level: Level.CREATE },
    { screenKey: "processing.dry_cleaning", level: Level.CREATE },
    { screenKey: "processing.ironing", level: Level.CREATE },
    { screenKey: "processing.folding", level: Level.CREATE },
    { screenKey: "processing.quality_check", level: Level.CREATE },
    { screenKey: "processing.packing", level: Level.CREATE },
  ]},
  { code: "DELIVERY_EXECUTIVE", name: "Delivery Executive", description: "Delivery operations only.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "store_ops.ready_for_delivery", level: Level.CREATE },
    { screenKey: "store_ops.transit", level: Level.CREATE },
  ]},
  { code: "CRM_MANAGER", name: "CRM Manager", description: "Full CRM access.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    ...moduleKeysAll("crm").map((sk) => ({ screenKey: sk, level: Level.EDIT })),
  ]},
  { code: "CRM_EXECUTIVE", name: "CRM Executive", description: "Leads and Opportunities only.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "crm.dashboard", level: Level.VIEW },
    { screenKey: "crm.leads", level: Level.CREATE },
    { screenKey: "crm.opportunity", level: Level.CREATE },
    { screenKey: "crm.activities", level: Level.CREATE },
  ]},
  { code: "ACCOUNTANT", name: "Accountant", description: "Payments, invoices, reports.", screens: () => [
    { screenKey: "laundry.dashboard", level: Level.VIEW },
    { screenKey: "laundry.orders", level: Level.VIEW },
    { screenKey: "laundry.subscriptions", level: Level.VIEW },
    { screenKey: "laundry.services", level: Level.VIEW },
    { screenKey: "laundry.categories", level: Level.VIEW },
    { screenKey: "laundry.garments", level: Level.VIEW },
    { screenKey: "laundry.pricing", level: Level.VIEW },
    { screenKey: "laundry.reports", level: Level.EDIT },
    { screenKey: "store_ops.payment_collection", level: Level.VIEW },
  ]},
  { code: "VIEWER", name: "Viewer", description: "Read-only access.", screens: () => keys().map((sk) => ({ screenKey: sk, level: Level.VIEW })) },
]
