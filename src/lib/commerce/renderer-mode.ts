// Commerce storefront renderer mode — the Phase 3 controlled-migration switch.
//
// Reuses the EXISTING per-business FeatureFlag model (no schema change) rather
// than inventing a parallel config system. One flag per business:
//   key     = "COMMERCE_RENDERER"
//   value   = {"mode":"LEGACY"|"TEMPLATE"|"AUTO"}
//
// Semantics (Phase 3 spec §4):
//   LEGACY   → always the existing storefront renderer (StorefrontHome).
//   TEMPLATE → force the template renderer; fail SAFE to neutral published
//              template, never to an invalid template.
//   AUTO     → template renderer when a valid published template resolves,
//              otherwise controlled legacy fallback during migration.
//
// Default (no flag) = LEGACY. This is a migration-safety default only; the
// architectural target is TEMPLATE. Nothing is switched implicitly — a business
// renders via templates only once explicitly set TEMPLATE/AUTO.
import { db } from "@/lib/db"

export type CommerceRendererMode = "LEGACY" | "TEMPLATE" | "AUTO"
export const COMMERCE_RENDERER_FLAG = "COMMERCE_RENDERER"
export const DEFAULT_RENDERER_MODE: CommerceRendererMode = "LEGACY"

const VALID = new Set<CommerceRendererMode>(["LEGACY", "TEMPLATE", "AUTO"])

export function coerceMode(v: unknown): CommerceRendererMode {
  const s = String(v || "").toUpperCase()
  return VALID.has(s as CommerceRendererMode) ? (s as CommerceRendererMode) : DEFAULT_RENDERER_MODE
}

export async function getCommerceRendererMode(businessId: string): Promise<CommerceRendererMode> {
  const flag = await db.featureFlag
    .findUnique({ where: { businessId_key: { businessId, key: COMMERCE_RENDERER_FLAG } }, select: { enabled: true, value: true } })
    .catch(() => null)
  if (!flag || !flag.enabled) return DEFAULT_RENDERER_MODE
  try {
    const parsed = JSON.parse(flag.value || "{}") as { mode?: string }
    return coerceMode(parsed.mode)
  } catch {
    return DEFAULT_RENDERER_MODE
  }
}

export async function setCommerceRendererMode(
  businessId: string,
  mode: CommerceRendererMode,
  updatedBy?: string | null,
): Promise<CommerceRendererMode> {
  const coerced = coerceMode(mode)
  const value = JSON.stringify({ mode: coerced, updatedBy: updatedBy || null, updatedAt: new Date().toISOString() })
  await db.featureFlag.upsert({
    where: { businessId_key: { businessId, key: COMMERCE_RENDERER_FLAG } },
    update: { enabled: true, value },
    create: { businessId, key: COMMERCE_RENDERER_FLAG, enabled: true, value, note: "Commerce storefront renderer mode (Phase 3)" },
  })
  return coerced
}
