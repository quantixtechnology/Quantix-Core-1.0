// ============================================================================
// POST /api/admin/products/[id]/provision-host   ([id] = product CODE)
//
// Provision the production infrastructure (Nginx vhost + Let's Encrypt SSL) for
// a product's permanent workspace subdomain — e.g. commerce.quantixtechnology.in.
// Super Admin only. Idempotent: safe to re-run; reuses an existing cert/vhost.
//
// The product host is read from the Product Registry (workspaceUrl) — never
// hardcoded. On success the product is marked deploymentMode = SUBDOMAIN so the
// rest of the platform treats it as subdomain-served.
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'
import { ProductRuntimeRegistry } from '@/lib/product-runtime-registry'
import { provisionProductHost, workspaceUrlToHost } from '@/lib/product-host-provisioner'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export const POST = withMiddleware({ requireAuth: true, requirePlatformAdmin: true })(
  async (req, ctx) => {
    try {
      const params = await ctx?.params
      // Sibling dynamic segments under /products must share the slug name `[id]`;
      // like the other product routes, the value here is the product CODE.
      const code = (params?.id as string | undefined)?.toUpperCase()
      if (!code) return json({ success: false, error: 'Product code is required' }, 400)

      const runtime = await ProductRuntimeRegistry.getRuntime(code)
      if (!runtime) return json({ success: false, error: `Product ${code} not found` }, 404)

      const host = workspaceUrlToHost(runtime.workspaceUrl)
      if (!host || !host.includes('.')) {
        return json({ success: false, error: `Product ${code} has an invalid workspaceUrl: "${runtime.workspaceUrl}"` }, 400)
      }

      // Observability only — must never affect provisioning. Open a RUNNING log
      // entry, then update it with the outcome. All log I/O is best-effort.
      const user = (req as { user?: { id?: string; email?: string } }).user
      const requestedBy = user?.email || user?.id || null
      const startedAt = Date.now()
      let logId: string | null = null
      try {
        const entry = await db.productHostProvisioningLog.create({
          data: { productCode: code, hostname: host, requestedBy, status: 'RUNNING' },
        })
        logId = entry.id
      } catch { /* logging is non-fatal */ }

      // ── Provisioning logic is unchanged ──────────────────────────────────
      const result = await provisionProductHost(host)

      // Mark the product as subdomain-served once the host has a vhost + cert.
      if (result.ssl === 'issued' || result.ssl === 'existing') {
        await db.platformProduct.update({
          where: { code },
          data: {
            deploymentMode: 'SUBDOMAIN',
            deploymentStatus: result.httpsReachable ? 'READY' : 'DEPLOYING',
            lastDeploymentAt: result.httpsReachable ? new Date() : undefined,
          },
        })
      }

      // Persist the outcome (best-effort).
      try {
        const data = {
          status: result.error === null ? 'SUCCESS' : 'FAILED',
          nginxStatus: result.nginx,
          certbotStatus: result.ssl,
          nginxReloadStatus: result.reload,
          httpsReachable: result.httpsReachable,
          success: result.error === null,
          errorMessage: result.error,
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        }
        if (logId) await db.productHostProvisioningLog.update({ where: { id: logId }, data })
        else await db.productHostProvisioningLog.create({ data: { productCode: code, hostname: host, requestedBy, startedAt: new Date(startedAt), ...data } })
      } catch { /* logging is non-fatal */ }

      return json({
        success: result.error === null,
        data: { productCode: code, ...result },
        ...(result.error ? { error: result.error } : {}),
      }, result.error ? 502 : 200)
    } catch (error) {
      return json({ success: false, error: error instanceof Error ? error.message : 'Failed to provision product host' }, 500)
    }
  },
)
