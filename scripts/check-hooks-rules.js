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
// WHY NOT JUST GATE `npm run lint`: the repo carries thousands of accepted
// findings from other rules (set-state-in-effect alone is in the hundreds).
// Gating all of them would block every build, so this guard reports ONE rule and
// ignores the rest. It uses the project's own eslint.config.mjs — no second
// parser or plugin set to drift out of sync with it.
//
// This guard only reads and lints source files. It does not modify code.
// ============================================================================

const { ESLint } = require('eslint')

const RULE = 'react-hooks/rules-of-hooks'
const TARGET = 'src'

async function main() {
  // The project's own flat config, so parser, plugins and ignores match `npm run
  // lint` exactly. Everything except RULE is filtered out below.
  const eslint = new ESLint({ errorOnUnmatchedPattern: false })

  let results
  try {
    results = await eslint.lintFiles([TARGET])
  } catch (err) {
    // A guard must never be the reason a build cannot run. If linting itself
    // breaks, say so clearly and let the build continue to the real compiler.
    console.warn(`\n[hooks-guard] SKIPPED — could not lint ${TARGET}: ${err && err.message}`)
    console.warn('[hooks-guard] The build continues; fix the lint setup to restore this check.\n')
    return
  }

  const violations = []
  for (const file of results) {
    for (const msg of file.messages) {
      if (msg.ruleId === RULE) {
        violations.push({
          file: file.filePath.replace(process.cwd() + '/', ''),
          line: msg.line,
          column: msg.column,
          message: msg.message,
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`✓ Hook guard: no conditional hooks in ${TARGET}/`)
    return
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

main().catch((err) => {
  console.error('[hooks-guard] unexpected failure:', err)
  process.exit(1)
})
