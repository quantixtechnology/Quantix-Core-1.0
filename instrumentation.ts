// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Applies schema fixes and data migrations automatically on every deploy.
// Each step is idempotent and guarded by PlatformConfig locks.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // ── Step 1: Fix storeCode SQLite index (runs once, idempotent) ────────────
    // Drops global unique index, creates per-business composite unique index.
    // Required so two businesses can independently have the same store sequence.
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
        console.log('[startup] store-constraint-fix: index updated to per-business composite')
      } catch (e) {
        console.warn('[startup] store-constraint-fix: skipped —', (e as Error).message)
      }
    }

    // ── Step 2: Verify + self-heal store codes ────────────────────────────────
    // Always verifies ALL stores, even if the migration lock is already set.
    // If any store has an invalid code, force-repair runs automatically.
    const { verifyStoreCodes, runStoreCodeBackfill } = await import('@/lib/migrations/backfill-store-codes')

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
        console.log(
          `  [startup] store-code-self-heal` +
          ` business=${u.businessCode} store="${u.storeName}"` +
          ` storeCode=${u.storeCode}`
        )
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
