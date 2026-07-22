import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Unit tests for the singleton refresh lock pattern used in api-client.ts
// and admin-fetch.ts.  We test the LOGIC in isolation by re-creating the
// same pattern, then verify end-to-end through the exported businessApi.
// ============================================================================

// ── Pattern test: singleton promise serialises concurrent refreshes ─────
describe('singleton refresh lock pattern', () => {
  let pending: Promise<string | null> | null = null;
  let callCount = 0;

  // Simulates _doRefresh from api-client.ts
  async function doRefresh(): Promise<string | null> {
    callCount++;
    return 'new-access-token';
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (pending) return pending;
    pending = doRefresh();
    try {
      return await pending;
    } finally {
      pending = null;
    }
  }

  beforeEach(() => {
    pending = null;
    callCount = 0;
  });

  it('calls the underlying refresh exactly once for 20 concurrent requests', async () => {
    const promises = Array.from({ length: 20 }, () => refreshAccessToken());
    const results = await Promise.all(promises);
    expect(callCount).toBe(1);
    expect(results.every((r) => r === 'new-access-token')).toBe(true);
  });

  it('returns the same result for concurrent callers', async () => {
    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('new-access-token');
    expect(r2).toBe('new-access-token');
  });

  it('allows a new refresh after the previous one completes', async () => {
    await refreshAccessToken();
    expect(callCount).toBe(1);

    callCount = 0;
    await refreshAccessToken();
    expect(callCount).toBe(1);
  });

  it('returns null when refresh fails and token was NOT rotated', async () => {
    async function doRefreshFail(): Promise<string | null> {
      callCount++;
      return null;
    }

    // Override with failing implementation
    pending = null;

    // Manually test: set pending to a failing refresh
    pending = doRefreshFail();
    const result = await pending;
    expect(callCount).toBe(1);
    expect(result).toBeNull();
    pending = null;
  });
});

// ── End-to-end: businessApi with mocked fetch ──────────────────────────
describe('api-client auto-refresh integration', () => {
  let refreshCallCount = 0;
  let businessDataCallCount = 0;
  let lastAccessTokenSent: string | undefined;

  beforeEach(() => {
    refreshCallCount = 0;
    businessDataCallCount = 0;
    lastAccessTokenSent = undefined;

    localStorage.setItem('quantix_auth_token', 'expired-access');
    localStorage.setItem('quantix_auth_refresh_token', 'valid-refresh');
    localStorage.setItem('quantix_business_id', 'biz-1');

    // We must dynamically import so the module reads fresh localStorage
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('refreshes exactly once for concurrent 401s and all requests retry with the new token', async () => {
    // Track the access tokens sent in Authorization headers
    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = (init?.headers as Record<string, string>) || {};
      const auth = headers['Authorization'] || '';

      if (url.includes('/core/auth/refresh')) {
        refreshCallCount++;
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/core/businesses') && !url.includes('auth')) {
        businessDataCallCount++;
        lastAccessTokenSent = auth?.replace('Bearer ', '') || 'none';

        // First call → 401, subsequent → 200
        if (businessDataCallCount === 1) {
          return new Response(
            JSON.stringify({ success: false, error: 'Session expired' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200 },
      );
    });

    // Import the module fresh so our mocks take effect
    const { businessApi } = await import('../api-client');

    // Fire 20 concurrent requests — all should get 401, then all retry
    const promises = Array.from({ length: 20 }, () => businessApi.list());
    await Promise.allSettled(promises);

    // Exactly one refresh call, despite 20 concurrent failures
    expect(refreshCallCount).toBe(1);

    // The retried request uses the fresh token
    expect(lastAccessTokenSent).toBe('fresh-access');

    // localStorage was updated with the new tokens
    expect(localStorage.getItem('quantix_auth_token')).toBe('fresh-access');
    expect(localStorage.getItem('quantix_auth_refresh_token')).toBe('fresh-refresh');
  });

  it('does NOT clear localStorage when another module already rotated the token', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const headers = (init?.headers as Record<string, string>) || {};
      const auth = headers['Authorization'] || '';

      if (url.includes('/core/auth/refresh')) {
        // Simulate the refresh token having been already rotated by another module.
        // The server returns 401 because our refresh token was deleted by the other
        // module's rotation.  But the other module already wrote the new tokens to
        // localStorage — simulate that here.
        localStorage.setItem('quantix_auth_token', 'other-module-access');
        localStorage.setItem('quantix_auth_refresh_token', 'other-module-refresh');

        return new Response(
          JSON.stringify({ success: false, error: 'Invalid refresh token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/core/businesses') && !url.includes('auth')) {
        businessDataCallCount++;
        lastAccessTokenSent = auth?.replace('Bearer ', '') || 'none';

        if (businessDataCallCount <= 5) {
          // First 5 calls return 401 — trigger the refresh flow
          return new Response(
            JSON.stringify({ success: false, error: 'Session expired' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: null }),
        { status: 200 },
      );
    });

    const { businessApi } = await import('../api-client');

    // Reset: store the initial tokens
    localStorage.setItem('quantix_auth_token', 'expired-access');
    localStorage.setItem('quantix_auth_refresh_token', 'valid-refresh');

    const promises = Array.from({ length: 5 }, () => businessApi.list());
    await Promise.allSettled(promises);

    // The retried request should use the OTHER module's token (adopted, not wiped)
    expect(lastAccessTokenSent).toBe('other-module-access');

    // localStorage still has other-module tokens (was NOT cleared)
    expect(localStorage.getItem('quantix_auth_token')).toBe('other-module-access');
    expect(localStorage.getItem('quantix_auth_refresh_token')).toBe('other-module-refresh');
  });
});
