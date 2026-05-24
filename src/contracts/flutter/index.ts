// ============================================================================
// QUANTIX — Flutter API DTO Contracts (FROZEN v1.0.0 — 2026-05-24)
// Source of truth for all request/response shapes between Next.js API and Flutter.
// DO NOT modify without bumping the API version.
// Generated from: /openapi/customer-v1.yaml
// ============================================================================

// ── Shared ──────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

// ── Auth DTO ─────────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  email: string;
  businessId: string;
  storeId?: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  sent: boolean;
  warning?: string;
}

export interface VerifyOtpRequest {
  email: string;
  phone?: string;
  code: string;
  name?: string;
  businessId: string;
  storeId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: 'CUSTOMER';
  businessId: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string | null;
  expiresAt: string;
  user: AuthUser;
}

// ── Customer / Profile DTO ────────────────────────────────────────────────────

export interface CustomerProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  gstNumber: string | null;
  loyaltyTier: string | null;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: number;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
}

// ── Address DTO ───────────────────────────────────────────────────────────────

export interface AddressDTO {
  id: string;
  customerId: string;
  label: string | null;
  area: string | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  instructions: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressRequest {
  label?: string;
  area?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  instructions?: string;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  label?: string;
  area?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  instructions?: string;
  isDefault?: boolean;
}

// ── Store / Bootstrap DTO ──────────────────────────────────────────────────────

export interface StoreTiming {
  day: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number | null;
  deliveryFee: number | null;
  freeDeliveryAbove: number | null;
  minOrderAmount: number | null;
  preparationTime: number | null;
  isMainStore: boolean;
  operatingHours: Record<string, unknown>;
  storeTimings: StoreTiming[];
}

export interface PaymentGatewayDTO {
  id: string;
  name: string;
  gateway: string;
  isTestMode: boolean;
}

export interface BusinessBranding {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  isOnline: boolean;
  logo: string | null;
  favicon: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  darkMode: boolean;
  tagline: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  domain: { domain: string; subdomain: string; status: string } | null;
}

export interface StoreContextResponse {
  business: BusinessBranding;
  store: StoreDTO | null;
  ecommerceConfig: {
    banners: unknown[];
    theme: string;
    homepageStyle: string;
    font: string;
  };
  allowGuestCheckout: boolean;
  orderStages: OrderStage[];
  paymentGateways: PaymentGatewayDTO[];
}

export interface OrderStage {
  key: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface AppVersionDTO {
  platform: 'android' | 'ios' | 'web';
  version: string;
  minVersion: string;
  forceUpdate: boolean;
  changelogUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string;
}

export interface NearestStoreResult {
  serviceable: boolean;
  reason?: string;
  data?: {
    store: StoreDTO;
    distance: number;
    deliveryFee: number;
    estimatedTime: number;
    freeDeliveryAbove: number;
    minOrderAmount: number;
    matchedZoneId: string | null;
  };
}

// ── Category DTO ──────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  workflowType: string | null;
  productCount: number;
  children: Omit<CategoryDTO, 'children' | 'description'>[];
}

// ── Product / Variant DTO ─────────────────────────────────────────────────────

export interface VariantDTO {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  mrp: number | null;
  discountPrice: number | null;
  discountPercent: number | null;
  isDefault: boolean;
  isActive: boolean;
  attributes: Record<string, string>;
  stock: number | null;
}

export interface ProductDTO {
  id: string;
  businessId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  type: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  sku: string | null;
  images: string[];
  unit: string | null;
  unitQuantity: string | null;
  isVeg: boolean | null;
  isFeatured: boolean;
  isPopular: boolean;
  preparationTime: number | null;
  minOrderQty: number;
  maxOrderQty: number;
  tags: string[];
  workflowType: string | null;
  sortOrder: number;
  defaultPrice: number;
  defaultMrp: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  availableStock: number;
  hasInventory: boolean;
  category: Pick<CategoryDTO, 'id' | 'name' | 'slug' | 'image' | 'workflowType'> | null;
  variants: VariantDTO[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Cart DTO ──────────────────────────────────────────────────────────────────

export interface CartVariantSummary {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  discountPrice: number | null;
  sku: string | null;
}

export interface CartItemDTO {
  id: string;
  productId: string;
  variantId: string | null;
  storeId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableQty: number | null;
  inventoryStatus: string | null;
  product: {
    name: string;
    slug: string;
    images: string[];
    status: string;
  };
  variant: CartVariantSummary | null;
}

export interface CartDTO {
  success: boolean;
  data: CartItemDTO[];
  total: number;
  itemCount: number;
}

export interface AddToCartRequest {
  productId: string;
  variantId?: string;
  storeId: string;
  quantity?: number;
}

export interface UpdateCartRequest {
  itemId: string;
  quantity: number;
}

// ── Coupon DTO ────────────────────────────────────────────────────────────────

export interface CouponDTO {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FLAT' | 'FREE_DELIVERY' | 'BOGO';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLeft: number | null;
  validUntil: string;
}

// ── Order / Checkout DTO ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'FAILED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface OrderItemDTO {
  id: string;
  itemType: string;
  itemName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isVeg: boolean | null;
  specialInstructions: string | null;
}

export interface OrderDTO {
  id: string;
  businessId: string;
  storeId: string;
  orderNumber: string;
  orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  orderSource: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  subtotal: number;
  totalTax: number;
  deliveryFee: number;
  totalDiscount: number;
  totalAmount: number;
  promoCodeId: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  items: OrderItemDTO[];
}

export interface CreateOrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  specialInstructions?: string;
  customizations?: Record<string, unknown>;
}

export interface CreateOrderRequest {
  storeId: string;
  orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  items: CreateOrderItem[];
  deliveryAddressId?: string;
  deliveryFee?: number;
  paymentMethod?: string;
  promoCodeId?: string;
  deliveryInstructions?: string;
  notes?: string;
}

export interface OutOfStockError {
  success: false;
  error: string;
  code: 'OUT_OF_STOCK';
  productId: string;
  availableQty: number;
  requestedQty: number;
}

// ── Tracking DTO ──────────────────────────────────────────────────────────────

export interface PartnerTrackingSummary {
  id: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  vehicleType: string | null;
  rating: number | null;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: string | null;
}

export interface LiveTrackingDTO {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    orderType: string;
  };
  partner: PartnerTrackingSummary | null;
  location: LocationPoint | null;
  eta: string | null;
  etaMinutes: number | null;
  distanceKm: number | null;
  estimatedArrival: string | null;
  deliveryStatus: string | null;
  isLive: boolean;
}

export interface EtaDTO {
  etaMinutes: number | null;
  distanceKm: number | null;
  estimatedArrival: string | null;
  eta: string | null;
  lastLocationUpdate: string | null;
}

export interface OrderTrackingDTO {
  id: string;
  orderNumber: string;
  orderType: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  totalTax: number;
  totalDiscount: number;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  store: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    city: string | null;
    phone: string | null;
  };
  customer: { name: string | null } | null;
  delivery: {
    status: string;
    estimatedDeliveryTime: string | null;
    actualPickupTime: string | null;
    actualDeliveryTime: string | null;
    distance: number | null;
    liveTracking: LocationPoint[];
    partner: PartnerTrackingSummary | null;
  } | null;
  statusHistory: Array<{
    status: OrderStatus;
    note: string | null;
    timestamp: string;
  }>;
  items: OrderItemDTO[];
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    paidAt: string | null;
  }>;
}

// ── Notification DTO ──────────────────────────────────────────────────────────

export type NotificationType = 'ORDER_STATUS' | 'PAYMENT' | 'DELIVERY' | 'PROMO' | 'SYSTEM' | 'CUSTOM';
export type NotificationChannel = 'PUSH' | 'IN_APP' | 'EMAIL' | 'SMS';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: NotificationDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    unreadCount: number;
    totalPages: number;
    hasNext: boolean;
  };
}

export interface DeviceRegisterRequest {
  fcmToken: string;
  platform: 'ANDROID' | 'IOS' | 'WEB';
  deviceId?: string;
  appVersion?: string;
}

// ── CMS / Banner / Promo DTO ───────────────────────────────────────────────────

export interface BannerDTO {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

export interface PromoDisplayDTO {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FLAT' | 'FREE_DELIVERY' | 'BOGO';
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  validUntil: string;
}

// ── WebSocket Payload DTO ─────────────────────────────────────────────────────

export interface WsOrderStatusChanged {
  orderId: string;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  note?: string;
  businessId: string;
  storeId?: string;
  customerId?: string;
  timestamp: string;
}

export interface WsDeliveryLocationUpdated {
  orderId: string;
  partnerId: string;
  partnerName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  etaMinutes?: number;
  distanceKm?: number;
  businessId: string;
  timestamp: string;
}

export interface WsPartnerAssigned {
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  businessId: string;
  timestamp: string;
}

export interface WsTrackingEtaUpdated {
  orderId: string;
  etaMinutes: number;
  distanceKm: number;
  estimatedArrival: string;
  timestamp: string;
}

export interface WsNotificationNew {
  notificationId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: string;
}
