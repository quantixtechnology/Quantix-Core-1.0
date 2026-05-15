// ============================================================================
// Quantix Technology — Auth Store (Zustand)
// Manages authentication state, token persistence, and business context
// ============================================================================

"use client";

import { create } from "zustand";
import type { Role, BusinessType, Permission, SessionUser } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface AuthState {
  // Core auth state
  user: SessionUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _isHydrated: boolean; // Whether the store has been initialized from localStorage

  // Business context
  currentBusinessId: string | null;
  currentBusinessName: string | null;
  currentRole: Role | null;
  currentBusinessType: BusinessType | null;
  permissions: Permission[];

  // Available businesses for the user
  businesses: Array<{
    businessId: string;
    businessName: string;
    businessType: BusinessType;
    businessSlug: string;
    role: Role;
    storeId: string | null;
    storeName: string | null;
    permissions?: Permission[];
  }>;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  refreshAuthToken: () => Promise<void>;
  syncPermissions: () => Promise<void>;
  switchBusiness: (businessId: string) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  initialize: () => void;
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
}

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  USER: "quantix_auth_user",
  TOKEN: "quantix_auth_token",
  REFRESH_TOKEN: "quantix_auth_refresh_token",
  BUSINESS_ID: "quantix_auth_business_id",
  BUSINESS_NAME: "quantix_auth_business_name",
  BUSINESS_TYPE: "quantix_auth_business_type",
  ROLE: "quantix_auth_role",
  PERMISSIONS: "quantix_auth_permissions",
  BUSINESSES: "quantix_auth_businesses",
} as const;

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

function saveToStorage(data: Partial<AuthState>): void {
  if (typeof window === "undefined") return;
  try {
    if (data.user !== undefined) {
      if (data.user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    }
    if (data.token !== undefined) {
      if (data.token) localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
    if (data.refreshToken !== undefined) {
      if (data.refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    if (data.currentBusinessId !== undefined) {
      if (data.currentBusinessId) localStorage.setItem(STORAGE_KEYS.BUSINESS_ID, data.currentBusinessId);
      else localStorage.removeItem(STORAGE_KEYS.BUSINESS_ID);
    }
    if (data.currentBusinessName !== undefined) {
      if (data.currentBusinessName) localStorage.setItem(STORAGE_KEYS.BUSINESS_NAME, data.currentBusinessName);
      else localStorage.removeItem(STORAGE_KEYS.BUSINESS_NAME);
    }
    if (data.currentBusinessType !== undefined) {
      if (data.currentBusinessType) localStorage.setItem(STORAGE_KEYS.BUSINESS_TYPE, data.currentBusinessType);
      else localStorage.removeItem(STORAGE_KEYS.BUSINESS_TYPE);
    }
    if (data.currentRole !== undefined) {
      if (data.currentRole) localStorage.setItem(STORAGE_KEYS.ROLE, data.currentRole);
      else localStorage.removeItem(STORAGE_KEYS.ROLE);
    }
    if (data.permissions !== undefined) {
      if (data.permissions.length > 0) localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(data.permissions));
      else localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
    }
    if (data.businesses !== undefined) {
      if (data.businesses.length > 0) localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(data.businesses));
      else localStorage.removeItem(STORAGE_KEYS.BUSINESSES);
    }
  } catch {
    // localStorage may be unavailable in some environments
  }
}

function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Silently fail
  }
}

function loadFromStorage(): Partial<AuthState> {
  if (typeof window === "undefined") return {};
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const currentBusinessId = localStorage.getItem(STORAGE_KEYS.BUSINESS_ID);
    const currentBusinessName = localStorage.getItem(STORAGE_KEYS.BUSINESS_NAME);
    const currentBusinessType = localStorage.getItem(STORAGE_KEYS.BUSINESS_TYPE) as BusinessType | null;
    const currentRole = localStorage.getItem(STORAGE_KEYS.ROLE) as Role | null;
    const permissionsStr = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
    const businessesStr = localStorage.getItem(STORAGE_KEYS.BUSINESSES);

    return {
      user: userStr ? JSON.parse(userStr) : null,
      token: token || null,
      refreshToken: refreshToken || null,
      isAuthenticated: !!token && !!userStr,
      currentBusinessId: currentBusinessId || null,
      currentBusinessName: currentBusinessName || null,
      currentBusinessType: currentBusinessType || null,
      currentRole: currentRole || null,
      permissions: permissionsStr ? JSON.parse(permissionsStr) : [],
      businesses: businessesStr ? JSON.parse(businessesStr) : [],
    };
  } catch {
    return {};
  }
}

// ============================================================================
// AUTH STORE
// ============================================================================

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  _isHydrated: false,
  currentBusinessId: null,
  currentBusinessName: null,
  currentRole: null,
  currentBusinessType: null,
  permissions: [],
  businesses: [],

  // ─── Initialize from localStorage (hydration) ───────────────────────
  initialize: () => {
    const stored = loadFromStorage();
    if (stored.token && stored.user) {
      set({
        user: stored.user,
        token: stored.token,
        refreshToken: stored.refreshToken || null,
        isAuthenticated: true,
        currentBusinessId: stored.currentBusinessId || null,
        currentBusinessName: stored.currentBusinessName || null,
        currentBusinessType: stored.currentBusinessType || null,
        currentRole: stored.currentRole || null,
        permissions: stored.permissions || [],
        businesses: stored.businesses || [],
        _isHydrated: true,
      });
      // Sync fresh permissions from DB in background — doesn't block render
      get().syncPermissions().catch(() => null);
    } else {
      set({ _isHydrated: true });
    }
  },

  // ─── Sync permissions from DB via /me ───────────────────────────────
  syncPermissions: async () => {
    const { user } = get();
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/core/auth/me?userId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const freshPermissions: Permission[] = data.data.permissions ?? [];
      const freshBusinesses = (data.data.businesses ?? []).map((bu: {
        businessId: string;
        role: Role;
        permissions: Permission[];
        business: { name: string; slug: string; businessType: BusinessType; primaryColor?: string; logo?: string };
        storeId: string | null;
        store?: { id: string; name: string } | null;
      }) => ({
        businessId: bu.businessId,
        businessName: bu.business.name,
        businessType: bu.business.businessType as BusinessType,
        businessSlug: bu.business.slug,
        role: bu.role as Role,
        storeId: bu.storeId,
        storeName: bu.store?.name ?? null,
        permissions: bu.permissions,
      }));

      const updates: Partial<AuthState> = {
        permissions: freshPermissions,
        businesses: freshBusinesses,
      };
      saveToStorage(updates);
      set(updates);
    } catch {
      // Non-critical — stale permissions remain until next login
    }
  },

  // ─── Login with email/password ──────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/core/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.error || "Login failed";
        set({ isLoading: false, error: errorMsg });
        throw new Error(errorMsg);
      }

      const { user, accessToken, refreshToken, businesses, permissions } = data.data;

      // Determine primary business context
      const primaryBusiness = businesses?.[0];
      const currentRole = user.role as Role;
      const currentBusinessId = primaryBusiness?.businessId || user.businessId || null;
      const currentBusinessName = primaryBusiness?.businessName || user.businessName || null;
      const currentBusinessType = (primaryBusiness?.businessType || user.businessType || null) as BusinessType | null;

      const newState: Partial<AuthState> = {
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        currentBusinessId,
        currentBusinessName,
        currentBusinessType,
        currentRole,
        permissions: permissions || [],
        businesses: businesses || [],
      };

      // Persist to localStorage
      saveToStorage(newState);

      // Also set quantix_business_id / quantix_store_id so api-client.ts
      // and the realtime hook can read context without waiting for useBusinessContext
      if (typeof window !== 'undefined') {
        if (currentBusinessId) localStorage.setItem('quantix_business_id', currentBusinessId);
        const primaryStoreId = primaryBusiness?.storeId || null;
        if (primaryStoreId) localStorage.setItem('quantix_store_id', primaryStoreId);
        else localStorage.removeItem('quantix_store_id');
      }

      set(newState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // ─── Login with OTP ─────────────────────────────────────────────────
  loginWithOtp: async (phone: string, otp: string) => {
    set({ isLoading: true, error: null });
    try {
      // First, send OTP
      const sendResponse = await fetch("/api/core/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: "WHATSAPP_OTP" }),
      });

      const sendData = await sendResponse.json();
      if (!sendData.success) {
        // OTP already sent — proceed to verify
      }

      // Then verify OTP
      const verifyResponse = await fetch("/api/core/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp, channel: "WHATSAPP_OTP" }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        const errorMsg = verifyData.error || "OTP verification failed";
        set({ isLoading: false, error: errorMsg });
        throw new Error(errorMsg);
      }

      const { user, accessToken, refreshToken, businesses, permissions } = verifyData.data;

      // Determine primary business context
      const primaryBusiness = businesses?.[0];
      const currentRole = (user.role || "CUSTOMER") as Role;
      const currentBusinessId = primaryBusiness?.businessId || null;
      const currentBusinessName = primaryBusiness?.businessName || null;
      const currentBusinessType = (primaryBusiness?.businessType || null) as BusinessType | null;

      const newState: Partial<AuthState> = {
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        currentBusinessId,
        currentBusinessName,
        currentBusinessType,
        currentRole,
        permissions: permissions || [],
        businesses: businesses || [],
      };

      saveToStorage(newState);

      if (typeof window !== 'undefined') {
        if (currentBusinessId) localStorage.setItem('quantix_business_id', currentBusinessId);
        const primaryStoreId = primaryBusiness?.storeId || null;
        if (primaryStoreId) localStorage.setItem('quantix_store_id', primaryStoreId);
        else localStorage.removeItem('quantix_store_id');
      }

      set(newState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OTP login failed";
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // ─── Logout ─────────────────────────────────────────────────────────
  logout: () => {
    const { refreshToken } = get();

    // Fire-and-forget logout API call to invalidate refresh token server-side
    if (refreshToken) {
      fetch("/api/core/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Silently fail — client-side state is cleared regardless
      });
    }

    clearStorage();
    if (typeof window !== "undefined") localStorage.removeItem("quantix_store_id");
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      currentBusinessId: null,
      currentBusinessName: null,
      currentBusinessType: null,
      currentRole: null,
      permissions: [],
      businesses: [],
    });
  },

  // ─── Refresh auth token ─────────────────────────────────────────────
  refreshAuthToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) {
      get().logout();
      return;
    }

    try {
      const response = await fetch("/api/core/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!data.success) {
        // Refresh token is invalid — force logout
        get().logout();
        return;
      }

      const { accessToken, refreshToken: newRefreshToken } = data.data;

      const updates: Partial<AuthState> = {
        token: accessToken,
        refreshToken: newRefreshToken,
      };

      saveToStorage(updates);
      set(updates);
    } catch {
      // Network error — don't logout, just fail silently
      console.error("[AuthStore] Token refresh failed");
    }
  },

  // ─── Switch business context ────────────────────────────────────────
  switchBusiness: (businessId: string) => {
    const { businesses, user } = get();
    const targetBusiness = businesses.find((b) => b.businessId === businessId);

    if (!targetBusiness || !user) return;

    const updatedUser: SessionUser = {
      ...user,
      businessId: targetBusiness.businessId,
      businessName: targetBusiness.businessName,
      businessType: targetBusiness.businessType,
      businessSlug: targetBusiness.businessSlug,
      storeId: targetBusiness.storeId || undefined,
      role: targetBusiness.role,
    };

    // Update business context in localStorage for api-client + realtime hook
    if (typeof window !== "undefined") {
      localStorage.setItem("quantix_business_id", businessId);
      if (targetBusiness.storeId) localStorage.setItem("quantix_store_id", targetBusiness.storeId);
      else localStorage.removeItem("quantix_store_id");
    }

    const updates: Partial<AuthState> = {
      user: updatedUser,
      currentBusinessId: targetBusiness.businessId,
      currentBusinessName: targetBusiness.businessName,
      currentBusinessType: targetBusiness.businessType,
      currentRole: targetBusiness.role,
      permissions: targetBusiness.permissions || [],
    };

    saveToStorage(updates);
    set(updates);
  },

  // ─── Set token manually ─────────────────────────────────────────────
  setToken: (token: string) => {
    const updates: Partial<AuthState> = { token };
    saveToStorage(updates);
    set(updates);
  },

  // ─── Clear error ────────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  // ─── Internal helpers ───────────────────────────────────────────────
  _setLoading: (loading: boolean) => set({ isLoading: loading }),
  _setError: (error: string | null) => set({ error }),
}));
