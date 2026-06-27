#!/usr/bin/env node
/* eslint-disable */
// ============================================================================
// QUANTIX CORE — Route Conflict Guard
//
// Runs as the FIRST step of `npm run build`. Fails the build (exit 1) if any
// directory under src/app contains sibling dynamic segments that use different
// parameter (slug) names — e.g. `[id]` next to `[businessId]`.
//
// WHY: Next.js throws at runtime, on EVERY request, when two dynamic segments
// at the same path level use different slug names:
//
//     Error: You cannot use different slug names for the same dynamic
//            path ('businessId' !== 'id').
//
// This poisons the entire route tree (not just the offending route) and returns
// a framework-level 500 for all endpoints — which previously broke production
// deployment by taking down GET /api/deploy/status (the endpoint GitHub Actions
// polls). Catching it here makes the failure loud and local, at build time,
// instead of silent and global, at runtime.
//
// This guard ONLY inspects the filesystem layout of routes. It does not import,
// execute, or modify any application code, business logic, or configuration.
// ============================================================================

const fs = require('fs')
const path = require('path')

const APP_DIR = path.join(process.cwd(), 'src', 'app')

// Matches a dynamic route segment directory and extracts its slug name:
//   [id]            -> { name: 'id',   kind: 'dynamic' }
//   [...path]       -> { name: 'path', kind: 'catch-all' }
//   [[...slug]]     -> { name: 'slug', kind: 'optional-catch-all' }
function parseDynamicSegment(dirName) {
  let m = dirName.match(/^\[\[\.\.\.([A-Za-z0-9_]+)\]\]$/)
  if (m) return { name: m[1], kind: 'optional-catch-all' }
  m = dirName.match(/^\[\.\.\.([A-Za-z0-9_]+)\]$/)
  if (m) return { name: m[1], kind: 'catch-all' }
  m = dirName.match(/^\[([A-Za-z0-9_]+)\]$/)
  if (m) return { name: m[1], kind: 'dynamic' }
  return null // not a dynamic segment (static dir, route group, slot, etc.)
}

const conflicts = []

function walk(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  const dynamicChildren = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const seg = parseDynamicSegment(entry.name)
    if (seg) {
      dynamicChildren.push({ dir: entry.name, ...seg })
    }
    walk(path.join(dir, entry.name))
  }

  // A given parent may have at most ONE distinct dynamic slug name across all
  // of its dynamic children. More than one === the build-breaking conflict.
  if (dynamicChildren.length > 1) {
    const distinctNames = [...new Set(dynamicChildren.map((c) => c.name))]
    if (distinctNames.length > 1) {
      conflicts.push({
        parent: path.relative(process.cwd(), dir),
        children: dynamicChildren,
        names: distinctNames,
      })
    }
  }
}

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.log(`[route-guard] No src/app directory at ${APP_DIR} — skipping.`)
    return
  }

  walk(APP_DIR)

  if (conflicts.length === 0) {
    console.log('[route-guard] ✓ No dynamic route slug conflicts found.')
    return
  }

  console.error('')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error('  ✗ ROUTE CONFLICT GUARD FAILED — build aborted')
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.error('')
  console.error('  Sibling dynamic routes must use the SAME parameter name.')
  console.error('  Next.js fails the entire route tree otherwise (runtime 500 on')
  console.error('  every endpoint). Fix by renaming the folders to one slug name.')
  console.error('')
  for (const c of conflicts) {
    console.error(`  Conflict in: ${c.parent}/`)
    console.error(`    Differing slug names: ${c.names.map((n) => `[${n}]`).join('  vs  ')}`)
    for (const child of c.children) {
      console.error(`      - ${c.parent}/${child.dir}   (${child.kind})`)
    }
    console.error('')
  }
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(1)
}

main()
