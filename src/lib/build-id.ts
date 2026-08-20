// THE build identifier for this deployment.
//
// It is the Next.js build hash from .next/BUILD_ID: one value for the life of a
// release, a new one on the next deploy. That property is the whole point — a
// "version" that changes per request is not a version, and anything comparing
// it against a stored copy will conclude, every single time, that the client is
// stale.
//
// Read once and memoised: the file cannot change under a running server.
import { readFileSync } from "fs"
import { join } from "path"

let cached: string | null = null

export function getBuildId(): string {
  if (cached) return cached
  const candidates = [
    join(process.cwd(), ".next", "BUILD_ID"),
    join(process.cwd(), "BUILD_ID"),
    // Standalone output: server.js runs from .next/standalone, so cwd differs.
    join(__dirname, "..", "..", "..", "..", ".next", "BUILD_ID"),
  ]
  for (const p of candidates) {
    try {
      const id = readFileSync(p, "utf8").trim()
      if (id) {
        cached = id
        return cached
      }
    } catch { /* try the next candidate */ }
  }
  cached = "dev"
  return cached
}
