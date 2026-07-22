import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const EXCHANGED_KEY = 'quantix_auth_exchanged';

describe('auth-store cross-tab coordination', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function loginDirect() {
    localStorage.setItem('quantix_auth_user', JSON.stringify({ id: 'u1', name: 'Test' }));
    localStorage.setItem('quantix_auth_token', 'tok');
    localStorage.setItem('quantix_auth_refresh_token', 'rtok');
    localStorage.setItem(EXCHANGED_KEY, 'true');
  }

  // ─── initialize() ────────────────────────────────────────────────────
  describe('initialize', () => {
    it('inits authenticated from localStorage', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().token).toBe('tok');
    });

    it('clearSession removes exchanged marker', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().clearSession();
      expect(localStorage.getItem(EXCHANGED_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('clearSession removes all auth keys', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();
      useAuthStore.getState().clearSession();

      expect(localStorage.getItem('quantix_auth_token')).toBeNull();
      expect(localStorage.getItem('quantix_auth_refresh_token')).toBeNull();
      expect(localStorage.getItem('quantix_auth_user')).toBeNull();
    });
  });

  // ─── syncTokensFromStorage ───────────────────────────────────────────
  describe('syncTokensFromStorage', () => {
    it('adopts tokens from localStorage when they differ from in-memory', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();
      expect(useAuthStore.getState().token).toBe('tok');

      // Simulate another tab rotating
      localStorage.setItem('quantix_auth_token', 'new-token');
      localStorage.setItem('quantix_auth_refresh_token', 'new-refresh');

      useAuthStore.getState().syncTokensFromStorage();
      expect(useAuthStore.getState().token).toBe('new-token');
      expect(useAuthStore.getState().refreshToken).toBe('new-refresh');
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────
  describe('logout', () => {
    it('clears exchanged marker on logout', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();
      vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

      useAuthStore.getState().logout();

      expect(localStorage.getItem(EXCHANGED_KEY)).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
