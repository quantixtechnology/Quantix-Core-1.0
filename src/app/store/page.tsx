// Product-aware Store Admin entry. store.<tenant> is rewritten here by the proxy;
// we resolve the tenant's product and render the matching workspace's Store Admin
// app. Laundry keeps its existing app; Commerce gets its own — one host, one
// tenant pipeline, no duplicate routing.
import { resolveStoreHostTenant } from "@/lib/store-host"
import LaundryStoreApp from "@/app/laundry/store/page"
import { CommerceStoreApp } from "@/components/commerce/store/commerce-store-app"

export const dynamic = "force-dynamic"

export default async function StorePage() {
  const t = await resolveStoreHostTenant().catch(() => null)
  if (t?.productCode === "COMMERCE") {
    return <CommerceStoreApp tenant={{ platformBusinessId: t.platformBusinessId, name: t.name, logo: t.logo, primaryColor: t.primaryColor }} />
  }
  // Laundry (or unresolved): the existing, verified Laundry Store Admin PWA.
  return <LaundryStoreApp />
}
