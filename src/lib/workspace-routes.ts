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

// Keyed by product code (uppercase). Values must match an existing route under
// src/app/.
const WORKSPACE_ENTRY_ROUTES: Record<string, string> = {
  COMMERCE: '/commerce/dashboard', // src/app/commerce/dashboard/page.tsx
  LAUNDRY: '/laundry/login', // src/app/laundry/login/page.tsx (no /laundry/dashboard exists)
}

// Fallback to a route that is guaranteed to exist.
const DEFAULT_WORKSPACE_ROUTE = '/commerce/dashboard'

/**
 * Resolve the real in-app workspace entry route for a product code.
 * @param productCode e.g. 'COMMERCE' | 'LAUNDRY' (case-insensitive)
 */
export function getWorkspaceEntryRoute(productCode?: string | null): string {
  const code = (productCode || '').toUpperCase()
  return WORKSPACE_ENTRY_ROUTES[code] || DEFAULT_WORKSPACE_ROUTE
}
