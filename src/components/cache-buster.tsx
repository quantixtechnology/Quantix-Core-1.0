"use client"

// CacheBuster — runs on every page load.
// 1. Registers the service worker.
// 2. Fetches /api/debug/runtime-version to get the current build ID.
// 3. Compares with the build ID stored in localStorage.
// 4. On mismatch (= new deploy): wipes all caches, unregisters old SWs, reloads.
// 5. Sends buildId to the SW so it names its cache correctly.

import { useEffect } from "react"

const BUILD_KEY = "quantix_build_id"
// Set once a reload has been spent, so a loop cannot outlive the tab.
const RELOADED_KEY = "quantix_cache_reloaded"
// Build id sources, in order. The debug route carries the real build id but is
// platform-admin gated, so for every ordinary visitor — including every
// delivery executive and store user — it answers 401. /api/build-info is public
// and now exposes the same stable buildId.
//
// It must be an IDENTIFIER, not a timestamp: /api/build-info also returns
// `buildTime`, which is the time of the request. Comparing that against a
// stored copy makes every single page load look like a new deploy, which
// clears caches and reloads — forever.
const VERSION_URL = "/api/debug/runtime-version"
const PUBLIC_VERSION_URL = "/api/build-info"

/** The current build id, or null when neither endpoint will say. */
async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      if (json?.data?.buildId) return json.data.buildId
    }
  } catch { /* fall through to the public endpoint */ }
  try {
    const res = await fetch(PUBLIC_VERSION_URL, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      if (json?.buildId) return json.buildId
    }
  } catch { /* no build id available */ }
  return null
}

async function clearAllCaches() {
  // Unregister all service workers
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
  }

  // Delete all Cache Storage entries
  if ("caches" in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }

  // Clear session storage
  try { sessionStorage.clear() } catch { /* ignore */ }
}

async function registerSW(buildId: string) {
  if (!("serviceWorker" in navigator)) return
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    // Tell SW its build ID so it can name its cache correctly
    const target = reg.installing || reg.waiting || reg.active
    const send = (sw: ServiceWorker) => sw.postMessage({ type: "SET_BUILD_ID", buildId })
    if (target) {
      send(target)
    } else {
      navigator.serviceWorker.ready.then((r) => {
        if (r.active) send(r.active)
      })
    }
  } catch (err) {
    console.warn("[CacheBuster] SW registration failed:", err)
  }
}

export function CacheBuster() {
  useEffect(() => {
    const run = async () => {
      try {
        // THE BUG THIS FIXES: this used to `return` when the version endpoint
        // was not ok. That endpoint is platform-admin gated, so it answered 401
        // for every real user and the service worker below was never reached —
        // the Delivery and Store PWAs shipped with no service worker at all,
        // and therefore no offline capability.
        //
        // Registering the worker is core app capability. It must not depend on
        // a diagnostics endpoint answering, so it now happens either way.
        const serverBuild: string | null = await fetchBuildId()
        const localBuild = localStorage.getItem(BUILD_KEY)

        if (process.env.NODE_ENV === "development") {
          console.log(`[CacheBuster] build: server=${serverBuild} local=${localBuild ?? "none"}`)
        }

        if (serverBuild && localBuild && localBuild !== serverBuild) {
          // One reload per tab, ever. If the build id is somehow unstable, the
          // page reloads once and then stops instead of flickering forever —
          // the user still sees the app, just with a stale cache.
          const alreadyReloaded = sessionStorage.getItem(RELOADED_KEY)
          localStorage.setItem(BUILD_KEY, serverBuild)
          if (!alreadyReloaded) {
            console.log(`[CacheBuster] New deploy detected (${localBuild} → ${serverBuild}). Clearing caches and reloading...`)
            await clearAllCaches()
            // AFTER the wipe — clearAllCaches() calls sessionStorage.clear(),
            // which would erase the very flag that stops a second reload.
            try { sessionStorage.setItem(RELOADED_KEY, "1") } catch { /* ignore */ }
            window.location.reload()
            return
          }
          console.warn("[CacheBuster] build id changed again this session — not reloading twice.")
        }

        // First visit — remember the build we are running.
        if (serverBuild && !localBuild) {
          localStorage.setItem(BUILD_KEY, serverBuild)
        }

        // Register / update the service worker. Unconditional: an unknown build
        // id costs a less precise cache name, while skipping this costs the
        // whole PWA.
        await registerSW(serverBuild ?? "unknown")
      } catch {
        // Non-blocking — never break the app
      }
    }

    run()
  }, [])

  return null
}
