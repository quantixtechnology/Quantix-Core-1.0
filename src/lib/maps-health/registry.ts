// ============================================================================
// QUANTIX CORE — Google Maps Platform Health Monitor (registry)
//
// The pluggable framework: checks self-register, the runner executes them, and
// the report aggregates the results. Future integrations (Routes API, Distance
// Matrix, Static Maps, Street View, Places API New…) add a file under checks/
// that imports `registerHealthCheck` — nothing else changes.
// ============================================================================

import type { HealthCheck, HealthCheckContext, MapsHealthReport } from "./types"

const registry: HealthCheck[] = []

export function registerHealthCheck(check: HealthCheck): void {
  registry.push(check)
}

export function listRegisteredChecks(): HealthCheck[] {
  return registry
}

export async function runAllChecks(ctx: HealthCheckContext) {
  const checks = listRegisteredChecks()
  const results = await Promise.all(
    checks.map(async (check) => {
      const start = Date.now()
      try {
        const result = await check.run(ctx)
        return { ...result, durationMs: Date.now() - start }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Check failed"
        return {
          id: check.id,
          label: check.label,
          status: "error" as const,
          summary: "Failed",
          detail: message,
          googleErrorMessage: message,
          apiName: check.apiName,
          docsLink: check.docsLink,
          durationMs: Date.now() - start,
        }
      }
    }),
  )
  return results
}

export function summarizeReport(report: Pick<MapsHealthReport, "checks">) {
  const summary = { total: 0, healthy: 0, warning: 0, error: 0, skipped: 0 }
  for (const c of report.checks) {
    summary.total += 1
    summary[c.status] += 1
  }
  return summary
}
