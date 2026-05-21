// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Applies schema-level fixes and data migrations automatically on every deploy.
// Each step is idempotent and guarded by a PlatformConfig lock.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // ── Step 1: Fix storeCode constraint ──────────────────────────────────────
    // Old schema had `storeCode @unique` (globally unique).
    // New schema has `@@unique([businessId, storeCode])` (per-business unique).
    // This allows BUS-0001 and BUS-0002 to both have STO-202605-0001.
    // We fix the SQLite index directly so no manual `prisma db push` is needed.
    const constraintKey = 'migration:store_storeCode_constraint_v1'
    const constraintDone = await db.platformConfig.findUnique({ where: { key: constraintKey } })
    if (!constraintDone) {
      try {
        // Drop the old global unique index (Prisma names it Store_storeCode_key)
        await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Store_storeCode_key"`)
        // Create the new per-business composite unique index
        await db.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "Store_businessId_storeCode_key" ON "Store"("businessId", "storeCode")`
        )
        await db.platformConfig.upsert({
          where: { key: constraintKey },
          create: { key: constraintKey, value: 'completed', description: 'Replaced Store.storeCode global unique with per-business composite unique' },
          update: { value: 'completed' },
        })
        console.log('[startup] store-constraint-fix: replaced global storeCode unique with per-business unique')
      } catch (e) {
        // Non-fatal — may already be correct schema or PostgreSQL (handled by migrate)
        console.warn('[startup] store-constraint-fix: skipped —', (e as Error).message)
      }
    }

    // ── Step 2: Backfill store codes ──────────────────────────────────────────
    // Assigns STO-YYYYMM-NNNN per-business to any store missing a valid code.
    const { runStoreCodeBackfill } = await import('@/lib/migrations/backfill-store-codes')
    const result = await runStoreCodeBackfill()
    if (result.alreadyCompleted) {
      console.log('[startup] store-code-backfill: already completed (v2)')
    } else {
      console.log(`[startup] store-code-backfill: assigned STO- codes to ${result.storesUpdated} store(s)`)
      if (result.updated.length > 0) {
        for (const u of result.updated) {
          console.log(`  ${u.businessCode} / ${u.storeName}: ${u.oldCode ?? 'NULL'} → ${u.newCode}`)
        }
      }
    }
  } catch (err) {
    // Non-fatal — logs error, continues startup. Admin UI can retry.
    console.error('[startup] migration error:', err)
  }
}
