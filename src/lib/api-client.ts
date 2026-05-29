// ============================================================================
// Quantix Technology — Frontend API Client
// MANAGED PLATFORM
// Supports auto-injection of Bearer token and automatic token refresh on 401
// ============================================================================

import type {
  ApiResponse,
  PaginatedResponse,
  CreateBusinessRequest,
  UpdateBusinessRequest,
  CreateStoreRequest,
  CreateProductRequest,
  CreateOrderRequest,
  CreateSubscriptionPlanRequest,
  CreateLeadRequest,
  DomainMappingRequest,
  DeploymentRequest,
  BusinessSubscriptionRequest,
  OrderFilter,
  ProductFilter,
  CustomerFilter,
  LeadFilter,
  BusinessListItem,
  StoreListItem,
  ProductListItem,
  OrderListItem,
  CustomerListItem,
  LeadListItem,
  DashboardStats,
  PlatformDashboardStats,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE = '/api';

let currentBusinessId: string | null = null;

/**
 * Set the current business context for API calls
 */
export function setBusinessContext(businessId: string | null) {
  currentBusinessId = businessId;
  if (businessId) {
    localStorage.setItem('quantix_business_id', businessId);
  } else {
    localStorage.removeItem('quantix_business_id');
  }
}

/**
 * Get the current business context
 */
export function getBusinessContextId(): string | null {
  if (currentBusinessId) return currentBusinessId;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('quantix_business_id');
    if (stored) {
      currentBusinessId = stored;
      return stored;
    }
  }
  return null;
}

// ============================================================================
// AUTH TOKEN HELPERS
// ============================================================================

const AUTH_TOKEN_KEY = 'quantix_auth_token';
const REFRESH_TOKEN_KEY = 'quantix_auth_refresh_token';

/**
 * Get the current auth token from localStorage
 * Does NOT import from auth-store to avoid circular dependencies
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Get the current refresh token from localStorage
 */
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Update stored tokens after refresh
 */
function updateStoredTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Attempt to refresh the access token using the refresh token
 * Returns the new access token, or null if refresh failed
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/core/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.data) return null;

    const { accessToken, refreshToken: newRefreshToken } = data.data;
    updateStoredTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    return null;
  }
}

// ============================================================================
// CORE FETCH WRAPPER
// ============================================================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string | string[] | number | boolean | undefined>;
  /** Skip auto-injection of auth token */
  skipAuth?: boolean;
  /** Skip automatic token refresh on 401 */
  skipRefresh?: boolean;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { params, headers: customHeaders, skipAuth, skipRefresh, ...restOptions } = options;

  // Build URL with query params
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, String(v)));
        } else {
          searchParams.set(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Auto-inject business-id header
  const businessId = getBusinessContextId();
  if (businessId) {
    headers['x-business-id'] = businessId;
  }

  // Auto-inject Bearer token (unless skipAuth is set)
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    // ─── Handle 401 with token refresh ──────────────────────────────
    if (response.status === 401 && !skipRefresh && !skipAuth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry the request with the new token
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...restOptions,
          headers,
        });

        const retryData = await retryResponse.json();

        if (!retryResponse.ok) {
          throw new ApiError(
            retryData.error || retryData.message || 'An error occurred',
            retryResponse.status,
            retryData
          );
        }

        return retryData as ApiResponse<T>;
      } else {
        // Refresh failed — clear auth state and reject
        // The auth-provider will detect the storage change and log out
        if (typeof window !== 'undefined') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        throw new ApiError('Session expired. Please login again.', 401);
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || 'An error occurred',
        response.status,
        data
      );
    }

    return data as ApiResponse<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

// ============================================================================
// CRUD HELPER FUNCTIONS
// ============================================================================

async function getList<T>(
  resource: string,
  params?: Record<string, string | string[] | number | boolean | undefined>
): Promise<PaginatedResponse<T>> {
  return apiFetch<T[]>(resource, { params }) as unknown as PaginatedResponse<T>;
}

async function getOne<T>(resource: string, id: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(`${resource}/${id}`);
}

async function create<T>(resource: string, data: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(resource, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function update<T>(resource: string, id: string, data: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(`${resource}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function remove<T>(resource: string, id: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(`${resource}/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// PLATFORM API (Super Admin only)
// ============================================================================

export const platformApi = {
  getStats: () => apiFetch<PlatformDashboardStats>('/core/platform/stats'),
  getBusinesses: (params?: Record<string, unknown>) =>
    getList<BusinessListItem>('/core/businesses', params as Record<string, string | string[] | number | boolean | undefined>),
  createBusiness: (data: CreateBusinessRequest) => create<BusinessListItem>('/core/businesses', data),
  getLeads: (params?: LeadFilter & { page?: number; limit?: number }) =>
    getList<LeadListItem>('/core/leads', params as Record<string, string | string[] | number | boolean | undefined>),
  createLead: (data: CreateLeadRequest) => create<LeadListItem>('/core/leads', data),
  getDeployments: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/deployments', params as Record<string, string | string[] | number | boolean | undefined>),
  getDomains: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/domains', params as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// BUSINESS API
// ============================================================================

export const businessApi = {
  list: (params?: Record<string, unknown>) =>
    getList<BusinessListItem>('/core/businesses', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<BusinessListItem>('/core/businesses', id),
  create: (data: CreateBusinessRequest) => create<BusinessListItem>('/core/businesses', data),
  update: (id: string, data: UpdateBusinessRequest) => update<BusinessListItem>('/core/businesses', id, data),
  delete: (id: string) => remove<BusinessListItem>('/core/businesses', id),
  getDashboard: (businessId: string) =>
    apiFetch<DashboardStats>(`/core/businesses/${businessId}/dashboard`),
};

// ============================================================================
// STORE API
// ============================================================================

export const storeApi = {
  list: (params?: Record<string, unknown>) =>
    getList<StoreListItem>('/core/stores', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<StoreListItem>('/core/stores', id),
  create: (data: CreateStoreRequest) => create<StoreListItem>('/core/stores', data),
  update: (id: string, data: Partial<CreateStoreRequest>) => update<StoreListItem>('/core/stores', id, data),
  delete: (id: string) => remove<StoreListItem>('/core/stores', id),
};

// ============================================================================
// PRODUCT API
// ============================================================================

export const productApi = {
  list: (params?: ProductFilter & { page?: number; limit?: number }) => {
    const businessId = getBusinessContextId();
    return getList<ProductListItem>('/core/storefront/products', { businessId, ...params } as Record<string, string | string[] | number | boolean | undefined>);
  },
  get: (id: string) => getOne<ProductListItem>('/core/storefront/products', id),
  create: (data: CreateProductRequest) => create<ProductListItem>('/core/storefront/products', data),
  update: (id: string, data: Partial<CreateProductRequest>) => update<ProductListItem>('/core/storefront/products', id, data),
  delete: (id: string) => remove<ProductListItem>('/core/storefront/products', id),
  getByCategory: (categoryId: string) =>
    getList<ProductListItem>('/core/storefront/products', { categoryId } as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// ORDER API
// ============================================================================

export const orderApi = {
  list: (params?: OrderFilter & { page?: number; limit?: number }) =>
    getList<OrderListItem>('/core/orders', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<OrderListItem>('/core/orders', id),
  create: (data: CreateOrderRequest) => create<OrderListItem>('/core/orders', data),
  updateStatus: (id: string, status: string, note?: string) =>
    update<OrderListItem>(`/core/orders/${id}/status`, '', { status, note }),
  cancel: (id: string, reason: string) =>
    update<OrderListItem>(`/core/orders/${id}/cancel`, '', { reason }),
};

// ============================================================================
// CUSTOMER API
// ============================================================================

export const customerApi = {
  list: (params?: CustomerFilter & { page?: number; limit?: number }) => {
    const businessId = getBusinessContextId();
    if (!businessId) throw new Error('Business context not set. Call setBusinessContext() first.');
    return getList<CustomerListItem>(`/core/businesses/${businessId}/customers`, params as Record<string, string | string[] | number | boolean | undefined>);
  },
  get: (id: string) => {
    const businessId = getBusinessContextId();
    return getOne<CustomerListItem>(`/core/businesses/${businessId}/customers`, id);
  },
  create: (data: { name: string; email?: string; phone?: string }) => {
    const businessId = getBusinessContextId();
    return create<CustomerListItem>(`/core/businesses/${businessId}/customers`, data);
  },
  update: (id: string, data: Partial<CustomerListItem>) => {
    const businessId = getBusinessContextId();
    return update<CustomerListItem>(`/core/businesses/${businessId}/customers`, id, data);
  },
  delete: (id: string) => {
    const businessId = getBusinessContextId();
    return remove<CustomerListItem>(`/core/businesses/${businessId}/customers`, id);
  },
};

// ============================================================================
// SUBSCRIPTION API
// ============================================================================

export const subscriptionApi = {
  listPlans: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/subscriptions/plans', params as Record<string, string | string[] | number | boolean | undefined>),
  getPlan: (id: string) => getOne<unknown>('/core/subscriptions/plans', id),
  createPlan: (data: CreateSubscriptionPlanRequest) =>
    create<unknown>('/core/subscriptions/plans', data),
  listSubscriptions: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/subscriptions', params as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// DELIVERY API
// ============================================================================

export const deliveryApi = {
  listPartners: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/delivery/partners', params as Record<string, string | string[] | number | boolean | undefined>),
  listZones: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/delivery/zones', params as Record<string, string | string[] | number | boolean | undefined>),
  trackOrder: (orderId: string) =>
    apiFetch<unknown>(`/core/storefront/orders/${orderId}/track`),
};

// ============================================================================
// INVOICE API
// ============================================================================

export const invoiceApi = {
  list: (params?: Record<string, unknown>) =>
    getList<unknown>('/core/invoices', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<unknown>('/core/invoices', id),
  generate: (orderId: string) =>
    create<unknown>('/core/invoices/generate', { orderId }),
};

// ============================================================================
// AUTH API
// ============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<unknown>('/core/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),
  loginWithOtp: (phone: string, otp: string, channel: 'EMAIL_OTP' | 'WHATSAPP_OTP' = 'WHATSAPP_OTP') =>
    apiFetch<unknown>('/core/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code: otp, channel }),
      skipAuth: true,
    }),
  sendOtp: (phone: string, channel: 'EMAIL_OTP' | 'WHATSAPP_OTP' = 'WHATSAPP_OTP') =>
    apiFetch<unknown>('/core/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, channel }),
      skipAuth: true,
    }),
  refreshToken: (refreshToken: string) =>
    apiFetch<unknown>('/core/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }),
  logout: (refreshToken: string) =>
    apiFetch<unknown>('/core/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipRefresh: true,
    }),
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    apiFetch<unknown>('/core/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),
  forgotPassword: (email: string) =>
    apiFetch<unknown>('/core/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { ApiError };
export type { FetchOptions };
