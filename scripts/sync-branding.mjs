#!/usr/bin/env node
// ============================================================================
// Branding Sync — Quantix Core
//
// Copies BusinessBranding.logo / .favicon to Business.logo / .favicon
// for every business where Business.logo or .favicon is null but
// BusinessBranding has a value.
//
// Also reports any businesses with both fields still null after sync so
// you know which ones need logos re-uploaded.
//
// Usage (run from project root on VPS):
//   node scripts/sync-branding.mjs
//
// Safe to re-run — only writes when Business field is null and BusinessBranding
// has a non-null value.
// ============================================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function run() {
  console.log('[sync-branding] starting…')

  const businesses = await db.business.findMany({
    select: {
      id: true,
      name: true,
      logo: true,
      favicon: true,
      branding: { select: { logo: true, favicon: true } },
    },
  })

  console.log(`[sync-branding] found ${businesses.length} businesses`)

  let synced = 0
  let alreadySet = 0
  let noData = 0

  for (const biz of businesses) {
    const needsLogo    = !biz.logo    && biz.branding?.logo
    const needsFavicon = !biz.favicon && biz.branding?.favicon

    if (!needsLogo && !needsFavicon) {
      if (biz.logo || biz.favicon) alreadySet++
      else noData++
      if (!biz.logo && !biz.favicon) {
        console.log(`  [NO DATA] ${biz.name} (${biz.id.slice(0, 8)}) — both Business and BusinessBranding have null logo/favicon`)
      }
      continue
    }

    const patch = {}
    if (needsLogo)    patch.logo    = biz.branding.logo
    if (needsFavicon) patch.favicon = biz.branding.favicon

    await db.business.update({ where: { id: biz.id }, data: patch })
    synced++
    console.log(`  [SYNCED] ${biz.name} (${biz.id.slice(0, 8)})`)
    if (needsLogo)    console.log(`           logo    → ${biz.branding.logo}`)
    if (needsFavicon) console.log(`           favicon → ${biz.branding.favicon}`)
  }

  console.log('')
  console.log(`[sync-branding] done — synced=${synced}  alreadySet=${alreadySet}  noData=${noData}`)

  if (noData > 0) {
    console.log('')
    console.log(`[sync-branding] ⚠  ${noData} business(es) have no logo/favicon in either table.`)
    console.log('  → Open the admin panel for each business → Branding → upload logo/favicon.')
  }

  await db.$disconnect()
}

run().catch(e => { console.error('[sync-branding] fatal:', e); process.exit(1) })
