// ============================================================================
// Quantix Technology — Admin Fetch Helper
// Provides authenticated fetch for admin views that need to call
// /api/core/... endpoints that require Bearer token auth
// ============================================================================

const AUTH_TOKEN_KEY = 'quantix_auth_token';

/**
 * Get the Authorization headers with Bearer token for admin API calls
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
