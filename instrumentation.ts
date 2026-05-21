// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Applies schema fixes and data migrations automatically. Each step is idempotent.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { db } = await import('@/lib/db')

    // ── Step 1: Fix storeCode SQLite index (runs once) ────────────────────────
    // Old schema: storeCode @unique (global). New schema: @@unique([businessId, storeCode]).
    // We patch the SQLite index directly — no manual `prisma db push` needed.
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
          create: { key: constraintKey, value: 'completed', description: 'Replaced Store.storeCode global unique with @@unique([businessId, storeCode])' },
          update: { value: 'completed' },
        })
        console.log('[startup] store-constraint-fix: index updated to per-business composite')
      } catch (e) {
        console.warn('[startup] store-constraint-fix: skipped —', (e as Error).message)
      }
    }

    // ── Step 2: Backfill store codes v3 ───────────────────────────────────────
    // Format: {businessCode}-{pad3(seq)}  e.g. BUS-202605-0001-001
    // Replaces all prior STO-* / STR-* codes. Globally unique by construction.
    const { runStoreCodeBackfill } = await import('@/lib/migrations/backfill-store-codes')
    const result = await runStoreCodeBackfill()
    if (result.alreadyCompleted) {
      console.log('[startup] store-code-backfill v3: already completed')
    } else {
      console.log(`[startup] store-code-backfill v3: updated ${result.storesUpdated} store(s)`)
      for (const u of result.updated) {
        console.log(`  ${u.businessCode} / ${u.storeName}: ${u.oldCode ?? 'NULL'} → ${u.newCode}`)
      }
    }
  } catch (err) {
    console.error('[startup] migration error:', err)
  }
}
