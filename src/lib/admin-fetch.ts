// ============================================================================
// Quantix Technology — Admin Fetch Helper
// Provides authenticated fetch for admin views that need to call
// /api/core/... endpoints that require Bearer token auth
// ============================================================================

const AUTH_TOKEN_KEY    = 'quantix_auth_token';
const REFRESH_TOKEN_KEY = 'quantix_auth_refresh_token';
const BUSINESS_ID_KEY   = 'quantix_business_id';

const AUTH_STORAGE_KEYS = [
  'quantix_auth_token', 'quantix_auth_refresh_token', 'quantix_auth_user',
  'quantix_auth_business_id', 'quantix_business_id', 'quantix_auth_role',
  'quantix_auth_permissions', 'quantix_auth_businesses', 'quantix_auth_business_name',
  'quantix_auth_business_type',
];

function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return;
  AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  window.location.href = '/';
}

// Singleton refresh lock — serialises concurrent 401-triggered refreshes
// so N parallel calls share ONE inflight refresh instead of each causing
// their own (which races the server's token rotation and destroys the session).
let pendingRefresh: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = _doTokenRefresh();
  try {
    return await pendingRefresh;
  } finally {
    pendingRefresh = null;
  }
}

async function _doTokenRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const oldRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!oldRefreshToken) return false;
  try {
    const res = await fetch('/api/core/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    if (!res.ok) {
      // Another module (api-client, auth-store) may have already rotated the
      // token.  If localStorage now holds a *different* refresh token, adopt
      // the new tokens instead of destroying the session.
      const now = localStorage.getItem(REFRESH_TOKEN_KEY);
      return !!(now && now !== oldRefreshToken);
    }
    const data = await res.json();
    if (!data.success) {
      const now = localStorage.getItem(REFRESH_TOKEN_KEY);
      return !!(now && now !== oldRefreshToken);
    }
    localStorage.setItem(AUTH_TOKEN_KEY, data.data.accessToken);
    if (data.data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current business ID from localStorage
 * Reads from quantix_business_id (set by api-client's setBusinessContext)
 * Falls back to quantix_auth_business_id (set by auth-store on login)
 */
function getBusinessId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BUSINESS_ID_KEY) || localStorage.getItem('quantix_auth_business_id') || null;
}

/**
 * Get the Authorization headers with Bearer token and business context for admin API calls
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const businessId = getBusinessId();
    if (businessId) {
      headers['x-business-id'] = businessId;
    }
  }
  return headers;
}

// Extended options type — adds silentFailure flag on top of standard RequestInit.
// When silentFailure: true, a hard 401 returns the failed Response instead of
// wiping localStorage and redirecting. Use this in standalone pages (e.g. print
// pages) that open in a new tab — calling clearAuthAndRedirect() there would
// fire a StorageEvent in the parent window and force logout the entire session.
type AuthFetchOptions = RequestInit & { silentFailure?: boolean }

/**
 * Authenticated fetch that auto-refreshes expired tokens. On hard auth failure
 * it redirects to login UNLESS `silentFailure: true` is passed, in which case
 * the failed Response is returned so the caller can handle it inline.
 */
export async function authFetch(url: string, options: AuthFetchOptions = {}): Promise<Response> {
  const { silentFailure = false, ...fetchOptions } = options

  const makeHeaders = () => {
    const base = getAuthHeaders()
    // FormData bodies must not carry a Content-Type header.
    // The browser sets multipart/form-data + boundary automatically; an
    // explicit JSON header overwrites it and breaks multipart parsing.
    if (fetchOptions.body instanceof FormData) delete base['Content-Type']
    return { ...base, ...(fetchOptions.headers as Record<string, string> || {}) }
  }

  let response = await fetch(url, { ...fetchOptions, headers: makeHeaders() })

  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      response = await fetch(url, { ...fetchOptions, headers: makeHeaders() })
    } else if (!silentFailure) {
      clearAuthAndRedirect()
    }
    // silentFailure: true → fall through and return the 401 Response to the caller
  }

  return response
}

/**
 * Authenticated fetch wrapper for admin write operations
 */
export async function adminFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return { success: false, error: json.error || json.message || `Request failed with status ${response.status}` };
    }

    return { success: true, data: json.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}
