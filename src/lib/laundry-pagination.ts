// ── Shared pagination for laundry list screens ──────────────────────────────
//
// Customers, Orders and Payments & Ledger all default to 50 rows per page and
// allow exactly two sizes: 50 and 100.  This module centralises the parsing so
// the standard stays consistent across every API route and the invalid-sizes
// tests stay in one place.

export type ListPageSize = 50 | 100

export const LIST_PAGE_SIZES: readonly ListPageSize[] = [50, 100] as const

export const DEFAULT_LIST_PAGE_SIZE: ListPageSize = 50

/** Pages never exceed 100 rows — this constant guards every limit parsing. */
export const MAX_LIST_PAGE_SIZE = 100

/**
 * Turn a raw search-param string into a valid page size.
 *
 * - Empty / non-numeric / out-of-range → {@link fallback}.
 * - 50 or 100 → returned as-is.
 * - Any other number ≤ 100 → clamped to {@link fallback}.
 * - Greater than 100 → clamped to {@link MAX_LIST_PAGE_SIZE}.
 */
export function resolvePageSize(raw: string | null | undefined, fallback: ListPageSize = DEFAULT_LIST_PAGE_SIZE): ListPageSize {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  if (n > MAX_LIST_PAGE_SIZE) return MAX_LIST_PAGE_SIZE as ListPageSize
  return (LIST_PAGE_SIZES as readonly number[]).includes(n) ? (n as ListPageSize) : fallback
}
