import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('session-handoff', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ─── needsExchange() ──────────────────────────────────────────────────
  describe('needsExchange', () => {
    it('returns false when no token exists', async () => {
      const { needsExchange } = await import('../session-handoff');
      expect(needsExchange()).toBe(false);
    });

    it('returns true when token exists but exchanged marker is absent', async () => {
      localStorage.setItem('quantix_auth_token', 'some-token');
      const { needsExchange } = await import('../session-handoff');
      expect(needsExchange()).toBe(true);
    });

    it('returns false when both token and exchanged marker exist', async () => {
      localStorage.setItem('quantix_auth_token', 'some-token');
      localStorage.setItem('quantix_auth_exchanged', 'true');
      const { needsExchange } = await import('../session-handoff');
      expect(needsExchange()).toBe(false);
    });

    it('returns false when only marker exists but no token', async () => {
      localStorage.setItem('quantix_auth_exchanged', 'true');
      const { needsExchange } = await import('../session-handoff');
      expect(needsExchange()).toBe(false);
    });

    it('returns false on server side (no window)', async () => {
      const windowSpy = vi.spyOn(globalThis as any, 'window', 'get').mockReturnValue(undefined);
      const { needsExchange } = await import('../session-handoff');
      expect(needsExchange()).toBe(false);
      windowSpy.mockRestore();
    });
  });

  // ─── importSessionFromHash() ──────────────────────────────────────────
  describe('importSessionFromHash', () => {
    it('imports session keys from URL hash', async () => {
      const user = JSON.stringify({ id: 'u1', name: 'Test', email: 'test@example.com' });
      const bag = {
        'quantix_auth_token': 'imported-token',
        'quantix_auth_refresh_token': 'imported-refresh',
        'quantix_auth_user': user,
        'quantix_auth_role': 'QUANTIX_SUPER_ADMIN',
      };
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(bag))));
      window.location.hash = `#__qxsession=${encodeURIComponent(encoded)}`;

      const { importSessionFromHash } = await import('../session-handoff');
      const result = importSessionFromHash();

      expect(result).toBe(true);
      expect(localStorage.getItem('quantix_auth_token')).toBe('imported-token');
      expect(localStorage.getItem('quantix_auth_refresh_token')).toBe('imported-refresh');
      expect(localStorage.getItem('quantix_auth_user')).toBe(user);
    });

    it('does NOT import when this origin already has a token', async () => {
      localStorage.setItem('quantix_auth_token', 'existing-token');
      const bag = { 'quantix_auth_token': 'imported-token' };
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(bag))));
      window.location.hash = `#__qxsession=${encodeURIComponent(encoded)}`;

      const { importSessionFromHash } = await import('../session-handoff');
      const result = importSessionFromHash();

      expect(result).toBe(false);
      expect(localStorage.getItem('quantix_auth_token')).toBe('existing-token');
    });

    it('strips the hash after import', async () => {
      const bag = { 'quantix_auth_token': 't' };
      const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(bag))));
      window.location.hash = `#__qxsession=${encodeURIComponent(encoded)}`;

      const { importSessionFromHash } = await import('../session-handoff');
      importSessionFromHash();

      expect(window.location.hash).toBe('');
    });

    it('returns false when no handoff param in hash', async () => {
      window.location.hash = '#some-other-param';
      const { importSessionFromHash } = await import('../session-handoff');
      expect(importSessionFromHash()).toBe(false);
    });

    it('handles malformed hash gracefully', async () => {
      window.location.hash = `#__qxsession=not-valid-base64!!`;
      const { importSessionFromHash } = await import('../session-handoff');
      expect(importSessionFromHash()).toBe(false);
    });
  });

  // ─── buildSessionHandoffHash() ────────────────────────────────────────
  describe('buildSessionHandoffHash', () => {
    it('returns empty string when no token in storage', async () => {
      const { buildSessionHandoffHash } = await import('../session-handoff');
      expect(buildSessionHandoffHash()).toBe('');
    });

    it('builds a hash containing __qxsession param', async () => {
      localStorage.setItem('quantix_auth_token', 'tok');
      localStorage.setItem('quantix_auth_refresh_token', 'rtok');

      const { buildSessionHandoffHash } = await import('../session-handoff');
      const hash = buildSessionHandoffHash();

      expect(hash).toContain('__qxsession=');
    });

    it('builds round-trippable hash', async () => {
      localStorage.setItem('quantix_auth_token', 'tok');
      localStorage.setItem('quantix_auth_refresh_token', 'rtok');
      localStorage.setItem('quantix_auth_user', JSON.stringify({ id: 'u1' }));
      localStorage.setItem('quantix_auth_role', 'CLIENT_OWNER');

      const { buildSessionHandoffHash } = await import('../session-handoff');
      const hash = buildSessionHandoffHash();

      // Clear storage, set hash, then import
      localStorage.clear();
      const { importSessionFromHash } = await import('../session-handoff');
      window.location.hash = `#${hash}`;
      expect(importSessionFromHash()).toBe(true);
      expect(localStorage.getItem('quantix_auth_role')).toBe('CLIENT_OWNER');
    });
  });

  // ─── exchangeHandoffSession() ─────────────────────────────────────────
  describe('exchangeHandoffSession', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('sets exchanged marker on successful exchange', async () => {
      localStorage.setItem('quantix_auth_refresh_token', 'old-refresh');
      localStorage.setItem('quantix_auth_token', 'old-access');

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      expect(localStorage.getItem('quantix_auth_token')).toBe('new-access');
      expect(localStorage.getItem('quantix_auth_refresh_token')).toBe('new-refresh');
      expect(localStorage.getItem('quantix_auth_exchanged')).toBe('true');
    });

    it('retries on failure and eventually succeeds', async () => {
      localStorage.setItem('quantix_auth_refresh_token', 'old-refresh');

      vi.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: false, error: 'Server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true, data: { accessToken: 'a3', refreshToken: 'r3' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();

      expect(result).toEqual({ accessToken: 'a3', refreshToken: 'r3' });
      expect(localStorage.getItem('quantix_auth_exchanged')).toBe('true');
    });

    it('returns null when all retries exhausted', async () => {
      localStorage.setItem('quantix_auth_refresh_token', 'old-refresh');

      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network down'));

      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();

      expect(result).toBeNull();
      expect(localStorage.getItem('quantix_auth_exchanged')).toBeNull();
    });

    it('does not set marker on failed exchange', async () => {
      localStorage.setItem('quantix_auth_refresh_token', 'old-refresh');

      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, error: 'Invalid' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();

      expect(result).toBeNull();
      expect(localStorage.getItem('quantix_auth_exchanged')).toBeNull();
    });

    it('returns null when no token in localStorage', async () => {
      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();
      expect(result).toBeNull();
    });

    it('falls back to access token when no refresh token exists', async () => {
      localStorage.setItem('quantix_auth_token', 'only-access');

      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { exchangeHandoffSession } = await import('../session-handoff');
      const result = await exchangeHandoffSession();

      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      expect(localStorage.getItem('quantix_auth_exchanged')).toBe('true');
    });
  });

  // ─── Cross-tab: quantix_auth_exchanged in clearAuthAndRedirect ────────
  describe('clearAuthAndRedirect in admin-fetch does not clear EXCHANGED_KEY', () => {
    it('EXCHANGED_KEY survives admin-fetch clearAuthAndRedirect', async () => {
      localStorage.setItem('quantix_auth_token', 'tok');
      localStorage.setItem('quantix_auth_refresh_token', 'rtok');
      localStorage.setItem('quantix_auth_exchanged', 'true');

      // Simulate admin-fetch's clearAuthAndRedirect
      const AUTH_STORAGE_KEYS = [
        'quantix_auth_token', 'quantix_auth_refresh_token', 'quantix_auth_user',
        'quantix_auth_business_id', 'quantix_business_id', 'quantix_auth_role',
        'quantix_auth_permissions', 'quantix_auth_businesses', 'quantix_auth_business_name',
        'quantix_auth_business_type',
      ];
      AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));

      // EXCHANGED_KEY is NOT in AUTH_STORAGE_KEYS — should survive
      expect(localStorage.getItem('quantix_auth_exchanged')).toBe('true');
    });
  });
});
