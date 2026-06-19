"use client"

// CacheBuster — runs on every page load.
// 1. Registers the service worker.
// 2. Fetches /api/debug/runtime-version to get the current build ID.
// 3. Compares with the build ID stored in localStorage.
// 4. On mismatch (= new deploy): wipes all caches, unregisters old SWs, reloads.
// 5. Sends buildId to the SW so it names its cache correctly.
//
// TEMPORARY BYPASS: set NEXT_PUBLIC_DISABLE_SW=true to skip SW registration
// and clear all caches. Remove the flag after incident investigation is
// resolved.

import { useEffect } from "react"

const BUILD_KEY = "quantix_build_id"
const VERSION_URL = "/api/debug/runtime-version"

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
      // TEMPORARY: if the feature flag is set, wipe all caches, unregister
      // existing service workers, and never register a new one.
      if (process.env.NEXT_PUBLIC_DISABLE_SW === "true") {
        if (process.env.NODE_ENV === "development") {
          console.log("[CacheBuster] DISABLE_SW flag is set — skipping SW registration")
        }
        await clearAllCaches()
        return
      }

      try {
        const res = await fetch(VERSION_URL, { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        const serverBuild: string = json?.data?.buildId || "unknown"
        const localBuild = localStorage.getItem(BUILD_KEY)

        if (process.env.NODE_ENV === "development") {
          console.log(`[CacheBuster] build: server=${serverBuild} local=${localBuild ?? "none"}`)
        }

        if (localBuild && localBuild !== serverBuild) {
          console.log(`[CacheBuster] New deploy detected (${localBuild} → ${serverBuild}). Clearing caches and reloading...`)
          await clearAllCaches()
          localStorage.setItem(BUILD_KEY, serverBuild)
          window.location.reload()
          return
        }

        // First visit — store build ID and register SW
        if (!localBuild) {
          localStorage.setItem(BUILD_KEY, serverBuild)
        }

        // Register / update service worker
        await registerSW(serverBuild)
      } catch {
        // Non-blocking — never break the app
      }
    }

    run()
  }, [])

  return null
}
