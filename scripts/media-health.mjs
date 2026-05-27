#!/usr/bin/env node
// ============================================================================
// Media Health Check — Quantix Core
//
// Scans all media references in the database, verifies files exist on disk,
// and generates a JSON report at /root/logs/media-health-report.json
//
// Usage (run from project root):
//   node scripts/media-health.mjs
//
// Cron (nightly at 2am):
//   0 2 * * * cd /root/Quantix-Core-1.0 && node scripts/media-health.mjs >> /root/logs/media-health-cron.log 2>&1
// ============================================================================

import { PrismaClient } from '@prisma/client'
import { existsSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? '/var/www/uploads'
const REPORT_DIR  = '/root/logs'
const REPORT_PATH = join(REPORT_DIR, 'media-health-report.json')

const db = new PrismaClient()

// Strip /uploads/ prefix to get the path relative to UPLOAD_ROOT
function toRelativePath(url) {
  if (!url) return null
  if (url.startsWith('/uploads/'))       return url.slice('/uploads/'.length)
  if (url.startsWith('/api/core/files/')) return url.slice('/api/core/files/'.length)
  return null
}

function checkFile(url) {
  const rel = toRelativePath(url)
  if (!rel) return { status: 'skipped', reason: 'not a managed path', url }

  const abs = resolve(join(UPLOAD_ROOT, rel))
  if (!abs.startsWith(resolve(UPLOAD_ROOT))) {
    return { status: 'skipped', reason: 'path traversal detected', url }
  }

  if (!existsSync(abs)) return { status: 'missing', path: abs, url }

  try {
    const st = statSync(abs)
    if (st.size === 0) return { status: 'empty', path: abs, url }
    return { status: 'ok', path: abs, size: st.size, url }
  } catch {
    return { status: 'unreadable', path: abs, url }
  }
}

async function run() {
  console.log(`[media-health] UPLOAD_ROOT=${UPLOAD_ROOT}`)
  console.log(`[media-health] started at ${new Date().toISOString()}`)

  const results = { ok: [], missing: [], empty: [], unreadable: [], skipped: [] }
  const errors  = []

  // ── Products ────────────────────────────────────────────────────────────────
  try {
    const products = await db.product.findMany({ select: { id: true, name: true, images: true } })
    for (const p of products) {
      let imgs = []
      try { imgs = JSON.parse(p.images || '[]') } catch { /* ignore */ }
      for (const img of imgs) {
        const r = checkFile(img)
        ;(results[r.status] ??= []).push({ entity: 'product', id: p.id, name: p.name, ...r })
      }
    }
    console.log(`[media-health] scanned ${products.length} products`)
  } catch (e) {
    errors.push({ entity: 'products', error: e.message })
  }

  // ── Categories ──────────────────────────────────────────────────────────────
  try {
    const categories = await db.category.findMany({ select: { id: true, name: true, image: true } })
    for (const c of categories) {
      if (!c.image) continue
      const r = checkFile(c.image)
      ;(results[r.status] ??= []).push({ entity: 'category', id: c.id, name: c.name, ...r })
    }
    console.log(`[media-health] scanned ${categories.length} categories`)
  } catch (e) {
    errors.push({ entity: 'categories', error: e.message })
  }

  // ── Businesses (logo + favicon) ──────────────────────────────────────────────
  try {
    const businesses = await db.business.findMany({ select: { id: true, name: true, logo: true, favicon: true } })
    for (const b of businesses) {
      for (const [field, url] of [['logo', b.logo], ['favicon', b.favicon]]) {
        if (!url) continue
        const r = checkFile(url)
        ;(results[r.status] ??= []).push({ entity: 'business', field, id: b.id, name: b.name, ...r })
      }
    }
    console.log(`[media-health] scanned ${businesses.length} businesses`)
  } catch (e) {
    errors.push({ entity: 'businesses', error: e.message })
  }

  // ── Banners ─────────────────────────────────────────────────────────────────
  try {
    const banners = await db.banner.findMany({ select: { id: true, title: true, imageUrl: true } })
    for (const b of banners) {
      if (!b.imageUrl) continue
      const r = checkFile(b.imageUrl)
      ;(results[r.status] ??= []).push({ entity: 'banner', id: b.id, name: b.title, ...r })
    }
    console.log(`[media-health] scanned ${banners.length} banners`)
  } catch (e) {
    errors.push({ entity: 'banners', error: e.message })
  }

  const summary = {
    generatedAt:  new Date().toISOString(),
    uploadRoot:   UPLOAD_ROOT,
    totals: {
      ok:          results.ok?.length         ?? 0,
      missing:     results.missing?.length    ?? 0,
      empty:       results.empty?.length      ?? 0,
      unreadable:  results.unreadable?.length ?? 0,
      skipped:     results.skipped?.length    ?? 0,
    },
    errors,
    missing:    results.missing    ?? [],
    empty:      results.empty      ?? [],
    unreadable: results.unreadable ?? [],
  }

  try {
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2))
    console.log(`[media-health] report written to ${REPORT_PATH}`)
  } catch (e) {
    console.error('[media-health] could not write report file:', e.message)
    console.log(JSON.stringify(summary, null, 2))
  }

  const { ok, missing, empty, unreadable } = summary.totals
  console.log(`[media-health] SUMMARY  ok=${ok}  missing=${missing}  empty=${empty}  unreadable=${unreadable}`)

  if (missing > 0) {
    console.warn(`[media-health] ⚠️  ${missing} missing file(s) — check ${REPORT_PATH}`)
  }

  await db.$disconnect()
  process.exit(missing + empty + unreadable > 0 ? 1 : 0)
}

run().catch(e => {
  console.error('[media-health] fatal:', e)
  process.exit(2)
})
