#!/usr/bin/env node
// ============================================================================
// Upload migration script
// Run once on the VPS after deploying the UPLOAD_ROOT change:
//
//   node scripts/migrate-uploads.js
//
// Copies files from OLD upload locations into UPLOAD_ROOT (/root/uploads).
// Old locations checked (in order):
//   1. /home/ubuntu/Quantix-Core-1.0/.next/standalone/public/uploads  (standalone cwd path)
//   2. /home/ubuntu/Quantix-Core-1.0/public/uploads                    (project public/ path)
//
// Safe to run multiple times — already-copied files are skipped.
// ============================================================================

const fs   = require('fs')
const path = require('path')

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/root/uploads'
const PROJECT     = '/home/ubuntu/Quantix-Core-1.0'

const OLD_PATHS = [
  path.join(PROJECT, '.next', 'standalone', 'public', 'uploads'),
  path.join(PROJECT, 'public', 'uploads'),
]

let copied = 0
let skipped = 0
let errors = 0

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    ensureDir(dest)
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    if (fs.existsSync(dest)) {
      // Skip if destination already exists and is the same size
      const destStat = fs.statSync(dest)
      if (destStat.size === stat.size) {
        skipped++
        return
      }
    }
    try {
      fs.copyFileSync(src, dest)
      console.log(`  copied: ${src.replace(PROJECT, '')} → ${dest}`)
      copied++
    } catch (e) {
      console.error(`  ERROR copying ${src}: ${e.message}`)
      errors++
    }
  }
}

console.log(`\nUpload migration`)
console.log(`  UPLOAD_ROOT = ${UPLOAD_ROOT}`)
console.log(`  Checking ${OLD_PATHS.length} old locations…\n`)

ensureDir(UPLOAD_ROOT)

for (const oldPath of OLD_PATHS) {
  if (!fs.existsSync(oldPath)) {
    console.log(`  [skip] not found: ${oldPath}`)
    continue
  }
  console.log(`  [migrate] ${oldPath} → ${UPLOAD_ROOT}`)
  copyTree(oldPath, UPLOAD_ROOT)
}

console.log(`\nDone. copied=${copied} skipped=${skipped} errors=${errors}`)
if (errors > 0) process.exit(1)
