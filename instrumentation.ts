// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Applies schema fixes and data migrations automatically on every deploy.
// Each step is idempotent and guarded by PlatformConfig locks.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // ── Step 1: Fix storeCode SQLite index (runs once, idempotent) ────────────
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
          create: { key: constraintKey, value: 'completed', description: 'Replaced Store.storeCode global unique with @@unique([businessId,storeCode])' },
          update: { value: 'completed' },
        })
        console.log('[startup] store-constraint-fix: index updated')
      } catch (e) {
        console.warn('[startup] store-constraint-fix: skipped —', (e as Error).message)
      }
    }

    // ── Step 2: Force-fix any STR-*/STO-* codes immediately ──────────────────
    // Runs before verification. Directly detects and repairs invalid prefixes.
    // Ignores migration lock — these codes must never persist.
    const { runStoreCodeBackfill, verifyStoreCodes } = await import('@/lib/migrations/backfill-store-codes')

    const invalidPrefixCount = await db.store.count({
      where: {
        OR: [
          { storeCode: null },
          { storeCode: { startsWith: 'STR-' } },
          { storeCode: { startsWith: 'STO-' } },
        ],
      },
    })

    if (invalidPrefixCount > 0) {
      console.log(`[startup] store-code-prefixfix: ${invalidPrefixCount} store(s) with invalid codes — force correcting`)
      const fix = await runStoreCodeBackfill(true)
      console.log(`[startup] store-code-prefixfix: corrected ${fix.storesUpdated} store(s)`)
      for (const u of fix.updated) {
        console.log(`  [startup] store-code-prefixfix  business=${u.businessCode} store="${u.storeName}" storeCode=${u.storeCode}`)
      }
    }

    // ── Step 3: Verify all codes and self-heal any remaining INVALID ──────────
    const verification = await verifyStoreCodes()
    const invalid = verification.filter(s => s.status === 'INVALID')

    console.log(`[startup] store-code-verification: ${verification.length} store(s) checked, ${invalid.length} invalid`)
    for (const s of verification) {
      console.log(
        `  [startup] store-code-verification` +
        ` business=${s.businessCode} store="${s.storeName}"` +
        ` storeCode=${s.storeCode ?? 'NULL'} ${s.status === 'OK' ? '✓' : '✗ INVALID'}`
      )
    }

    if (invalid.length > 0) {
      console.log(`[startup] store-code-self-heal: ${invalid.length} store(s) invalid — correcting`)
      const result = await runStoreCodeBackfill(true)
      console.log(`[startup] store-code-self-heal: corrected ${result.storesUpdated} store(s)`)
      for (const u of result.updated) {
        console.log(`  [startup] store-code-self-heal  business=${u.businessCode} store="${u.storeName}" storeCode=${u.storeCode}`)
      }
    } else {
      const result = await runStoreCodeBackfill()
      if (!result.alreadyCompleted) {
        console.log(`[startup] store-code-backfill: assigned codes to ${result.storesUpdated} store(s)`)
        for (const u of result.updated) {
          console.log(`  [startup] store-code-backfill  business=${u.businessCode} store="${u.storeName}" storeCode=${u.storeCode}`)
        }
      }
    }
  } catch (err) {
    console.error('[startup] migration error:', err)
  }
}
