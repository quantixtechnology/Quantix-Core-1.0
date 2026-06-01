// ============================================================================
// Product Image Configuration — platform-wide defaults + business overrides
//
// Usage:
//   import { resolveImageConfig, PLATFORM_IMAGE_DEFAULTS } from "@/config/product-image-config"
//
// Business admins can override via business.settings.ecommerceConfig.imageConfig
// (set through the Business Admin → Store Settings panel).
// The storefront context loader hydrates the active config into useAdminStore.
// ============================================================================

export interface ProductImageConfig {
  /** Product card image zone height in pixels (default: 130) */
  cardHeight: number
  /** Inner padding around the image in pixels (default: 8 = Tailwind p-2) */
  padding: number
  /** Image container border-radius in pixels (default: 0) */
  borderRadius: number
  /** CSS background-color for the image container (default: white) */
  backgroundColor: string
  /** CSS object-fit — "contain" keeps full product visible, "cover" fills zone */
  fitMode: "contain" | "cover"
}

// ── Platform-wide defaults ────────────────────────────────────────────────────
// Applied to every business unless a business-specific override is set.

export const PLATFORM_IMAGE_DEFAULTS: ProductImageConfig = {
  cardHeight: 130,         // meets 130–150px spec; overridable per business
  padding: 8,              // p-2 equivalent
  borderRadius: 0,
  backgroundColor: "#ffffff",
  fitMode: "contain",
}

// ── Resolver ──────────────────────────────────────────────────────────────────
// Merges a business override (from ecommerceConfig.imageConfig) onto the
// platform defaults. Missing keys fall back to platform values.

export function resolveImageConfig(
  override?: Partial<ProductImageConfig> | null
): ProductImageConfig {
  if (!override || Object.keys(override).length === 0) {
    return PLATFORM_IMAGE_DEFAULTS
  }
  return { ...PLATFORM_IMAGE_DEFAULTS, ...override }
}
