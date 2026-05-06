// ============================================================================
// Quantix Technology - Complete TypeScript Types & Interfaces
// ============================================================================

// ============================================================================
// ENUM TYPES (matching Prisma schema)
// ============================================================================

export type BusinessType = 'GROCERY' | 'FOOD_DELIVERY' | 'LAUNDRY' | 'CAR_WASH' | 'HOME_SERVICES';
export type BusinessStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED';
export type Role =
  | 'SUPER_ADMIN'
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMIN'
  | 'STORE_MANAGER'
  | 'STORE_STAFF'
  | 'CASHIER'
  | 'DELIVERY_MANAGER'
  | 'DELIVERY_PARTNER'
  | 'CUSTOMER';
export type OrderType = 'DELIVERY' | 'PICKUP' | 'DINE_IN' | 'POS' | 'SUBSCRIPTION';
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'SCHEDULED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'COD' | 'CREDIT';
export type DeliveryStatus = 'ASSIGNING' | 'ASSIGNED' | 'PICKED_UP' | 'ON_THE_WAY' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type SubscriptionType = 'CAR_WASH' | 'HOME_SERVICE' | 'LAUNDRY' | 'GROCERY' | 'CUSTOM';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'TRIAL';
export type BillingCycle = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';
export type TaxType = 'GST_0' | 'GST_5' | 'GST_12' | 'GST_18' | 'GST_28' | 'CUSTOM';
export type PromoType = 'PERCENTAGE' | 'FLAT' | 'FREE_DELIVERY' | 'BOGO';
export type InvoiceType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'RECEIPT';
export type NotificationType = 'ORDER_STATUS' | 'DELIVERY_UPDATE' | 'PROMOTION' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
export type POSSessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type ZoneType = 'CIRCLE' | 'POLYGON' | 'PINCODE';
export type AuthProvider = 'EMAIL' | 'GOOGLE' | 'PHONE' | 'OTP';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface CreateBusinessRequest {
  name: string;
  slug: string;
  businessType: BusinessType;
  description?: string;
  domain?: string;
  subdomain?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface UpdateBusinessRequest extends Partial<CreateBusinessRequest> {
  status?: BusinessStatus;
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
}

export interface CreateStoreRequest {
  name: string;
  slug: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  isMainStore?: boolean;
  deliveryRadius?: number;
  minOrderAmount?: number;
  deliveryFee?: number;
  freeDeliveryAbove?: number;
  preparationTime?: number;
  posEnabled?: boolean;
  gstNumber?: string;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  categoryId?: string;
  description?: string;
  shortDesc?: string;
  type?: ProductType;
  status?: ProductStatus;
  sku?: string;
  barcode?: string;
  images?: string[];
  unit?: string;
  unitQuantity?: number;
  isVeg?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  preparationTime?: number;
  minOrderQty?: number;
  maxOrderQty?: number;
  tags?: string[];
  nutritionInfo?: string;
  allergenInfo?: string;
  variants?: Array<{
    name: string;
    sku?: string;
    barcode?: string;
    price: number;
    mrp: number;
    costPrice?: number;
    discountPrice?: number;
    discountPercent?: number;
    stock?: number;
    minStock?: number;
    isDefault?: boolean;
    attributes?: Record<string, string>;
  }>;
}

export interface CreateOrderRequest {
  storeId: string;
  orderType: OrderType;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddressId?: string;
  deliveryInstructions?: string;
  scheduledAt?: string;
  pickupName?: string;
  pickupPhone?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    specialInstructions?: string;
    customizations?: Record<string, string>;
  }>;
  promoCodeId?: string;
  notes?: string;
  posSessionId?: string;
  posOperatorId?: string;
  tableNumber?: string;
}

export interface CreateSubscriptionPlanRequest {
  name: string;
  slug: string;
  description?: string;
  type: SubscriptionType;
  billingCycle: BillingCycle;
  price: number;
  originalPrice?: number;
  setupFee?: number;
  trialDays?: number;
  totalCredits?: number;
  creditLabel?: string;
  features?: string[];
  isFeatured?: boolean;
  maxSubscribers?: number;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: string;
  endsAt?: string;
  planItems?: Array<{
    productId?: string;
    serviceName?: string;
    creditsPerCycle?: number;
    maxPerUse?: number;
    rollover?: boolean;
    rolloverMax?: number;
  }>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  authProvider?: AuthProvider;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface OrderFilter {
  status?: OrderStatus | OrderStatus[];
  orderType?: OrderType | OrderType[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  paymentMethod?: PaymentMethod | PaymentMethod[];
  storeId?: string | string[];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ProductFilter {
  status?: ProductStatus | ProductStatus[];
  type?: ProductType | ProductType[];
  categoryId?: string | string[];
  isVeg?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

export interface CustomerFilter {
  search?: string;
  isActive?: boolean;
  dateFrom?: string;
  dateTo?: string;
  minOrders?: number;
  minSpent?: number;
  tags?: string[];
}

// ============================================================================
// PERMISSION TYPES
// ============================================================================

export type Permission = string;

export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

export interface RolePermissionMap {
  [role: string]: Permission[];
}

// ============================================================================
// BUSINESS CONTEXT
// ============================================================================

export interface BusinessContext {
  businessId: string;
  businessType: BusinessType;
  businessSlug: string;
  businessName: string;
  role: Role;
  userId: string;
  storeId?: string;
  permissions: Permission[];
}

// ============================================================================
// MODEL TYPES (Lightweight representations for frontend use)
// ============================================================================

export interface BusinessListItem {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  status: BusinessStatus;
  logo: string | null;
  primaryColor: string;
  city: string | null;
  state: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface StoreListItem {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  city: string | null;
  status: StoreStatus;
  isMainStore: boolean;
  phone: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  shortDesc: string | null;
  isVeg: boolean | null;
  isFeatured: boolean;
  isPopular: boolean;
  images: string[];
  category: { id: string; name: string } | null;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    mrp: number;
    discountPrice: number | null;
  }>;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string | null;
  totalAmount: number;
  createdAt: string;
  store: { id: string; name: string };
}

export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  isActive: boolean;
  lastOrderAt: string | null;
}

// ============================================================================
// SESSION / AUTH TYPES
// ============================================================================

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  businessId?: string;
  businessName?: string;
  businessType?: BusinessType;
  businessSlug?: string;
  storeId?: string;
  permissions: Permission[];
}

// ============================================================================
// GST CALCULATION TYPE
// ============================================================================

export interface GSTBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

// ============================================================================
// DELIVERY ZONE TYPES
// ============================================================================

export interface DeliveryZoneCircle {
  zoneType: 'CIRCLE';
  centerLat: number;
  centerLng: number;
  radius: number;
}

export interface DeliveryZonePolygon {
  zoneType: 'POLYGON';
  polygon: GeoJSON.Polygon;
}

export interface DeliveryZonePincode {
  zoneType: 'PINCODE';
  pincodes: string[];
}

export type DeliveryZoneConfig = DeliveryZoneCircle | DeliveryZonePolygon | DeliveryZonePincode;

// ============================================================================
// CART TYPES
// ============================================================================

export interface CartItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  discountPrice?: number;
  specialInstructions?: string;
  customizations?: Record<string, string>;
  isVeg?: boolean;
}

export interface Cart {
  storeId: string;
  businessId: string;
  items: CartItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  deliveryFee: number;
  totalAmount: number;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  lowStockProducts: number;
  activeSubscriptions: number;
  deliveryPartnersOnline: number;
}

export interface RevenueChart {
  date: string;
  revenue: number;
  orders: number;
}

export interface OrderStatusBreakdown {
  status: OrderStatus;
  count: number;
  percentage: number;
}
