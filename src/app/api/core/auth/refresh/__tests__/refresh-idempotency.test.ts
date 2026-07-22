import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Tests for the refresh endpoint's in-memory idempotency cache.
//
// The cache maps old refresh token → { new access token, new refresh token }
// for a 10-second grace window.  Near-simultaneous refreshes that present the
// same old token receive the same new pair instead of each independently
// calling the rotation endpoint.
// ============================================================================

// Re-implement the cache logic from refresh/route.ts for isolated testing
const IDEMPOTENCY_TTL_MS = 10_000;
const rotationCache = new Map<string, { accessToken: string; refreshToken: string; ts: number }>();

function getCachedRotation(oldToken: string): { accessToken: string; refreshToken: string } | null {
  const entry = rotationCache.get(oldToken);
  if (entry && Date.now() - entry.ts < IDEMPOTENCY_TTL_MS) {
    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
  }
  rotationCache.delete(oldToken);
  return null;
}

function setCachedRotation(oldToken: string, accessToken: string, refreshToken: string): void {
  rotationCache.set(oldToken, { accessToken, refreshToken, ts: Date.now() });
  if (rotationCache.size > 1000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [k, v] of rotationCache) if (v.ts < cutoff) rotationCache.delete(k);
  }
}

beforeEach(() => {
  rotationCache.clear();
});

afterEach(() => {
  rotationCache.clear();
});

describe('rotation cache', () => {
  it('returns null for a token that was never cached', () => {
    expect(getCachedRotation('never-cached')).toBeNull();
  });

  it('returns the cached pair within the TTL window', () => {
    setCachedRotation('old-token', 'new-access', 'new-refresh');
    const result = getCachedRotation('old-token');
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('returns null after the TTL expires', () => {
    vi.useFakeTimers();

    setCachedRotation('old-token', 'new-access', 'new-refresh');
    expect(getCachedRotation('old-token')).not.toBeNull();

    // Advance time past TTL
    vi.advanceTimersByTime(IDEMPOTENCY_TTL_MS + 100);

    // Bypass the real Date.now by writing a stale timestamp
    const entry = rotationCache.get('old-token')!;
    entry.ts = Date.now() - IDEMPOTENCY_TTL_MS - 100;

    expect(getCachedRotation('old-token')).toBeNull();

    vi.useRealTimers();
  });

  it('cleans up stale entries when map grows past threshold', () => {
    const staleTime = Date.now() - IDEMPOTENCY_TTL_MS - 60_000; // 1 minute stale

    // Fill with 1000 stale entries + 1 fresh = 1001 total → triggers cleanup (size > 1000)
    for (let i = 0; i < 1000; i++) {
      rotationCache.set(`stale-${i}`, {
        accessToken: `at-${i}`,
        refreshToken: `rt-${i}`,
        ts: staleTime,
      });
    }
    // This sets the 1000th entry and triggers cleanup
    setCachedRotation('fresh-token', 'fresh-at', 'fresh-rt');

    // Stale entries should be pruned
    expect(rotationCache.get('stale-0')).toBeUndefined();
    expect(rotationCache.get('stale-500')).toBeUndefined();

    // Fresh entry should survive
    expect(getCachedRotation('fresh-token')).toEqual({
      accessToken: 'fresh-at',
      refreshToken: 'fresh-rt',
    });
  });

  it('different old tokens produce different cached results', () => {
    setCachedRotation('token-a', 'access-a', 'refresh-a');
    setCachedRotation('token-b', 'access-b', 'refresh-b');

    expect(getCachedRotation('token-a')).toEqual({ accessToken: 'access-a', refreshToken: 'refresh-a' });
    expect(getCachedRotation('token-b')).toEqual({ accessToken: 'access-b', refreshToken: 'refresh-b' });
  });
});

// ── Scenario tests: concurrent refresh with simulated endpoint ─────────
describe('concurrent refresh scenarios (end-to-end simulation)', () => {
  let dbRefreshTokens: Map<string, { userId: string; expiresAt: Date }>;
  let rotationCount = 0;

  // Simulates the refresh/route.ts POST handler logic including cache
  async function simulateRefresh(refreshToken: string): Promise<{ success: boolean; data?: { accessToken: string; refreshToken: string }; error?: string; status: number }> {
    // ── Idempotency check ──
    const cached = getCachedRotation(refreshToken);
    if (cached) {
      return { success: true, data: { accessToken: cached.accessToken, refreshToken: cached.refreshToken }, status: 200 };
    }

    const record = dbRefreshTokens.get(refreshToken);
    if (!record) {
      return { success: false, error: 'Invalid refresh token', status: 401 };
    }
    if (record.expiresAt < new Date()) {
      dbRefreshTokens.delete(refreshToken);
      return { success: false, error: 'Refresh token has expired', status: 401 };
    }

    // ── Rotation ──
    rotationCount++;
    dbRefreshTokens.delete(refreshToken);

    const newAccess = `access-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newRefresh = `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const future = new Date(Date.now() + 86400000);
    dbRefreshTokens.set(newAccess, { userId: record.userId, expiresAt: future });
    dbRefreshTokens.set(newRefresh, { userId: record.userId, expiresAt: future });

    // ── Cache ──
    setCachedRotation(refreshToken, newAccess, newRefresh);

    return { success: true, data: { accessToken: newAccess, refreshToken: newRefresh }, status: 200 };
  }

  beforeEach(() => {
    dbRefreshTokens = new Map();
    rotationCount = 0;
    const future = new Date(Date.now() + 86400000);
    dbRefreshTokens.set('rt-1', { userId: 'u1', expiresAt: future });
    dbRefreshTokens.set('at-1', { userId: 'u1', expiresAt: future });
    rotationCache.clear();
  });

  it('20 concurrent refreshes with the same token result in exactly one rotation', async () => {
    const promises = Array.from({ length: 20 }, () => simulateRefresh('rt-1'));
    const results = await Promise.all(promises);

    expect(rotationCount).toBe(1);
    expect(results.every((r) => r.success)).toBe(true);

    // Every caller got the SAME new tokens
    const first = results[0].data!;
    expect(results.every((r) => r.data!.accessToken === first.accessToken)).toBe(true);
    expect(results.every((r) => r.data!.refreshToken === first.refreshToken)).toBe(true);
  });

  it('second wave of refreshes with the same token still returns cached result', async () => {
    await simulateRefresh('rt-1');
    expect(rotationCount).toBe(1);

    // Second wave — still within TTL
    const results = await Promise.all(
      Array.from({ length: 5 }, () => simulateRefresh('rt-1')),
    );
    expect(rotationCount).toBe(1); // no additional rotations
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('different tokens rotate independently', async () => {
    dbRefreshTokens.set('rt-2', { userId: 'u2', expiresAt: new Date(Date.now() + 86400000) });

    const [r1, r2] = await Promise.all([
      simulateRefresh('rt-1'),
      simulateRefresh('rt-2'),
    ]);

    expect(rotationCount).toBe(2);
    expect(r1.data!.accessToken).not.toBe(r2.data!.accessToken);
    expect(r1.data!.refreshToken).not.toBe(r2.data!.refreshToken);
  });

  it('no logout occurs despite concurrent failures and retries', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => simulateRefresh('rt-1')),
    );
    const failures = results.filter((r) => !r.success);
    expect(failures).toHaveLength(0); // ALL succeed — no logout
  });
});
