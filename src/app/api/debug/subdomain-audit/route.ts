// GET /api/debug/subdomain-audit?slug=freshmart
// Searches ALL DB tables for any reference to the given slug or businessCode.
// Useful to confirm a deleted business left no orphaned rows.
//
// Public — no auth. TEMP: remove after cleanup confirmed.

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const bizCode = searchParams.get('businessCode')

  if (!slug && !bizCode) {
    return NextResponse.json(
      { success: false, error: 'Provide ?slug= or ?businessCode= (or both)' },
      { status: 400 }
    )
  }

  const BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'
  const fullDomain = slug ? `${slug}.${BASE}` : null

  try {
    // ── 1. Business table ─────────────────────────────────────────────────
    const bizBySlug = slug
      ? await db.business.findUnique({ where: { slug } })
      : null
    const bizByCode = bizCode
      ? await db.business.findUnique({ where: { businessCode: bizCode } })
      : null
    const bizByName = slug
      ? await db.business.findMany({ where: { name: { contains: slug } }, select: { id: true, name: true, slug: true, businessCode: true } })
      : []

    // ── 2. DomainMapping ──────────────────────────────────────────────────
    const domainMappings = await db.domainMapping.findMany({
      where: {
        OR: [
          ...(fullDomain ? [{ domain: fullDomain }] : []),
          ...(slug ? [{ subdomain: slug }] : []),
          ...(bizBySlug ? [{ businessId: bizBySlug.id }] : []),
          ...(bizByCode ? [{ businessId: bizByCode.id }] : []),
        ].filter(Boolean),
      },
    })

    // ── 3. Deployment ─────────────────────────────────────────────────────
    const deployments = await db.deployment.findMany({
      where: {
        OR: [
          ...(bizBySlug ? [{ businessId: bizBySlug.id }] : []),
          ...(bizByCode ? [{ businessId: bizByCode.id }] : []),
          ...(fullDomain ? [{ liveUrl: { contains: fullDomain } }] : []),
          ...(slug ? [{ liveUrl: { contains: slug } }] : []),
        ].filter(Boolean),
      },
      select: { id: true, businessId: true, type: true, status: true, liveUrl: true },
    })

    // ── 4. Store table ────────────────────────────────────────────────────
    const stores = await db.store.findMany({
      where: {
        OR: [
          ...(slug ? [{ slug: { contains: slug } }] : []),
          ...(slug ? [{ storeCode: { contains: slug } }] : []),
          ...(bizBySlug ? [{ businessId: bizBySlug.id }] : []),
          ...(bizByCode ? [{ businessId: bizByCode.id }] : []),
        ].filter(Boolean),
      },
      select: { id: true, businessId: true, name: true, slug: true, storeCode: true },
    })

    // ── 5. PlatformConfig — any key or value containing slug ──────────────
    const platformConfigs = await db.platformConfig.findMany({
      where: {
        OR: [
          ...(slug ? [{ key: { contains: slug } }] : []),
          ...(slug ? [{ value: { contains: slug } }] : []),
          ...(bizCode ? [{ key: { contains: bizCode } }] : []),
          ...(bizCode ? [{ value: { contains: bizCode } }] : []),
        ].filter(Boolean),
      },
    })

    // ── 6. Business subscriptions (orphaned?) ─────────────────────────────
    const orphanedSubscriptions = await db.businessSubscription.findMany({
      where: {
        OR: [
          ...(bizBySlug ? [{ businessId: bizBySlug.id }] : []),
          ...(bizByCode ? [{ businessId: bizByCode.id }] : []),
        ].filter(Boolean),
      },
      select: { id: true, businessId: true, status: true },
    })

    // ── 7. Activity logs referencing slug ─────────────────────────────────
    const activityLogs = await db.activityLog.findMany({
      where: {
        OR: [
          ...(slug ? [{ details: { contains: slug } }] : []),
          ...(bizCode ? [{ details: { contains: bizCode } }] : []),
        ].filter(Boolean),
      },
      select: { id: true, action: true, entity: true, createdAt: true, details: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    // ── 8. Leads with convertedBusinessId ────────────────────────────────
    const leadsWithSlug = slug
      ? await db.lead.findMany({
          where: {
            OR: [
              { businessName: { contains: slug } },
            ],
          },
          select: { id: true, leadId: true, businessName: true, convertedBusinessId: true, stage: true },
          take: 10,
        })
      : []

    // ── 9. What the store-context API would return ─────────────────────────
    let storeContextResult: { success: boolean; error?: string; businessId?: string } = { success: false, error: 'not checked' }
    if (slug) {
      const biz = await db.business.findUnique({
        where: { slug },
        select: { id: true, status: true },
      })
      if (!biz) {
        storeContextResult = { success: false, error: 'Business not found (slug lookup)' }
      } else if (biz.status !== 'ACTIVE' && biz.status !== 'ONBOARDING') {
        storeContextResult = { success: false, error: `Business status=${biz.status} — not active` }
      } else {
        storeContextResult = { success: true, businessId: biz.id }
      }
    }

    // ── 10. .next/cache presence ──────────────────────────────────────────
    const nextCacheDir = join(process.cwd(), '.next', 'cache')
    const nextCacheExists = existsSync(nextCacheDir)
    let nextCacheEntries = 0
    if (nextCacheExists) {
      try { nextCacheEntries = readdirSync(nextCacheDir).length } catch { /* ok */ }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    const totalRefs =
      (bizBySlug ? 1 : 0) +
      (bizByCode ? 1 : 0) +
      bizByName.length +
      domainMappings.length +
      deployments.length +
      stores.length +
      platformConfigs.length +
      orphanedSubscriptions.length

    const isClean = totalRefs === 0

    return NextResponse.json({
      success: true,
      slug,
      businessCode: bizCode,
      fullDomain,
      isClean,
      summary: {
        totalReferences: totalRefs,
        businessBySlug: !!bizBySlug,
        businessByCode: !!bizByCode,
        bizByNameMatches: bizByName.length,
        domainMappings: domainMappings.length,
        deployments: deployments.length,
        stores: stores.length,
        platformConfigs: platformConfigs.length,
        orphanedSubscriptions: orphanedSubscriptions.length,
        activityLogs: activityLogs.length,
        leadsMatched: leadsWithSlug.length,
      },
      details: {
        businessBySlug: bizBySlug,
        businessByCode: bizByCode,
        bizByName,
        domainMappings,
        deployments,
        stores,
        platformConfigs,
        orphanedSubscriptions,
        activityLogSample: activityLogs,
        leadsSample: leadsWithSlug,
      },
      storeContextApiResult: storeContextResult,
      nextCache: {
        exists: nextCacheExists,
        topLevelEntries: nextCacheEntries,
        note: 'page.tsx is "use client" — no SSR/ISR cache for storefront pages. API routes with no cache-control headers are not cached by Next.js standalone.',
      },
      verdict: isClean
        ? `✅ ${slug ?? bizCode} — no DB references found. Subdomain is dead.`
        : `⚠️  ${slug ?? bizCode} — ${totalRefs} reference(s) still exist in DB.`,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
