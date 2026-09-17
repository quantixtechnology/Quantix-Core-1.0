// ============================================================================
// Quantix — CUSTOMER Auth Store (Zustand)
//
// Session isolation: the Customer identity (shared by the Customer Website and
// the Customer Mobile App) lives in its OWN localStorage namespace —
// `quantix_customer_*` — completely separate from the Admin session
// (`quantix_auth_*`, see auth-store.ts). This guarantees that a customer login
// and an Admin (Super Admin / Business workspace) login can coexist on the same
// browser origin without ever clobbering one another.
//
// Admin authentication is intentionally NOT touched here: Super Admin and
// Business Admin remain one shared session (business-context switching / Open
// Workspace / session handoff are unchanged). The only separation is
// Admin ↔ Customer.
//
// A one-time migration adopts a pre-existing CUSTOMER session out of the legacy
// shared namespace into this one, so existing customers are not logged out. It
// only ever migrates a session whose role is CUSTOMER — an Admin session in the
// legacy namespace is left completely untouched.
// ============================================================================

"use client";

import { create } from "zustand";
import type { SessionUser } from "@/lib/types";

// ── Customer-only storage keys ───────────────────────────────────────────────
const K = {
  USER: "quantix_customer_user",
  TOKEN: "quantix_customer_token",
  REFRESH: "quantix_customer_refresh_token",
  ROLE: "quantix_customer_role",
  BUSINESS_ID: "quantix_customer_business_id",
  BUSINESS_NAME: "quantix_customer_business_name",
  BUSINESS_TYPE: "quantix_customer_business_type",
  BUSINESSES: "quantix_customer_businesses",
} as const;

// ── Legacy shared (Admin) namespace — source for the one-time migration ───────
const LEGACY = {
  USER: "quantix_auth_user",
  TOKEN: "quantix_auth_token",
  REFRESH: "quantix_auth_refresh_token",
  ROLE: "quantix_auth_role",
  BUSINESS_ID: "quantix_auth_business_id",
  BUSINESS_NAME: "quantix_auth_business_name",
  BUSINESS_TYPE: "quantix_auth_business_type",
  BUSINESSES: "quantix_auth_businesses",
} as const;

const LEGACY_TO_NEW: Array<[string, string]> = [
  [LEGACY.USER, K.USER],
  [LEGACY.TOKEN, K.TOKEN],
  [LEGACY.REFRESH, K.REFRESH],
  [LEGACY.ROLE, K.ROLE],
  [LEGACY.BUSINESS_ID, K.BUSINESS_ID],
  [LEGACY.BUSINESS_NAME, K.BUSINESS_NAME],
  [LEGACY.BUSINESS_TYPE, K.BUSINESS_TYPE],
  [LEGACY.BUSINESSES, K.BUSINESSES],
];

export interface CustomerSessionInput {
  token: string;
  refreshToken?: string | null;
  user: SessionUser | Record<string, unknown>;
  businesses?: unknown;
}

interface CustomerAuthState {
  user: SessionUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _isHydrated: boolean;

  initialize: () => void;
  setSession: (input: CustomerSessionInput) => void;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  refreshAuthToken: () => Promise<void>;
  syncTokensFromStorage: () => void;
}

function ls(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

// Token expiry check (24 hours for access token)
const ACCESS_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Check if access token is likely expired (we don't have exact expiry, so check if token exists and is old)
function isTokenLikelyExpired(token: string | null): boolean {
  if (!token) return true;
  // Since we can't decode JWT client-side without a library, we rely on the server 401 response
  // This is a fallback - actual expiry is validated by the server
  return false;
}

// One-time migration: adopt a legacy CUSTOMER session into the customer
// namespace, then remove the legacy keys so the customer session no longer
// lives in the shared Admin namespace on this origin. Admin sessions (any
// non-CUSTOMER role) are never migrated or removed.
function migrateLegacyCustomerSession(store: Storage): void {
  if (store.getItem(K.TOKEN)) return; // already migrated / a real customer login exists
  const legacyToken = store.getItem(LEGACY.TOKEN);
  const legacyRole = store.getItem(LEGACY.ROLE);
  if (!legacyToken || legacyRole !== "CUSTOMER") return; // not a customer session — leave Admin untouched
  for (const [from, to] of LEGACY_TO_NEW) {
    const v = store.getItem(from);
    if (v != null) store.setItem(to, v);
  }
  for (const from of Object.values(LEGACY)) store.removeItem(from);
}

// Read (and, on first run, migrate) the persisted customer session. Client-only.
function readSession(): Partial<CustomerAuthState> {
  const store = ls();
  if (!store) return {};
  try {
    migrateLegacyCustomerSession(store);
    const token = store.getItem(K.TOKEN);
    const userStr = store.getItem(K.USER);
    if (token && userStr) {
      return {
        token,
        refreshToken: store.getItem(K.REFRESH) || null,
        user: JSON.parse(userStr) as SessionUser,
        isAuthenticated: true,
      };
    }
  } catch {
    // corrupt/unavailable storage — fall through to signed-out state
  }
  return {};
}

function persistSession(input: CustomerSessionInput): void {
  const store = ls();
  if (!store) return;
  const u = input.user as Record<string, unknown>;
  store.setItem(K.TOKEN, input.token);
  if (input.refreshToken) store.setItem(K.REFRESH, input.refreshToken);
  store.setItem(K.USER, JSON.stringify(input.user));
  store.setItem(K.ROLE, (u?.role as string) || "CUSTOMER");
  if (u?.businessId) store.setItem(K.BUSINESS_ID, u.businessId as string);
  if (u?.businessName) store.setItem(K.BUSINESS_NAME, u.businessName as string);
  if (u?.businessType) store.setItem(K.BUSINESS_TYPE, u.businessType as string);
  if (input.businesses) store.setItem(K.BUSINESSES, JSON.stringify(input.businesses));
}

// Refresh access token using the customer refresh endpoint
type RefreshResult =
  | { token: string; refreshToken: string }
  | { error: "auth" | "network" | "server" | "malformed"; status?: number }
  | null;

export async function refreshCustomerAccessToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch("/api/customer/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.token) {
      // The customer refresh endpoint returns the same token for both access and refresh
      // (it rotates the refresh token and uses it as the new access token)
      return { token: data.token, refreshToken: data.refreshToken || data.token };
    }
    // Classify auth failures vs server errors
    if (res.status === 401 || res.status === 403) {
      return { error: "auth", status: res.status };
    }
    if (res.status >= 500) {
      return { error: "server", status: res.status };
    }
    // Other 4xx or unexpected response
    return { error: "malformed", status: res.status };
  } catch {
    return { error: "network" };
  }
}

// Single-flight refresh promise (module-level to survive Zustand re-renders)
let refreshPromise: Promise<RefreshResult> | null = null;

export const useCustomerAuthStore = create<CustomerAuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  _isHydrated: false,

  // Hydrate from localStorage (runs the one-time legacy migration first).
  // Called from AuthProvider's mount effect, before customer UI reads the store.
  initialize: () => {
    set({ ...readSession(), _isHydrated: true });
  },

  // Persist + set a fresh customer session (used by the website and app login).
  setSession: (input) => {
    persistSession(input);
    set({
      token: input.token,
      refreshToken: input.refreshToken || null,
      user: input.user as SessionUser,
      isAuthenticated: true,
      _isHydrated: true,
    });
  },

  // OTP login — mirrors the previous customer flow (send + verify via the
  // platform OTP endpoints) but persists into the customer namespace.
  loginWithOtp: async (phone: string, otp: string) => {
    await fetch("/api/core/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, channel: "WHATSAPP_OTP" }),
    }).catch(() => null);

    const verifyRes = await fetch("/api/core/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code: otp, channel: "WHATSAPP_OTP" }),
    });
    const data = await verifyRes.json();
    if (!data.success) throw new Error(data.error || "OTP verification failed");

    const { user, accessToken, refreshToken, businesses } = data.data;
    persistSession({ token: accessToken, refreshToken, user, businesses });
    set({
      token: accessToken,
      refreshToken: refreshToken || null,
      user,
      isAuthenticated: true,
      _isHydrated: true,
    });
  },

  logout: () => {
    const { refreshToken } = get();
    if (refreshToken) {
      // Fire-and-forget server-side refresh-token invalidation.
      fetch("/api/core/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }
    const store = ls();
    if (store) for (const k of Object.values(K)) store.removeItem(k);
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  // Refresh access token using the customer refresh endpoint
  refreshAuthToken: async () => {
    const { refreshToken, user } = get();
    if (!refreshToken || !user) return;

    // Single-flight: if a refresh is already in progress, wait for it
    if (refreshPromise) {
      const result = await refreshPromise;
      if (result && "token" in result) {
        // Another caller already succeeded, update our state
        const store = ls();
        if (store) {
          store.setItem(K.TOKEN, result.token);
          store.setItem(K.REFRESH, result.refreshToken);
        }
        set({ token: result.token, refreshToken: result.refreshToken });
      }
      return;
    }

    // Start new refresh
    refreshPromise = refreshCustomerAccessToken(refreshToken);

    try {
      const newTokens = await refreshPromise;
      if (newTokens && "token" in newTokens) {
        // Update localStorage
        const store = ls();
        if (store) {
          store.setItem(K.TOKEN, newTokens.token);
          store.setItem(K.REFRESH, newTokens.refreshToken);
        }
        // Update store state
        set({
          token: newTokens.token,
          refreshToken: newTokens.refreshToken,
        });
      } else if (newTokens && newTokens.error === "auth") {
        // Genuine authentication failure — force logout
        get().logout();
      } else {
        // Network, server error, or malformed response — preserve session, report failure
        // Do NOT logout, do NOT clear tokens
        return;
      }
    } finally {
      refreshPromise = null;
    }
  },

  // Sync tokens from localStorage (for cross-tab sync)
  syncTokensFromStorage: () => {
    const store = ls();
    if (!store) return;
    const token = store.getItem(K.TOKEN);
    const refreshToken = store.getItem(K.REFRESH);
    if (token && refreshToken) {
      set({ token, refreshToken });
    }
  },
}));
