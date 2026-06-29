// ============================================================================
// Workspace Entry Routes
// Single source of truth mapping a product code to its REAL in-app workspace
// entry route (the route that actually exists under src/app/<product>/...).
//
// Why this exists: the onboarding launcher previously built `/<product>/dashboard`
// for every product. That route only exists for COMMERCE (/commerce/dashboard);
// LAUNDRY has no /laundry/dashboard route — its entry is /laundry/login — so the
// launcher 404'd. Centralising the mapping here keeps the path defined once
// (no duplicated strings) and ensures the launcher always resolves to a real route.
//
// NOTE: this is the LOCAL in-app route, distinct from ProductRuntimeRegistry
// .workspaceUrl (the external subdomain used by the admin "Open Workspace").
// ============================================================================

// Explicit overrides ONLY for products whose entry route deviates from the
// convention below. Keyed by product code (uppercase); values must match an
// existing route under src/app/.
//   - COMMERCE follows the convention (/commerce/dashboard) but is listed for clarity.
//   - LAUNDRY deviates: its entry is /laundry/login (there is no /laundry/dashboard).
const WORKSPACE_ENTRY_OVERRIDES: Record<string, string> = {
  COMMERCE: '/commerce/dashboard',
  LAUNDRY: '/laundry/login',
}

// Legacy fallback when no product code is supplied at all.
const DEFAULT_WORKSPACE_ROUTE = '/commerce/dashboard'

/**
 * Resolve the real in-app workspace entry route for a product code.
 *
 * Convention (NO code change needed for future products): a product served on
 * `<product>.<base>` enters at `/<product>/dashboard`. Products that deviate
 * are listed in WORKSPACE_ENTRY_OVERRIDES. This keeps routing generic so adding
 * Restaurant/Pharmacy/Salon/… requires only a registry entry + its route tree.
 *
 * @param productCode e.g. 'COMMERCE' | 'LAUNDRY' | 'RESTAURANT' (case-insensitive)
 */
export function getWorkspaceEntryRoute(productCode?: string | null): string {
  const code = (productCode || '').toUpperCase()
  if (!code) return DEFAULT_WORKSPACE_ROUTE
  return WORKSPACE_ENTRY_OVERRIDES[code] || `/${code.toLowerCase()}/dashboard`
}
