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

// The product workspace IS the root SPA (src/app/page.tsx) served on the
// product subdomain — NOT the standalone /<product>/* routes (those are
// placeholders). The SPA renders the correct product workspace from the
// authenticated session plus the `_product` / `businessId` query the proxy
// forwards. So every product's in-app workspace entry is the SPA root "/".
//
// This keeps adding a future product (Restaurant/Pharmacy/…) zero-routing:
// it enters the same root SPA; no per-product entry route is needed.
const ROOT_WORKSPACE_ROUTE = '/'

/**
 * Resolve the in-app workspace entry route for a product code.
 * Always the root SPA "/" under the subdomain architecture.
 *
 * @param productCode unused — kept for call-site compatibility and clarity.
 */
export function getWorkspaceEntryRoute(_productCode?: string | null): string {
  return ROOT_WORKSPACE_ROUTE
}
