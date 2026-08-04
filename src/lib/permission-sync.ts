// ============================================================================
// PERMISSION SYNC ENGINE
// ============================================================================
// Single source of truth: the RBAC registry (SCREEN_MODULES / allScreenKeys).
// A permission is LIVE when it normalizes to a registered screen; a navigation
// screen key is LIVE when it is a registered screen, a standalone extra, or has
// a route mapping. Everything else is obsolete and safe to remove from the
// Permission Registry, Role Matrix (LaundryAccessPermission), Navigation Cache
// (LaundryNavItem) and Workspace Configuration.
//
// NOTE: `processing.drying`, `processing.packing`, `processing.qc` and
// `processing.packed` were removed from the registry in the canonical model.
// This engine removes any residual DB rows referencing them (or any other
// unregistered key) without ever touching live screens.
// ============================================================================

import { prisma } from "@/lib/prisma"
import { allScreenKeys, isValidScreenKey, permKeyToScreenLevel } from "@/lib/laundry-rbac-registry"
import { defaultNavigationConfig } from "@/lib/laundry-nav-config"

/** Operator workstation screens in the canonical Processing Center model. */
export const WORKSTATION_SCREEN_KEYS: string[] = [
  "processing.console_receive",
  "processing.audit_barcode",
  "processing.washing",
  "processing.dry_cleaning",
  "processing.quality_check",
  "processing.sorting",
  "processing.ironing",
  "processing.folding",
  "processing.transit",
]

/** Screens deliberately retired from the canonical model (removed from registry). */
export const OBSOLETE_SCREEN_KEYS: string[] = [
  "processing.drying",
  "processing.packing",
]

/**
 * Legacy standalone nav keys (pre-canonicalisation) → their registered screen
 * key. Used ONLY to MIGRATE stored navigation rows to the canonical key space —
 * runtime authorization never consults aliases.
 */
const NAV_KEY_ALIASES: Record<string, string> = {
  "new-order": "laundry.new_order",
  "garment-lookup": "laundry.garment_lookup",
  "dispatch-center": "store_ops.dispatch_center",
  "pickup-scheduler": "store_ops.pickup_scheduler",
  "delivery-assignments": "store_ops.delivery_assignments",
  "pickup-bags": "store_ops.pickup_bags",
  "bag-management": "store_ops.bag_management",
  "delivery-executives": "laundry.delivery_executives",
  "mobile-apps": "laundry.mobile_apps",
  "roles": "laundry.roles",
  "order-detail": "laundry.order_detail",
  "audit-barcode": "processing.audit_barcode",
  "inbox": "laundry.inbox",
  "subscription-plans": "laundry.subscription_plans",
  "charges-rules": "laundry.charges_rules",
  "pricing-simulator": "laundry.pricing_simulator",
  "marketing-dashboard": "marketing.dashboard",
  "marketing-discounts": "marketing.discounts",
  "marketing-coupons": "marketing.coupons",
  "marketing-reports": "marketing.reports",
  "marketing-loyalty": "marketing.loyalty",
  "marketing-membership": "marketing.membership",
  "marketing-credits": "marketing.credits",
  "marketing-giftcards": "marketing.giftcards",
  "marketing-referral": "marketing.referral",
  "marketing-campaigns": "marketing.campaigns",
  "marketing-cart-recovery": "marketing.cart_recovery",
}

/** Map a legacy standalone nav key to its registered screen key (identity otherwise). */
export function canonicalizeNavScreenKey(screenKey: string): string {
  return NAV_KEY_ALIASES[screenKey] ?? screenKey
}

/**
 * Normalize any permission key (screen-level or legacy action-level) to its
 * governing screen key. Legacy action keys like "processing.washing.process"
 * resolve to "processing.washing"; bare screen keys pass through unchanged.
 */
export function normalizePermKey(permKey: string): string {
  const mapped = permKeyToScreenLevel(permKey)
  return mapped ? mapped.screenKey : permKey
}

/** A permission key is live when it normalizes to a registered screen. */
export function isLivePermissionKey(permKey: string): boolean {
  return isValidScreenKey(normalizePermKey(permKey))
}

/**
 * A navigation screen key is live when it is a registered screen (or migrates
 * to one via NAV_KEY_ALIASES). Anything else is an orphan.
 */
export function isLiveNavScreenKey(screenKey: string): boolean {
  return isValidScreenKey(canonicalizeNavScreenKey(screenKey))
}

export function isObsoletePermissionKey(permKey: string): boolean {
  return !isLivePermissionKey(permKey)
}

// Registered screens that are only reachable through the mobile app or through
// drill-downs (not via the sidebar) — they are intentionally never in nav and
// must not be treated as orphans.
const MOBILE_ONLY_SCREENS = new Set(["customer_app.customers", "customer_app.invitation", "customer_app.subscription", "customer_app.orders"])
const PROGRAMMATIC_SCREENS = new Set(["laundry.order_detail", "laundry.inbox", "laundry.subscription_plans", "laundry.charges_rules", "laundry.pricing_simulator"])

/**
 * Registered screens that have NO navigation item, NO route AND NO workstation
 * definition — i.e. unreachable orphans that must be cleaned up. Screens that
 * are mobile-only or reached programmatically are intentionally excluded.
 */
export function findOrphanRegisteredScreens(): string[] {
  const navKeys = defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))
  const reachable = new Set<string>(navKeys.filter((k) => isValidScreenKey(k)))
  return allScreenKeys().filter((sk) => {
    if (MOBILE_ONLY_SCREENS.has(sk) || PROGRAMMATIC_SCREENS.has(sk)) return false
    return !reachable.has(sk)
  })
}

export interface SyncReport {
  totalScreens: number
  totalNavItems: number
  orphanPermissions: string[]
  orphanNavKeys: string[]
}

/** Pure audit of an existing permission/nav snapshot (no DB access). */
export function buildSyncReport(permissionKeys: string[], navScreenKeys: string[]): SyncReport {
  return {
    totalScreens: allScreenKeys().length,
    totalNavItems: navScreenKeys.length,
    orphanPermissions: [...new Set(permissionKeys.filter((k) => isObsoletePermissionKey(k)))],
    orphanNavKeys: [...new Set(navScreenKeys.filter((k) => !isLiveNavScreenKey(k)))],
  }
}

export interface SyncResult extends SyncReport {
  removedPermissions: number
  removedNavItems: number
  migratedNavItems: number
}

/**
 * Server-side cleanup: remove every residual permission row and navigation item
 * for a business that no longer maps to a live, registered screen. Idempotent
 * and safe to run repeatedly — it never touches active screens or roles.
 */
export async function syncLaundryPermissions(businessId: string): Promise<SyncResult> {
  const permissionRows = await prisma.laundryAccessPermission.findMany({
    where: { role: { businessId } },
    select: { id: true, permKey: true },
  })
  const permissionIds: string[] = []
  const orphanPermissionKeys: string[] = []
  for (const row of permissionRows) {
    if (isObsoletePermissionKey(row.permKey)) {
      permissionIds.push(row.id)
      orphanPermissionKeys.push(row.permKey)
    }
  }

  const nav = await prisma.laundryNavigation.findUnique({ where: { businessId }, select: { id: true } })
  const navRows = nav
    ? await prisma.laundryNavItem.findMany({ where: { navigationId: nav.id }, select: { id: true, screenKey: true } })
    : []
  // Migrate legacy standalone keys (e.g. "dispatch-center") to their registered
  // screen key (e.g. "store_ops.dispatch_center") BEFORE obsolete cleanup, so
  // existing businesses keep their custom navigation and items resolve through
  // the single resolver. Idempotent — a no-op once everything is canonical.
  let migratedNavItems = 0
  for (const row of navRows) {
    const canonical = canonicalizeNavScreenKey(row.screenKey)
    if (canonical !== row.screenKey) {
      await prisma.laundryNavItem.update({ where: { id: row.id }, data: { screenKey: canonical } }).catch(() => null)
      migratedNavItems++
    }
  }
  const navIds: string[] = []
  const orphanNavScreenKeys: string[] = []
  for (const row of navRows) {
    if (!isLiveNavScreenKey(row.screenKey)) {
      navIds.push(row.id)
      orphanNavScreenKeys.push(row.screenKey)
    }
  }

  let removedPermissions = 0
  if (permissionIds.length) {
    removedPermissions = (await prisma.laundryAccessPermission.deleteMany({ where: { id: { in: permissionIds } } })).count
  }
  let removedNavItems = 0
  if (navIds.length) {
    removedNavItems = (await prisma.laundryNavItem.deleteMany({ where: { id: { in: navIds } } })).count
  }

  return {
    totalScreens: allScreenKeys().length,
    totalNavItems: navRows.length,
    orphanPermissions: [...new Set(orphanPermissionKeys)],
    orphanNavKeys: [...new Set(orphanNavScreenKeys)],
    removedPermissions,
    removedNavItems,
    migratedNavItems,
  }
}
