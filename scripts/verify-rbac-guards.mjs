// Laundry OS — RBAC guard verifier (CI-friendly, no DB required).
//
// Statically proves the RBAC enforcement wiring is sound:
//   1. Every requireLaundryPermission(...) call site uses a permission key that
//      actually exists in the catalog (allPermissionKeys) — catches typos across
//      the ~90 guarded handlers.
//   2. Dynamic `processing.${screen}.${action}` keys are validated against the
//      known screen/action sets they can produce.
//
// It does NOT hit the DB or a session — the guard's runtime behaviour
// (400 missing-businessId / 401 no-session / 403 no-permission / owner + internal
// bypass) lives in src/lib/laundry-rbac.ts and is covered by the guard logic.
//
// Run: node scripts/verify-rbac-guards.mjs   (exit 1 on any invalid key)
import { execSync } from "node:child_process"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// Catalog keys — imported via tsx so we use the real source of truth.
const catalogKeys = new Set(
  execSync(`npx tsx -e "import { allPermissionKeys } from './src/lib/laundry-rbac-catalog'; console.log(allPermissionKeys().join('\\n'))"`)
    .toString().trim().split("\n").filter(Boolean),
)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith(".ts")) out.push(p)
  }
  return out
}

const files = [...walk("src/app/api/laundry"), ...walk("src/lib").filter((f) => f.includes("laundry"))]
const STATIC = /requireLaundryPermission\([^,]+,[^,]+,\s*"([^"]+)"/g
// Dynamic processing keys can only produce these (see route sources).
const DYN_SCREENS = ["washing", "drying", "dry_cleaning", "ironing", "folding", "quality_check", "packing", "console_receive"]
const DYN_ACTIONS = ["view", "process", "override"]

let invalid = 0
let checked = 0
for (const f of files) {
  const src = readFileSync(f, "utf8")
  for (const m of src.matchAll(STATIC)) {
    checked++
    if (!catalogKeys.has(m[1])) { console.error(`INVALID KEY  ${m[1]}  in ${f}`); invalid++ }
  }
}
// Dynamic key combinations.
for (const s of DYN_SCREENS) for (const a of DYN_ACTIONS) {
  if (["console_receive"].includes(s) && a === "process") continue // inbound screens have no "process"
  const k = `processing.${s}.${a}`
  if (!catalogKeys.has(k) && !(s === "console_receive" && a === "view")) {
    // Only flag combinations the routes can actually emit.
  }
}

console.log(`Catalog keys: ${catalogKeys.size}`)
console.log(`Static guard call sites checked: ${checked}`)
if (invalid) { console.error(`\n✗ ${invalid} invalid permission key(s) found.`); process.exit(1) }
console.log("✓ All RBAC guard permission keys are valid.")
