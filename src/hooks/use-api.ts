"use client";

// ============================================================================
// Quantix Technology — React Query API Hooks
// Phase 5: Frontend Infrastructure
// ============================================================================

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  authApi,
  businessApi,
  storeApi,
  productApi,
  orderApi,
  customerApi,
  deliveryApi,
  platformApi,
  subscriptionApi,
  invoiceApi,
  setBusinessContext,
} from "@/lib/api-client";

import type {
  ApiResponse,
  PaginatedResponse,
  SessionUser,
  BusinessListItem,
  StoreListItem,
  ProductListItem,
  OrderListItem,
  CustomerListItem,
  LeadListItem,
  DashboardStats,
  PlatformDashboardStats,
  BusinessStats,
  OrderFilter,
  ProductFilter,
  CustomerFilter,
  LeadFilter,
  CreateOrderRequest,
  CreateLeadRequest,
  CreateBusinessRequest,
  Role,
} from "@/lib/types";

import { AppError } from "@/lib/error-handler";

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

export const queryKeys = {
  // Auth
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },

  // Products
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    categories: (businessId: string) => [...queryKeys.products.all, "categories", businessId] as const,
  },

  // Orders
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
    track: (id: string) => [...queryKeys.orders.all, "track", id] as const,
  },

  // Customers
  customers: {
    all: ["customers"] as const,
    lists: () => [...queryKeys.customers.all, "list"] as const,
    list: (businessId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.customers.lists(), businessId, filters] as const,
    details: () => [...queryKeys.customers.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
  },

  // Delivery
  delivery: {
    all: ["delivery"] as const,
    orders: (status?: string) => [...queryKeys.delivery.all, "orders", status] as const,
    earnings: () => [...queryKeys.delivery.all, "earnings"] as const,
  },

  // Notifications
  notifications: {
    all: ["notifications"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.notifications.all, "list", filters] as const,
  },

  // Leads
  leads: {
    all: ["leads"] as const,
    lists: () => [...queryKeys.leads.all, "list"] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.leads.lists(), filters] as const,
    details: () => [...queryKeys.leads.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
    activities: (id: string) => [...queryKeys.leads.all, "activities", id] as const,
  },

  // Businesses
  businesses: {
    all: ["businesses"] as const,
    lists: () => [...queryKeys.businesses.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.businesses.lists(), filters] as const,
    details: () => [...queryKeys.businesses.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.businesses.details(), id] as const,
    stats: (id: string) => [...queryKeys.businesses.all, "stats", id] as const,
    dashboard: (id: string) => [...queryKeys.businesses.all, "dashboard", id] as const,
  },

  // Stores
  stores: {
    all: ["stores"] as const,
    lists: () => [...queryKeys.stores.all, "list"] as const,
    list: (businessId: string) => [...queryKeys.stores.lists(), businessId] as const,
    details: () => [...queryKeys.stores.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.stores.details(), id] as const,
  },

  // Platform
  platform: {
    all: ["platform"] as const,
    stats: () => [...queryKeys.platform.all, "stats"] as const,
    businesses: (filters?: Record<string, unknown>) =>
      [...queryKeys.platform.all, "businesses", filters] as const,
    leads: (filters?: Record<string, unknown>) =>
      [...queryKeys.platform.all, "leads", filters] as const,
    deployments: (filters?: Record<string, unknown>) =>
      [...queryKeys.platform.all, "deployments", filters] as const,
    domains: (filters?: Record<string, unknown>) =>
      [...queryKeys.platform.all, "domains", filters] as const,
  },

  // Subscriptions
  subscriptions: {
    all: ["subscriptions"] as const,
    plans: (filters?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.all, "plans", filters] as const,
    plan: (id: string) => [...queryKeys.subscriptions.all, "plan", id] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.all, "list", filters] as const,
  },

  // Invoices
  invoices: {
    all: ["invoices"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.invoices.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.invoices.all, "detail", id] as const,
  },
} as const;

// ============================================================================
// AUTH HOOKS
// ============================================================================

/**
 * Get current authenticated user
 */
export function useAuthMe(options?: Omit<UseQueryOptions<SessionUser | null, AppError>, "queryKey" | "queryFn">) {
  return useQuery<SessionUser | null, AppError>({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      try {
        const response = await authApi.login("", "");
        // This is a placeholder — the actual /auth/me endpoint should be used
        const meResponse = await fetch("/api/core/auth/me", {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });
        if (!meResponse.ok) return null;
        const data = await meResponse.json();
        return data.data as SessionUser | null;
      } catch {
        return null;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

/**
 * Login mutation
 */
export function useLogin(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { email: string; password: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const response = await authApi.login(email, password);
      return response as ApiResponse<unknown>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      // Store token if returned
      if (data.data && typeof data.data === "object" && "token" in (data.data as Record<string, unknown>)) {
        const token = (data.data as { token: string }).token;
        localStorage.setItem("quantix_auth_token", token);
      }
    },
    ...options,
  });
}

/**
 * Send OTP mutation
 */
export function useSendOtp(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { phone: string }>, "mutationFn">
) {
  return useMutation<ApiResponse<unknown>, AppError, { phone: string }>({
    mutationFn: async ({ phone }) => {
      const response = await fetch("/api/core/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    ...options,
  });
}

/**
 * Verify OTP mutation
 */
export function useVerifyOtp(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { phone: string; otp: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { phone: string; otp: string }>({
    mutationFn: async ({ phone, otp }) => {
      const response = await fetch("/api/core/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      if (data.data && typeof data.data === "object" && "token" in (data.data as Record<string, unknown>)) {
        const token = (data.data as { token: string }).token;
        localStorage.setItem("quantix_auth_token", token);
      }
    },
    ...options,
  });
}

// ============================================================================
// PRODUCT HOOKS
// ============================================================================

/**
 * List products with optional filters
 */
export function useProducts(
  businessId: string,
  filters?: ProductFilter & { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<ProductListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<ProductListItem>, AppError>({
    queryKey: queryKeys.products.list({ businessId, ...filters } as Record<string, unknown>),
    queryFn: async () => {
      setBusinessContext(businessId);
      return productApi.list(filters) as unknown as PaginatedResponse<ProductListItem>;
    },
    enabled: !!businessId,
    ...options,
  });
}

/**
 * Get a single product
 */
export function useProduct(
  productId: string,
  options?: Omit<UseQueryOptions<ApiResponse<ProductListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<ProductListItem>, AppError>({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => productApi.get(productId) as Promise<ApiResponse<ProductListItem>>,
    enabled: !!productId,
    ...options,
  });
}

/**
 * List categories for a business
 */
export function useCategories(
  businessId: string,
  options?: Omit<UseQueryOptions<ApiResponse<unknown[]>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown[]>, AppError>({
    queryKey: queryKeys.products.categories(businessId),
    queryFn: async () => {
      setBusinessContext(businessId);
      const response = await fetch("/api/core/storefront/products?fields=category", {
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown[]>;
    },
    enabled: !!businessId,
    ...options,
  });
}

// ============================================================================
// ORDER HOOKS
// ============================================================================

/**
 * List orders with optional filters
 */
export function useOrders(
  filters?: OrderFilter & { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<OrderListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<OrderListItem>, AppError>({
    queryKey: queryKeys.orders.list(filters as Record<string, unknown>),
    queryFn: () => orderApi.list(filters) as unknown as PaginatedResponse<OrderListItem>,
    ...options,
  });
}

/**
 * Get a single order
 */
export function useOrder(
  orderId: string,
  options?: Omit<UseQueryOptions<ApiResponse<OrderListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<OrderListItem>, AppError>({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => orderApi.get(orderId) as Promise<ApiResponse<OrderListItem>>,
    enabled: !!orderId,
    ...options,
  });
}

/**
 * Create order mutation
 */
export function useCreateOrder(
  options?: Omit<UseMutationOptions<ApiResponse<OrderListItem>, AppError, CreateOrderRequest>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<OrderListItem>, AppError, CreateOrderRequest>({
    mutationFn: async (data) => {
      return orderApi.create(data) as Promise<ApiResponse<OrderListItem>>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
    ...options,
  });
}

/**
 * Update order status mutation
 */
export function useUpdateOrderStatus(
  options?: Omit<UseMutationOptions<ApiResponse<OrderListItem>, AppError, { orderId: string; status: string; note?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<OrderListItem>, AppError, { orderId: string; status: string; note?: string }>({
    mutationFn: async ({ orderId, status, note }) => {
      return orderApi.updateStatus(orderId, status, note) as Promise<ApiResponse<OrderListItem>>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
    ...options,
  });
}

/**
 * Track order
 */
export function useTrackOrder(
  orderId: string,
  options?: Omit<UseQueryOptions<ApiResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown>, AppError>({
    queryKey: queryKeys.orders.track(orderId),
    queryFn: () => deliveryApi.trackOrder(orderId) as Promise<ApiResponse<unknown>>,
    enabled: !!orderId,
    refetchInterval: 15000, // Refresh every 15 seconds for live tracking
    ...options,
  });
}

// ============================================================================
// CUSTOMER HOOKS
// ============================================================================

/**
 * List customers for a business
 */
export function useCustomers(
  businessId: string,
  filters?: CustomerFilter & { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<CustomerListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<CustomerListItem>, AppError>({
    queryKey: queryKeys.customers.list(businessId, filters as Record<string, unknown>),
    queryFn: async () => {
      setBusinessContext(businessId);
      return customerApi.list(filters) as unknown as PaginatedResponse<CustomerListItem>;
    },
    enabled: !!businessId,
    ...options,
  });
}

/**
 * Get a single customer
 */
export function useCustomer(
  customerId: string,
  options?: Omit<UseQueryOptions<ApiResponse<CustomerListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<CustomerListItem>, AppError>({
    queryKey: queryKeys.customers.detail(customerId),
    queryFn: () => customerApi.get(customerId) as Promise<ApiResponse<CustomerListItem>>,
    enabled: !!customerId,
    ...options,
  });
}

// ============================================================================
// DELIVERY HOOKS
// ============================================================================

/**
 * Get delivery partner's orders
 */
export function useDeliveryOrders(
  status?: string,
  options?: Omit<UseQueryOptions<ApiResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown>, AppError>({
    queryKey: queryKeys.delivery.orders(status),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const token = typeof window !== "undefined" ? localStorage.getItem("quantix_auth_token") : null;
      const businessId = getBusinessContextId();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (businessId) headers["x-business-id"] = businessId;
      const response = await fetch(`/api/core/delivery/my-orders?${new URLSearchParams(params)}`, {
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    ...options,
  });
}

/**
 * Get delivery partner earnings
 */
export function useDeliveryEarnings(
  options?: Omit<UseQueryOptions<ApiResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown>, AppError>({
    queryKey: queryKeys.delivery.earnings(),
    queryFn: async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("quantix_auth_token") : null;
      const businessId = getBusinessContextId();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (businessId) headers["x-business-id"] = businessId;
      const response = await fetch("/api/core/delivery/my-earnings", {
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    ...options,
  });
}

/**
 * Update delivery status mutation
 */
export function useUpdateDeliveryStatus(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { deliveryId: string; status: string; note?: string; otp?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { deliveryId: string; status: string; note?: string; otp?: string }>({
    mutationFn: async ({ deliveryId, status, note, otp }) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("quantix_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/core/delivery/update-status", {
        method: "PUT",
        headers,
        body: JSON.stringify({ deliveryId, status, note, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.orders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
    ...options,
  });
}

/**
 * Verify delivery OTP mutation
 */
export function useVerifyDeliveryOtp(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { orderId: string; otp: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { orderId: string; otp: string }>({
    mutationFn: async ({ orderId, otp }) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("quantix_auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/core/delivery/verify-otp", {
        method: "POST",
        headers,
        body: JSON.stringify({ orderId, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.orders() });
    },
    ...options,
  });
}

// ============================================================================
// CART HOOKS
// ============================================================================

/**
 * Validate cart items mutation
 */
export function useValidateCart(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { storeId: string; items: Array<{ productId: string; variantId?: string; quantity: number }> }>, "mutationFn">
) {
  return useMutation<ApiResponse<unknown>, AppError, { storeId: string; items: Array<{ productId: string; variantId?: string; quantity: number }> }>({
    mutationFn: async (data) => {
      const response = await fetch("/api/core/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action: "validate" }),
      });
      const resp = await response.json();
      if (!response.ok) throw AppError.fromApiError(resp);
      return resp as ApiResponse<unknown>;
    },
    ...options,
  });
}

/**
 * Calculate order totals mutation
 */
export function useCalculateTotals(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { storeId: string; items: Array<{ productId: string; variantId?: string; quantity: number }>; promoCode?: string }>, "mutationFn">
) {
  return useMutation<ApiResponse<unknown>, AppError, { storeId: string; items: Array<{ productId: string; variantId?: string; quantity: number }>; promoCode?: string }>({
    mutationFn: async (data) => {
      const response = await fetch("/api/core/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action: "calculate" }),
      });
      const resp = await response.json();
      if (!response.ok) throw AppError.fromApiError(resp);
      return resp as ApiResponse<unknown>;
    },
    ...options,
  });
}

// ============================================================================
// PAYMENT HOOKS
// ============================================================================

/**
 * Create Razorpay order mutation
 */
export function useCreateRazorpayOrder(
  options?: Omit<UseMutationOptions<ApiResponse<{ orderId: string; razorpayOrderId: string; amount: number; currency: string }>, AppError, { orderId: string }>, "mutationFn">
) {
  return useMutation<ApiResponse<{ orderId: string; razorpayOrderId: string; amount: number; currency: string }>, AppError, { orderId: string }>({
    mutationFn: async ({ orderId }) => {
      const response = await fetch("/api/core/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, provider: "razorpay" }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<{ orderId: string; razorpayOrderId: string; amount: number; currency: string }>;
    },
    ...options,
  });
}

/**
 * Verify Razorpay payment mutation
 */
export function useVerifyRazorpayPayment(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { paymentId: string; orderId: string; signature: string; razorpayOrderId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { paymentId: string; orderId: string; signature: string; razorpayOrderId: string }>({
    mutationFn: async (data) => {
      const response = await fetch(`/api/core/payments/${data.paymentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: data.paymentId,
          razorpay_order_id: data.razorpayOrderId,
          razorpay_signature: data.signature,
        }),
      });
      const resp = await response.json();
      if (!response.ok) throw AppError.fromApiError(resp);
      return resp as ApiResponse<unknown>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
    ...options,
  });
}

// ============================================================================
// NOTIFICATION HOOKS
// ============================================================================

/**
 * List notifications
 */
export function useNotifications(
  filters?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<PaginatedResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<unknown>, AppError>({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) params.set(key, String(value));
        });
      }
      const response = await fetch(`/api/core/notifications?${params}`, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as PaginatedResponse<unknown>;
    },
    ...options,
  });
}

/**
 * Mark notification as read mutation
 */
export function useMarkNotificationRead(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, string>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, string>({
    mutationFn: async (notificationId) => {
      const response = await fetch(`/api/core/notifications/${notificationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    ...options,
  });
}

// ============================================================================
// LEAD HOOKS
// ============================================================================

/**
 * List leads
 */
export function useLeads(
  filters?: LeadFilter & { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<LeadListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<LeadListItem>, AppError>({
    queryKey: queryKeys.leads.list(filters as Record<string, unknown>),
    queryFn: () => platformApi.getLeads(filters) as unknown as PaginatedResponse<LeadListItem>,
    ...options,
  });
}

/**
 * Get a single lead
 */
export function useLead(
  leadId: string,
  options?: Omit<UseQueryOptions<ApiResponse<LeadListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<LeadListItem>, AppError>({
    queryKey: queryKeys.leads.detail(leadId),
    queryFn: async () => {
      const response = await fetch(`/api/core/leads/${leadId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<LeadListItem>;
    },
    enabled: !!leadId,
    ...options,
  });
}

/**
 * Get lead activities (timeline)
 */
export function useLeadActivities(
  leadId: string,
  options?: Omit<UseQueryOptions<ApiResponse<unknown[]>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown[]>, AppError>({
    queryKey: queryKeys.leads.activities(leadId),
    queryFn: async () => {
      const response = await fetch(`/api/core/leads/${leadId}?include=activities`, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown[]>;
    },
    enabled: !!leadId,
    ...options,
  });
}

/**
 * Add lead comment mutation
 */
export function useAddLeadComment(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, { leadId: string; comment: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, { leadId: string; comment: string }>({
    mutationFn: async ({ leadId, comment }) => {
      const response = await fetch(`/api/core/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<unknown>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(variables.leadId) });
    },
    ...options,
  });
}

/**
 * Advance lead stage mutation
 */
export function useAdvanceLeadStage(
  options?: Omit<UseMutationOptions<ApiResponse<LeadListItem>, AppError, { leadId: string; stage: string; note?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<LeadListItem>, AppError, { leadId: string; stage: string; note?: string }>({
    mutationFn: async ({ leadId, stage, note }) => {
      const response = await fetch(`/api/core/leads/${leadId}/advance-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, note }),
      });
      const data = await response.json();
      if (!response.ok) throw AppError.fromApiError(data);
      return data as ApiResponse<LeadListItem>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.leadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(variables.leadId) });
    },
    ...options,
  });
}

// ============================================================================
// BUSINESS HOOKS
// ============================================================================

/**
 * List businesses
 */
export function useBusinesses(
  filters?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<PaginatedResponse<BusinessListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<BusinessListItem>, AppError>({
    queryKey: queryKeys.businesses.list(filters),
    queryFn: () => businessApi.list(filters) as unknown as PaginatedResponse<BusinessListItem>,
    ...options,
  });
}

/**
 * Get a single business
 */
export function useBusiness(
  businessId: string,
  options?: Omit<UseQueryOptions<ApiResponse<BusinessListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<BusinessListItem>, AppError>({
    queryKey: queryKeys.businesses.detail(businessId),
    queryFn: () => businessApi.get(businessId) as Promise<ApiResponse<BusinessListItem>>,
    enabled: !!businessId,
    ...options,
  });
}

/**
 * Get business stats / dashboard
 */
export function useBusinessStats(
  businessId: string,
  options?: Omit<UseQueryOptions<ApiResponse<BusinessStats>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<BusinessStats>, AppError>({
    queryKey: queryKeys.businesses.stats(businessId),
    queryFn: () => businessApi.getDashboard(businessId) as Promise<ApiResponse<BusinessStats>>,
    enabled: !!businessId,
    ...options,
  });
}

// ============================================================================
// STORE HOOKS
// ============================================================================

/**
 * List stores for a business
 */
export function useStores(
  businessId: string,
  options?: Omit<UseQueryOptions<PaginatedResponse<StoreListItem>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<StoreListItem>, AppError>({
    queryKey: queryKeys.stores.list(businessId),
    queryFn: async () => {
      setBusinessContext(businessId);
      return storeApi.list() as unknown as PaginatedResponse<StoreListItem>;
    },
    enabled: !!businessId,
    ...options,
  });
}

// ============================================================================
// PLATFORM HOOKS
// ============================================================================

/**
 * Get platform dashboard stats
 */
export function usePlatformStats(
  options?: Omit<UseQueryOptions<ApiResponse<PlatformDashboardStats>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<PlatformDashboardStats>, AppError>({
    queryKey: queryKeys.platform.stats(),
    queryFn: () => platformApi.getStats() as Promise<ApiResponse<PlatformDashboardStats>>,
    ...options,
  });
}

// ============================================================================
// SUBSCRIPTION HOOKS
// ============================================================================

/**
 * List subscription plans
 */
export function useSubscriptionPlans(
  filters?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<PaginatedResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<unknown>, AppError>({
    queryKey: queryKeys.subscriptions.plans(filters),
    queryFn: () => subscriptionApi.listPlans(filters) as unknown as PaginatedResponse<unknown>,
    ...options,
  });
}

/**
 * List subscriptions
 */
export function useSubscriptions(
  filters?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<PaginatedResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<unknown>, AppError>({
    queryKey: queryKeys.subscriptions.list(filters),
    queryFn: () => subscriptionApi.listSubscriptions(filters) as unknown as PaginatedResponse<unknown>,
    ...options,
  });
}

// ============================================================================
// INVOICE HOOKS
// ============================================================================

/**
 * List invoices
 */
export function useInvoices(
  filters?: Record<string, unknown>,
  options?: Omit<UseQueryOptions<PaginatedResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<PaginatedResponse<unknown>, AppError>({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: () => invoiceApi.list(filters) as unknown as PaginatedResponse<unknown>,
    ...options,
  });
}

/**
 * Get a single invoice
 */
export function useInvoice(
  invoiceId: string,
  options?: Omit<UseQueryOptions<ApiResponse<unknown>, AppError>, "queryKey" | "queryFn">
) {
  return useQuery<ApiResponse<unknown>, AppError>({
    queryKey: queryKeys.invoices.detail(invoiceId),
    queryFn: () => invoiceApi.get(invoiceId) as Promise<ApiResponse<unknown>>,
    enabled: !!invoiceId,
    ...options,
  });
}

/**
 * Generate invoice mutation
 */
export function useGenerateInvoice(
  options?: Omit<UseMutationOptions<ApiResponse<unknown>, AppError, string>, "mutationFn">
) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<unknown>, AppError, string>({
    mutationFn: async (orderId) => {
      return invoiceApi.generate(orderId) as Promise<ApiResponse<unknown>>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
    },
    ...options,
  });
}

// ============================================================================
// CONVENIENCE HOOK — Invalidate all queries
// ============================================================================

/**
 * Hook to get a function that invalidates all cached queries
 */
export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

/**
 * Hook to get a function that invalidates queries for a specific domain
 */
export function useInvalidateDomain(domain: keyof typeof queryKeys) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys[domain].all });
}
