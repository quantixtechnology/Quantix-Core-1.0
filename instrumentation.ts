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
    // If any store still has a legacy code (STR-* / STO-*) or a wrong code,
    // the migration is force-re-run automatically — no human intervention needed.
    const { verifyStoreCodes, runStoreCodeBackfill } = await import('@/lib/migrations/backfill-store-codes')

    const verification = await verifyStoreCodes()
    const needsRepair = verification.filter(s => s.status === 'NEEDS_REPAIR')

    console.log(`[startup] store-code-verification: ${verification.length} store(s) checked, ${needsRepair.length} need repair`)
    for (const s of verification) {
      const tag = s.status === 'OK' ? '✓' : '✗ NEEDS_REPAIR'
      console.log(
        `  [startup] store-code-verification` +
        ` business=${s.businessCode} store="${s.storeName}"` +
        ` current=${s.currentStoreCode ?? 'NULL'} expected=${s.expectedStoreCode} ${tag}`
      )
    }

    if (needsRepair.length > 0) {
      // Self-heal: lock is bypassed when codes are wrong, regardless of prior run
      console.log(`[startup] store-code-self-heal: ${needsRepair.length} store(s) need repair — running migration`)
      const result = await runStoreCodeBackfill(true) // force=true bypasses lock
      console.log(`[startup] store-code-self-heal: updated ${result.storesUpdated} store(s)`)
      for (const u of result.updated) {
        console.log(
          `  [startup] store-code-self-heal` +
          ` business=${u.businessCode} store="${u.storeName}"` +
          ` old=${u.oldCode ?? 'NULL'} new=${u.newCode}`
        )
      }
    } else {
      // All codes correct — run normal backfill only if lock is not set
      const result = await runStoreCodeBackfill()
      if (!result.alreadyCompleted) {
        console.log(`[startup] store-code-backfill v3: updated ${result.storesUpdated} store(s)`)
        for (const u of result.updated) {
          console.log(`  [startup] store-code-backfill  business=${u.businessCode} store="${u.storeName}" old=${u.oldCode ?? 'NULL'} new=${u.newCode}`)
        }
      }
    }
  } catch (err) {
    // Non-fatal — logs error and continues startup. Admin UI button can retry.
    console.error('[startup] migration error:', err)
  }
}
