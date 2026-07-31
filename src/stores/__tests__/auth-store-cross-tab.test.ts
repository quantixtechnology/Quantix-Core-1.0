import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const EXCHANGED_KEY = 'quantix_auth_exchanged';

describe('auth-store cross-tab coordination', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
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

  // ─── bootstrap() — server-side session validation ────────────────────
  describe('bootstrap', () => {
    it('keeps the session on /me success and populates fresh role/permissions', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      const mePayload = {
        success: true,
        data: {
          user: { id: 'u1', name: 'Test', email: 'test@quantixtechnology.in', avatar: null },
          role: 'QUANTIX_SUPER_ADMIN',
          permissions: ['dashboard:view', 'settings:edit'],
          businesses: [],
        },
      };
      vi.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(mePayload), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      );

      useAuthStore.getState().initialize();
      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState()._isBootstrapped).toBe(true);
      expect(useAuthStore.getState()._isSynced).toBe(true);
      expect(useAuthStore.getState().currentRole).toBe('QUANTIX_SUPER_ADMIN');
      expect(useAuthStore.getState().permissions).toEqual(['dashboard:view', 'settings:edit']);
    });

    it('clears the local session on 401 (invalid/expired token)', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      vi.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ success: false, error: 'SESSION_EXPIRED' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      );

      useAuthStore.getState().initialize();
      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState()._isBootstrapped).toBe(true);
      expect(localStorage.getItem('quantix_auth_token')).toBeNull();
    });

    it('finishes bootstrap on network failure without destroying the cached session', async () => {
      loginDirect();
      const { useAuthStore } = await import('@/stores/auth-store');

      vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Network request failed'));

      useAuthStore.getState().initialize();
      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState()._isBootstrapped).toBe(true);
    });

    it('no stored session → hydrated + bootstrapped immediately', async () => {
      const { useAuthStore } = await import('@/stores/auth-store');

      useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState()._isHydrated).toBe(true);
      expect(useAuthStore.getState()._isBootstrapped).toBe(true);
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
