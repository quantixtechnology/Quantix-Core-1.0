// ============================================================================
// Quantix Technology — Admin Fetch Helper
// Provides authenticated fetch for admin views that need to call
// /api/core/... endpoints that require Bearer token auth
// ============================================================================

const AUTH_TOKEN_KEY = 'quantix_auth_token';
const BUSINESS_ID_KEY = 'quantix_business_id';

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
