// ============================================================================
// Quantix Technology — Frontend API Client
// MANAGED PLATFORM
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
// CORE FETCH WRAPPER
// ============================================================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string | string[] | number | boolean | undefined>;
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
  const { params, headers: customHeaders, ...restOptions } = options;

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

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

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
  getStats: () => apiFetch<PlatformDashboardStats>('/platform/stats'),
  getBusinesses: (params?: Record<string, unknown>) =>
    getList<BusinessListItem>('/businesses', params as Record<string, string | string[] | number | boolean | undefined>),
  createBusiness: (data: CreateBusinessRequest) => create<BusinessListItem>('/businesses', data),
  getLeads: (params?: LeadFilter & { page?: number; limit?: number }) =>
    getList<LeadListItem>('/leads', params as Record<string, string | string[] | number | boolean | undefined>),
  createLead: (data: CreateLeadRequest) => create<LeadListItem>('/leads', data),
  getDeployments: (params?: Record<string, unknown>) =>
    getList<unknown>('/deployments', params as Record<string, string | string[] | number | boolean | undefined>),
  getDomains: (params?: Record<string, unknown>) =>
    getList<unknown>('/domains', params as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// BUSINESS API
// ============================================================================

export const businessApi = {
  list: (params?: Record<string, unknown>) =>
    getList<BusinessListItem>('/businesses', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<BusinessListItem>('/businesses', id),
  create: (data: CreateBusinessRequest) => create<BusinessListItem>('/businesses', data),
  update: (id: string, data: UpdateBusinessRequest) => update<BusinessListItem>('/businesses', id, data),
  delete: (id: string) => remove<BusinessListItem>('/businesses', id),
  getDashboard: (businessId: string) =>
    apiFetch<DashboardStats>(`/businesses/${businessId}/dashboard`),
};

// ============================================================================
// STORE API
// ============================================================================

export const storeApi = {
  list: (params?: Record<string, unknown>) =>
    getList<StoreListItem>('/stores', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<StoreListItem>('/stores', id),
  create: (data: CreateStoreRequest) => create<StoreListItem>('/stores', data),
  update: (id: string, data: Partial<CreateStoreRequest>) => update<StoreListItem>('/stores', id, data),
  delete: (id: string) => remove<StoreListItem>('/stores', id),
};

// ============================================================================
// PRODUCT API
// ============================================================================

export const productApi = {
  list: (params?: ProductFilter & { page?: number; limit?: number }) =>
    getList<ProductListItem>('/products', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<ProductListItem>('/products', id),
  create: (data: CreateProductRequest) => create<ProductListItem>('/products', data),
  update: (id: string, data: Partial<CreateProductRequest>) => update<ProductListItem>('/products', id, data),
  delete: (id: string) => remove<ProductListItem>('/products', id),
  getByCategory: (categoryId: string) =>
    getList<ProductListItem>('/products', { categoryId } as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// ORDER API
// ============================================================================

export const orderApi = {
  list: (params?: OrderFilter & { page?: number; limit?: number }) =>
    getList<OrderListItem>('/orders', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<OrderListItem>('/orders', id),
  create: (data: CreateOrderRequest) => create<OrderListItem>('/orders', data),
  updateStatus: (id: string, status: string, note?: string) =>
    update<OrderListItem>(`/orders/${id}/status`, '', { status, note }),
  cancel: (id: string, reason: string) =>
    update<OrderListItem>(`/orders/${id}/cancel`, '', { reason }),
};

// ============================================================================
// CUSTOMER API
// ============================================================================

export const customerApi = {
  list: (params?: CustomerFilter & { page?: number; limit?: number }) =>
    getList<CustomerListItem>('/customers', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<CustomerListItem>('/customers', id),
  create: (data: { name: string; email?: string; phone?: string }) =>
    create<CustomerListItem>('/customers', data),
  update: (id: string, data: Partial<CustomerListItem>) =>
    update<CustomerListItem>('/customers', id, data),
  delete: (id: string) => remove<CustomerListItem>('/customers', id),
};

// ============================================================================
// SUBSCRIPTION API
// ============================================================================

export const subscriptionApi = {
  listPlans: (params?: Record<string, unknown>) =>
    getList<unknown>('/subscriptions/plans', params as Record<string, string | string[] | number | boolean | undefined>),
  getPlan: (id: string) => getOne<unknown>('/subscriptions/plans', id),
  createPlan: (data: CreateSubscriptionPlanRequest) =>
    create<unknown>('/subscriptions/plans', data),
  listSubscriptions: (params?: Record<string, unknown>) =>
    getList<unknown>('/subscriptions', params as Record<string, string | string[] | number | boolean | undefined>),
};

// ============================================================================
// DELIVERY API
// ============================================================================

export const deliveryApi = {
  listPartners: (params?: Record<string, unknown>) =>
    getList<unknown>('/delivery/partners', params as Record<string, string | string[] | number | boolean | undefined>),
  listZones: (params?: Record<string, unknown>) =>
    getList<unknown>('/delivery/zones', params as Record<string, string | string[] | number | boolean | undefined>),
  trackOrder: (orderId: string) =>
    apiFetch<unknown>(`/delivery/track/${orderId}`),
};

// ============================================================================
// INVOICE API
// ============================================================================

export const invoiceApi = {
  list: (params?: Record<string, unknown>) =>
    getList<unknown>('/invoices', params as Record<string, string | string[] | number | boolean | undefined>),
  get: (id: string) => getOne<unknown>('/invoices', id),
  generate: (orderId: string) =>
    create<unknown>('/invoices/generate', { orderId }),
};

// ============================================================================
// AUTH API
// ============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    apiFetch<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  forgotPassword: (email: string) =>
    apiFetch<unknown>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

// ============================================================================
// EXPORTS
// ============================================================================

export { ApiError };
export type { FetchOptions };
