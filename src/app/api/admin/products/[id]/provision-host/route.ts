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
