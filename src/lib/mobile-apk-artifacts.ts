// ============================================================================
// The Android build that actually exists on this server.
//
// The Deployment rows carry whatever the mobile-provision pipeline last said,
// which is a URL on a service that may never have answered. A file under
// public/apks is different: it is the artifact scripts/build-tenant-apks.sh
// produced, sitting where the browser can fetch it. So a built file wins — a
// download button that hands over a real APK beats one pointing at a build
// service that is down.
//
// The tenant slug is part of the filename, which is also the isolation
// boundary: <slug>-<app>.apk. A caller resolved to one business can only ever
// name that business's builds.
// ============================================================================
import { existsSync } from "fs"
import { join } from "path"

export type ApkDeploymentType = "CUSTOMER_APP" | "DELIVERY_APP" | "ADMIN_APP"

/**
 * Deployment type → the app the builder produces.
 *
 * ADMIN_APP is the Store Admin card, which the builder calls `store` — the
 * names come from two different eras of the same three apps.
 */
export const APK_BUILD_KEY: Record<ApkDeploymentType, string> = {
  CUSTOMER_APP: "customer",
  DELIVERY_APP: "delivery",
  ADMIN_APP: "store",
}

/** Where the builder writes, and where the web server reads. */
export const APK_DIR = "apks"

/**
 * The public URL of a built APK, or null when that app has not been built for
 * this tenant. Existence is checked rather than assumed: offering a link to a
 * file that is not there is the failure this whole path exists to avoid.
 */
export function builtApkUrl(slug: string | null | undefined, type: ApkDeploymentType): string | null {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null
  const file = `${slug}-${APK_BUILD_KEY[type]}.apk`
  if (!existsSync(join(process.cwd(), "public", APK_DIR, file))) return null
  return `/${APK_DIR}/${file}`
}
