// ============================================================================
// QUANTIX CORE — Google Maps Platform Health Monitor (runner)
//
// Orchestrates the full report: runs the pluggable check registry and flattens
// the DB-derived sections (store verification + serviceability samples) that the
// checks each surface onto the aggregate report.
// ============================================================================

import { runAllChecks, summarizeReport } from "./registry"
import "@/lib/maps-health/checks"
import type { MapsHealthReport, ServiceabilitySample, StoreHealthRow } from "./types"

export interface RunOptions {
  apiKey: string
  allowedOrigins: string[]
  requestOrigin?: string | null
  signal?: AbortSignal
}

/**
 * Run every registered check and assemble the aggregate report. The side-effect
 * import above registers all built-in checks once per process (Node module
 * caching makes it idempotent), so the registry is always populated here.
 */
export async function generateMapsHealthReport(opts: RunOptions): Promise<MapsHealthReport> {
  const checks = await runAllChecks({
    apiKey: opts.apiKey,
    allowedOrigins: opts.allowedOrigins,
    requestOrigin: opts.requestOrigin ?? null,
    signal: opts.signal,
  })

  // Extract the store rows and serviceability samples from the checks' data.
  const storeCheck = checks.find((c) => c.id === "store-gps")
  const storeData = (storeCheck?.data as { rows?: StoreHealthRow[] } | undefined) ?? {}
  const stores: StoreHealthRow[] = Array.isArray(storeData.rows) ? storeData.rows : []

  const svcCheck = checks.find((c) => c.id === "serviceability-engine")
  const svcData = (svcCheck?.data as { samples?: ServiceabilitySample[] } | undefined) ?? {}
  const serviceability: ServiceabilitySample[] = Array.isArray(svcData.samples) ? svcData.samples : []

  const summary = summarizeReport({ checks })

  return {
    generatedAt: new Date().toISOString(),
    keyConfigured: !!opts.apiKey && opts.apiKey.trim().length >= 10,
    checks,
    stores,
    serviceability,
    summary,
  }
}