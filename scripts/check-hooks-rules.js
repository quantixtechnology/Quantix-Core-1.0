#!/usr/bin/env node
/* eslint-disable */
// ============================================================================
// QUANTIX CORE — Conditional Hook Guard
//
// Runs as a step of `npm run build`. Fails the build (exit 1) if any component
// calls a React hook conditionally — in practice, a hook placed AFTER an early
// return.
//
// WHY: this shipped to production three times in one week, and each time it
// looked like a different bug.
//
//     View Order      useScanSink below `if (loading) return`. Render 1 returns
//                     early and skips the hook; the loaded order crosses the
//                     guard and calls one hook MORE.
//                       -> "Rendered more hooks than during the previous render"
//                       -> broke ONLY when the API succeeded.
//
//     Packing & QR    useScanSink below `if (tab === "history")`. Pending runs
//                     the hook; clicking History returns early and calls one
//                     hook FEWER.
//                       -> "Rendered fewer hooks than expected"
//                       -> broke on a tab click.
//
//     User Menu       useRuntimeAuth below `if (!user) return null`.
//
// All three threw during RENDER, so React unwound to the nearest boundary — the
// one wrapping the entire Laundry workspace with view="business". Every one of
// them therefore surfaced as "We encountered an error loading your business
// data", pointing the investigation at an API that had already returned valid
// data. Loud and local at build time beats disguised and global at runtime.
//
// ─── THE GUARD MUST NOT BE ABLE TO BREAK THE BUILD ──────────────────────────
//
// The first version of this script did exactly that. It ran ESLint in-process,
// with the full Next.js config, over all of src — 1.3 GB peak — immediately
// before `next build` on a VPS that caps the heap at 1536 MB. The deploy failed
// at prebuild. Build-then-swap discarded the release and production stayed up,
// but the deploy was lost, and no try/catch can catch an OOM kill.
//
// Three things keep that from recurring:
//
//   1. A CHILD PROCESS does the linting. If it dies for any reason at all —
//      OOM, SIGKILL, a missing module, a broken config — the parent reports a
//      skip and the build continues. Only a clean run reporting real violations
//      can fail the build.
//   2. A MINIMAL CONFIG: the TypeScript parser and this one rule, nothing else.
//      That is ~790 MB instead of ~1.3 GB. It does mean this does not inherit
//      eslint.config.mjs — acceptable for a single syntactic rule that needs no
//      type information, and the fallbacks cover the plugin going missing.
//   3. ONLY FILES CONTAINING HOOK CALLS are linted (~370 of ~1550).
//
// This guard only reads and lints source files. It does not modify code.
// ============================================================================

const fs = require('fs')
const path = require('path')

const RULE = 'react-hooks/rules-of-hooks'
const SRC = path.join(process.cwd(), 'src')
const BATCH = 40
const HOOK_CALL = /\buse[A-Z][A-Za-z0-9_]*\s*\(/
const CHILD_HEAP_MB = 900

/** Every .ts/.tsx under src that actually calls a hook. */
function hookFiles(dir, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { hookFiles(full, out); continue }
    if (!/\.tsx?$/.test(e.name) || e.name.endsWith('.d.ts')) continue
    try {
      if (HOOK_CALL.test(fs.readFileSync(full, 'utf8'))) out.push(full)
    } catch { /* unreadable file — nothing to check */ }
  }
  return out
}

// ─── WORKER ─────────────────────────────────────────────────────────────────
// Prints {"violations":[...]} on stdout and exits 0, or exits non-zero. It is
// never the one to decide the build's fate.
async function worker() {
  const { ESLint } = require('eslint')
  const eslint = new ESLint({
    overrideConfigFile: true, // deliberately NOT eslint.config.mjs — see header
    overrideConfig: [{
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      },
      plugins: { 'react-hooks': require('eslint-plugin-react-hooks') },
      rules: { [RULE]: 'error' },
    }],
    errorOnUnmatchedPattern: false,
  })

  const files = hookFiles(SRC)
  const violations = []
  for (let i = 0; i < files.length; i += BATCH) {
    for (const file of await eslint.lintFiles(files.slice(i, i + BATCH))) {
      for (const msg of file.messages) {
        if (msg.ruleId !== RULE) continue
        violations.push({
          file: file.filePath.replace(process.cwd() + path.sep, ''),
          line: msg.line,
          column: msg.column,
          message: msg.message,
        })
      }
    }
  }
  process.stdout.write(JSON.stringify({ checked: files.length, violations }))
}

// ─── PARENT ─────────────────────────────────────────────────────────────────
function skip(reason) {
  console.warn(`\n[hooks-guard] SKIPPED — ${reason}`)
  console.warn('[hooks-guard] The build continues. Run `npm run check:hooks` locally to restore the check.\n')
  process.exit(0)
}

function report({ checked, violations }) {
  if (violations.length === 0) {
    console.log(`✓ Hook guard: no conditional hooks (${checked} files with hooks checked)`)
    process.exit(0)
  }
  console.error('\n' + '='.repeat(78))
  console.error(`BUILD FAILED — ${violations.length} conditional React hook${violations.length === 1 ? '' : 's'}`)
  console.error('='.repeat(78) + '\n')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.column}`)
    console.error(`    ${v.message}\n`)
  }
  console.error('A hook called after an early return changes the hook count between')
  console.error('renders, and React throws DURING RENDER. In this app that throw unwinds')
  console.error('to the workspace error boundary and is displayed as:')
  console.error('')
  console.error('    "We encountered an error loading your business data."')
  console.error('')
  console.error('FIX: move the hook call ABOVE every early return, with the other hooks.')
  console.error('Hook callbacks are read through refs, so binding one earlier still sees')
  console.error('the latest state.\n')
  process.exit(1)
}

function parent() {
  const { spawn } = require('child_process')
  const child = spawn(
    process.execPath,
    [`--max-old-space-size=${CHILD_HEAP_MB}`, __filename, '--worker'],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let out = '', err = ''
  child.stdout.on('data', (d) => { out += d })
  child.stderr.on('data', (d) => { err += d })
  child.on('error', (e) => skip(`could not start the lint worker: ${e && e.message}`))
  child.on('close', (code, signal) => {
    if (signal) return skip(`lint worker killed by ${signal} (out of memory?)`)
    if (code !== 0) {
      // FIRST line: for a missing module that is "Cannot find module 'x'", where
      // the remaining lines are just the require stack.
      const why = (err.trim().split('\n')[0] || `exit ${code}`).slice(0, 200)
      return skip(`lint worker failed — ${why}`)
    }
    let parsed
    try { parsed = JSON.parse(out) } catch { return skip('lint worker produced no readable result') }
    report(parsed)
  })
}

if (process.argv.includes('--worker')) {
  worker().catch((e) => { console.error(e && e.message); process.exit(1) })
} else {
  parent()
}
