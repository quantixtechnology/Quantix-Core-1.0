// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dynamic import keeps Node.js-only modules out of the Edge Runtime bundle,
  // preventing Turbopack from failing when it analyses this file for Edge context.
  const { resolve } = await import('path')

  // ── Log DB path so we can confirm the runtime hits the correct SQLite file ─
  const databaseUrl = process.env.DATABASE_URL
  const rawPath = databaseUrl?.replace(/^file:/, '') ?? ''
  const resolvedDbPath = rawPath.startsWith('/') ? rawPath : resolve(process.cwd(), rawPath)
  console.log(`[startup] cwd=${process.cwd()}`)
  console.log(`[startup] DATABASE_URL=${databaseUrl ?? '(not set)'}`)
  console.log(`[startup] resolvedDbPath=${resolvedDbPath}`)

  try {
    const { db } = await import('@/lib/db')

    // ── Step 1: Ensure per-business composite unique index (idempotent) ───────
    const constraintKey = 'migration:store_storeCode_constraint_v1'
    const constraintDone = await db.platformConfig.findUnique({ where: { key: constraintKey } })
    if (!constraintDone) {
      try {
        await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Store_storeCode_key"`)
        await db.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "Store_businessId_storeCode_key" ON "Store"("businessId", "storeCode")`
        )
        await db.platformConfig.upsert({
          where: { key: constraintKey },
          create: { key: constraintKey, value: 'completed', description: 'Per-business composite unique on storeCode' },
          update: { value: 'completed' },
        })
        console.log('[startup] store-constraint-fix: composite index applied')
      } catch (e) {
        console.warn('[startup] store-constraint-fix: skipped —', (e as Error).message)
      }
    }

    // ── Step 2: Audit all stores — log full state before any repair ───────────
    const { runStoreCodeBackfill, verifyStoreCodes } = await import('@/lib/migrations/backfill-store-codes')

    const preCheck = await verifyStoreCodes()
    const preInvalid = preCheck.filter(s => s.status === 'INVALID')

    console.log(
      `[startup] store-audit: ${preCheck.length} store(s) across ${new Set(preCheck.map(s => s.businessCode)).size} business(es)` +
      ` — ${preInvalid.length} INVALID`
    )
    for (const s of preCheck) {
      console.log(
        `  [startup] store-audit` +
        ` storeId=${s.storeId}` +
        ` business=${s.businessCode}` +
        ` store="${s.storeName}"` +
        ` isMain=${s.isMainStore}` +
        ` createdAt=${s.createdAt.toISOString()}` +
        ` seq=${s.storeSequence}` +
        ` actual=${s.actualStoreCode ?? 'NULL'}` +
        ` expected=${s.expectedStoreCode}` +
        ` ${s.status === 'OK' ? '✓' : '✗ INVALID'}`
      )
    }

    // ── Step 3: Force-repair if ANY store is invalid ──────────────────────────
    // Uses two-phase nullify → assign to eliminate unique-constraint collisions.
    if (preInvalid.length > 0) {
      console.log(`[startup] store-repair: ${preInvalid.length} INVALID store(s) — running two-phase repair`)
      const result = await runStoreCodeBackfill(true)

      for (const u of result.updated) {
        console.log(
          `  [startup] store-repair FIXED` +
          ` storeId=${u.storeId}` +
          ` business=${u.businessCode}` +
          ` store="${u.storeName}"` +
          ` isMain=${u.isMainStore}` +
          ` seq=${u.storeSequence}` +
          ` old=${u.oldStoreCode ?? 'NULL'}` +
          ` new=${u.storeCode}`
        )
      }
      for (const e of result.errors) {
        console.error(
          `  [startup] store-repair ERROR` +
          ` storeId=${e.storeId}` +
          ` business=${e.businessCode}` +
          ` store="${e.storeName}"` +
          ` error=${e.error}`
        )
      }

      // Post-repair verification
      const postCheck = await verifyStoreCodes()
      const stillInvalid = postCheck.filter(s => s.status === 'INVALID')
      console.log(
        `[startup] store-repair RESULT: ${result.storesUpdated} fixed` +
        `, ${result.errors.length} errors` +
        `, ${stillInvalid.length} still INVALID after repair`
      )
      for (const s of stillInvalid) {
        console.error(
          `  [startup] store-repair UNRESOLVED` +
          ` storeId=${s.storeId} store="${s.storeName}"` +
          ` actual=${s.actualStoreCode ?? 'NULL'} expected=${s.expectedStoreCode}`
        )
      }
    } else {
      // All valid — run normal backfill only if lock not set
      const result = await runStoreCodeBackfill()
      if (!result.alreadyCompleted) {
        console.log(`[startup] store-backfill: assigned codes to ${result.storesUpdated} store(s)`)
        for (const u of result.updated) {
          console.log(
            `  [startup] store-backfill` +
            ` storeId=${u.storeId} business=${u.businessCode}` +
            ` store="${u.storeName}" storeCode=${u.storeCode}`
          )
        }
      } else {
        console.log('[startup] store-backfill: all stores valid, lock set — no action needed')
      }
    }
  } catch (err) {
    console.error('[startup] store-migration FATAL:', err)
  }
}
