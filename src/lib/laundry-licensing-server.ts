// Licensing, resolved against the database.
//
// Split from laundry-licensing.ts so the rules stay pure and client-safe (the
// module selector and the sidebar import those directly) while anything that
// touches prisma lives here.

import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import {
  buildLicence, normalizeRows, rowsForSelection, licensableCatalog,
  FEATURE_NOT_ENABLED, type Licence,
} from "@/lib/laundry-licensing"

/** The tenant's licence. Never throws — an unreadable row set falls back to defaults. */
export async function resolveLicence(laundryBusinessId: string): Promise<Licence> {
  const rows = await prisma.laundryBusinessFeature
    .findMany({ where: { businessId: laundryBusinessId }, select: { featureKey: true, enabled: true } })
    .catch(() => [])
  return buildLicence(normalizeRows(rows))
}

export async function resolveLicenceForBusiness(businessId: string | null | undefined): Promise<{ laundryBusinessId: string; licence: Licence } | null> {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return null
  return { laundryBusinessId: biz.id, licence: await resolveLicence(biz.id) }
}

/**
 * API guard. A disabled module must refuse a direct call, not merely vanish
 * from the sidebar — hiding a link is presentation, not authorisation.
 *
 *   const gate = await requireLicensedScreen(businessId, "crm.leads")
 *   if (!gate.ok) return gate.res
 */
export async function requireLicensedScreen(
  businessId: string | null | undefined,
  screenKey: string,
): Promise<{ ok: true; laundryBusinessId: string; licence: Licence } | { ok: false; res: NextResponse }> {
  const resolved = await resolveLicenceForBusiness(businessId)
  if (!resolved) {
    return { ok: false, res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  }
  if (!resolved.licence.isScreenEnabled(screenKey)) {
    return {
      ok: false,
      res: NextResponse.json({ error: FEATURE_NOT_ENABLED, code: "FEATURE_NOT_ENABLED", screenKey }, { status: 403 }),
    }
  }
  return { ok: true, laundryBusinessId: resolved.laundryBusinessId, licence: resolved.licence }
}

/**
 * Persist a whole selection in one transaction.
 *
 * Deliberately a full rewrite of every catalog key rather than a patch: a
 * partial write leaves rows the administrator never saw, and those decide
 * access later. Nothing else is touched, so DISABLING A MODULE NEVER DELETES
 * DATA — re-enabling it brings the tenant's orders, leads and history back
 * exactly as they were.
 */
export async function saveLicence(laundryBusinessId: string, selectedScreenKeys: string[]): Promise<void> {
  const rows = rowsForSelection(new Set(selectedScreenKeys))
  await prisma.$transaction(
    rows.map((r) =>
      prisma.laundryBusinessFeature.upsert({
        where: { businessId_featureKey: { businessId: laundryBusinessId, featureKey: r.featureKey } },
        update: { enabled: r.enabled },
        create: { businessId: laundryBusinessId, featureKey: r.featureKey, enabled: r.enabled },
      }),
    ),
  )
}

/** Catalog + current state, for the module selector and the licensing screen. */
export async function licenceSnapshot(laundryBusinessId: string) {
  const licence = await resolveLicence(laundryBusinessId)
  return {
    modules: licensableCatalog().map((m) => ({
      key: m.key,
      label: m.label,
      optIn: m.optIn,
      enabled: licence.isModuleEnabled(m.key),
      screens: m.screens.map((s) => ({ ...s, enabled: licence.isScreenEnabled(s.screenKey) })),
    })),
    enabledScreens: [...licence.enabledScreens()],
  }
}
