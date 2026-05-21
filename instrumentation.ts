// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Used to auto-apply one-time data migrations that need no manual intervention.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { runStoreCodeBackfill } = await import('@/lib/migrations/backfill-store-codes')
    const result = await runStoreCodeBackfill()
    if (result.alreadyCompleted) {
      console.log('[startup] store-code-backfill: already completed, skipping')
    } else {
      console.log(`[startup] store-code-backfill: assigned codes to ${result.storesUpdated} store(s)`)
    }
  } catch (err) {
    // Non-fatal — log and continue. The admin UI button can be used to retry.
    console.error('[startup] store-code-backfill failed:', err)
  }
}
