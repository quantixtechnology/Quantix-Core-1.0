// POST /api/laundry/businesses/[id]/provision-executive-host  (Super Admin only)
//
// Provisions the dedicated Executive PWA host delivery.<slug>.<base> using the
// EXISTING per-host provisioning engine (nginx vhost + Let's Encrypt SSL) — the
// same provisionProductHost() used for customer/product subdomains. No second
// provisioning engine. Idempotent (reuses an existing vhost/cert).
//
// PREREQUISITE (infra, not app): DNS for delivery.<slug>.<base> must resolve to
// this server so certbot's HTTP-01 challenge succeeds. The application code is
// identical across hosts — only DNS / vhost / cert change per the spec.
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { provisionProductHost } from "@/lib/product-host-provisioner"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

export const POST = withMiddleware({ requireAuth: true, requirePlatformAdmin: true })(
  async (_req, ctx) => {
    try {
      const params = await ctx?.params
      const id = params?.id as string | undefined
      if (!id) return json({ success: false, error: "Business id is required" }, 400)

      // Resolve the tenant slug (or live custom domain) → executive host.
      const lb = await db.laundryBusiness.findFirst({ where: { OR: [{ id }, { platformBusinessId: id }] }, select: { platformBusinessId: true } })
      if (!lb?.platformBusinessId) return json({ success: false, error: "Laundry business not found" }, 404)
      const business = await db.business.findUnique({ where: { id: lb.platformBusinessId }, select: { slug: true, domain: { select: { domain: true, status: true } } } })
      const base = business?.domain?.status === "ACTIVE" ? business.domain.domain : (business?.slug ? `${business.slug}.${SF_BASE}` : null)
      if (!base) return json({ success: false, error: "Business has no slug or mapped domain" }, 400)
      const host = `delivery.${base}`

      const result = await provisionProductHost(host)
      return json({ success: true, host, nginx: result.nginx, ssl: result.ssl })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Provisioning failed"
      return json({ success: false, error: message }, 500)
    }
  },
)
