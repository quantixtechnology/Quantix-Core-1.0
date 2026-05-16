// ============================================================================
// Quantix Core Platform — Consolidated Type Definitions
// "Run Your Business Smarter" — www.quantixtechnology.in
//
// ALL enum types match the Prisma schema at prisma/schema.prisma exactly.
// This file is the SINGLE SOURCE OF TRUTH for all core platform types.
// Server-side only — do NOT import React components from this file.
//
// BUSINESS MODEL:
// - NO free trial, NO self-signup, NO self-onboarding
// - ONLY 2 plans: ₹4,999/mo (MONTHLY) and ₹49,999/yr (YEARLY)
// - Super Admin can override pricing per customer
// - Demo credentials given first; tenant created ONLY after payment verified
// - New Lead lifecycle: LEAD → DEMO_SHARED → NEGOTIATION → PAYMENT_PENDING
//   → PAYMENT_RECEIVED → ONBOARDING → DEPLOYMENT → ACTIVE
// ============================================================================

// ============================================================================
// SECTION 1: ENUM TYPES (matching Prisma schema exactly)
// ============================================================================

/** 11 supported business verticals */
export type BusinessType =
  | 'GROCERY'
  | 'FOOD_DELIVERY'
  | 'LAUNDRY'
  | 'CAR_WASH'
  | 'PHARMACY'
  | 'HOME_SERVICES'
  | 'ECOMMERCE'
  | 'COSMETICS'
  | 'MEAT_DELIVERY'
  | 'FURNITURE'
  | 'DIRECTORY';

/** Business lifecycle status — managed by Quantix */
export type BusinessStatus = 'ONBOARDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CHURNED';

/** Platform roles for the MANAGED model */
export type Role =
  | 'QUANTIX_SUPER_ADMIN'
  | 'QUANTIX_SALES_TEAM'
  | 'CLIENT_OWNER'
  | 'STORE_MANAGER'
  | 'DELIVERY_STAFF'
  | 'CUSTOMER';

/** Order types including pickup-and-delivery for laundry etc. */
export type OrderType =
  | 'DELIVERY'
  | 'PICKUP'
  | 'DINE_IN'
  | 'POS'
  | 'SUBSCRIPTION'
  | 'PICKUP_AND_DELIVERY';

/** Extended order statuses including pickup & delivery specific */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'SCHEDULED'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY';

/** Payment status for orders */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

/** Payment method types — matches Prisma PaymentMethodType enum */
export type PaymentMethodType =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'NETBANKING'
  | 'WALLET'
  | 'COD'
  | 'CREDIT'
  | 'MIXED';

/** Alias for PaymentMethodType (legacy compatibility) */
export type PaymentMethod = PaymentMethodType;

/** Delivery status for order deliveries */
export type DeliveryStatus =
  | 'ASSIGNING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

/** Delivery zone geometry types */
export type ZoneType = 'CIRCLE' | 'POLYGON' | 'PINCODE';

/** Business module status — NO TRIAL */
export type ModuleStatus = 'DISABLED' | 'ENABLED';

/** Store operational status */
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

/** POS session status */
export type POSSessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

/** Platform plan billing cycle — ONLY MONTHLY and YEARLY */
export type PlanBillingCycle = 'MONTHLY' | 'YEARLY';

/** Business (platform) subscription status — NO TRIAL, managed by Quantix */
export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED';

/** Customer subscription service types */
export type SubscriptionServiceType =
  | 'CAR_WASH'
  | 'HOME_SERVICE'
  | 'LAUNDRY'
  | 'GROCERY'
  | 'CUSTOM';

/** Customer subscription billing cycles */
export type SubscriptionBillingCycle =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY';

/** Customer subscription status — NO TRIAL */
export type CustomerSubscriptionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

/** Product types */
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION';

/** Product lifecycle status */
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';

/** Inventory stock status */
export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';

/** Tax configuration types */
export type TaxType = 'GST_0' | 'GST_5' | 'GST_12' | 'GST_18' | 'GST_28' | 'CUSTOM';

/** Promo code types */
export type PromoType = 'PERCENTAGE' | 'FLAT' | 'FREE_DELIVERY' | 'BOGO';

/** Invoice types */
export type InvoiceType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'RECEIPT';

/** Notification types */
export type NotificationType =
  | 'ORDER_STATUS'
  | 'DELIVERY_UPDATE'
  | 'PROMOTION'
  | 'SUBSCRIPTION'
  | 'PAYMENT'
  | 'SYSTEM';

/** Notification channels — NO SMS, only Push, WhatsApp, Email, In-App */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';

/** Auth provider types */
export type AuthProvider = 'EMAIL_OTP' | 'WHATSAPP_OTP' | 'PUSH_NOTIFICATION' | 'GOOGLE' | 'PASSWORD';

/** Domain mapping statuses — managed by Quantix */
export type DomainStatus = 'PENDING_DNS' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'ACTIVE' | 'ERROR';

/** Deployment statuses — managed by Quantix */
export type DeploymentStatus = 'PENDING' | 'BUILDING' | 'DEPLOYING' | 'LIVE' | 'FAILED' | 'MAINTENANCE';

/** Deployment types */
export type DeploymentType = 'WEBSITE' | 'ADMIN_DASHBOARD' | 'CUSTOMER_APP' | 'DELIVERY_APP' | 'ADMIN_APP';

/** Lead sources for the sales pipeline */
export type LeadSource =
  | 'META_ADS'
  | 'GOOGLE_ADS'
  | 'DIRECT_REFERRAL'
  | 'WEBSITE_INQUIRY'
  | 'COLD_OUTREACH'
  | 'WHATSAPP_INQUIRY'
  | 'PHONE_CALL'
  | 'OTHER';

/** Lead lifecycle stages — new managed sales pipeline */
export type LeadStage =
  | 'LEAD'
  | 'DEMO_SHARED'
  | 'NEGOTIATION'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RECEIVED'
  | 'ONBOARDING'
  | 'DEPLOYMENT'
  | 'ACTIVE'
  | 'LOST'
  | 'CHURNED';

/** Demo tenant status for prospect demos */
export type DemoTenantStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DISABLED';

/** Onboarding step status for business setup tracking */
export type OnboardingStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

// ============================================================================
// SECTION 2: API RESPONSE TYPES
// ============================================================================

/** Standard API response wrapper */
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

/** Pagination metadata */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Paginated API response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ============================================================================
// SECTION 3: REQUEST TYPES
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
  tagline?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  fssaiLicense?: string;
  contactEmail?: string;
  contactPhone?: string;
  supportEmail?: string;
  supportPhone?: string;
  salesRepId?: string;
  planId?: string;
  billingCycle?: PlanBillingCycle;
  customPrice?: number;
  discountPercentage?: number;
  manualPriceOverride?: boolean;
  overrideReason?: string;
  leadId?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerName?: string;
  renewalDate?: string;     // ISO date string; extracted to billingCycleDay + nextBillingDate
  subscriptionNotes?: string;
}

export interface UpdateBusinessRequest extends Partial<CreateBusinessRequest> {
  status?: BusinessStatus;
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
  notificationConfig?: Record<string, unknown>;
}

export interface StoreTimingInput {
  day: number; // 0 = Sunday, 6 = Saturday
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface DefaultStoreTiming {
  day: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
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
  paperSize?: string;
  printerType?: string;
}

export interface CreateOrderRequest {
  storeId: string;
  orderType: OrderType;
  paymentMethod?: PaymentMethodType;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddressId?: string;
  deliveryInstructions?: string;
  scheduledAt?: string;
  pickupAddress?: string;
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

export interface BusinessSubscriptionRequest {
  planId: string;
  billingCycle?: PlanBillingCycle;
  customPrice?: number;
  discountPercentage?: number;
  manualPriceOverride?: boolean;
  overrideReason?: string;
  notes?: string;
}

// ============================================================================
// SECTION 4: BUSINESS CONTEXT
// ============================================================================

/** Resolved business context for the current request */
export interface BusinessContext {
  businessId: string;
  businessType: BusinessType;
  businessSlug: string;
  businessName: string;
  role: Role;
  userId: string;
  storeId?: string;
  permissions: Permission[];
  isPlatformAdmin: boolean;
}

// ============================================================================
// SECTION 5: FILTER TYPES
// ============================================================================

export interface OrderFilter {
  status?: OrderStatus | OrderStatus[];
  orderType?: OrderType | OrderType[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  paymentMethod?: PaymentMethodType | PaymentMethodType[];
  storeId?: string | string[];
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
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

export interface LeadFilter {
  stage?: LeadStage | LeadStage[];
  source?: LeadSource | LeadSource[];
  businessType?: BusinessType | BusinessType[];
  salesRepId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ProductFilter {
  status?: ProductStatus | ProductStatus[];
  type?: ProductType | ProductType[];
  categoryId?: string | string[];
  storeId?: string;
  isVeg?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

export interface BusinessListFilters {
  businessType?: BusinessType | BusinessType[];
  status?: BusinessStatus | BusinessStatus[];
  salesRepId?: string;
  isOnline?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// SECTION 6: MODULE TYPES
// ============================================================================

/** All supported module keys — must match BusinessModule.moduleKey in DB */
export type ModuleKey =
  | 'grocery'
  | 'restaurant'
  | 'pharmacy'
  | 'car_wash'
  | 'laundry'
  | 'home_services'
  | 'ecommerce'
  | 'cosmetics'
  | 'meat_delivery'
  | 'furniture'
  | 'directory';

/** Module configuration from the registry */
export interface ModuleConfig {
  name: string;
  description: string;
  features: string[];
  defaultConfig: Record<string, unknown>;
}

/** Business module info from DB + registry */
export interface BusinessModuleInfo {
  id: string;
  moduleKey: ModuleKey;
  moduleName: string;
  version: string;
  status: ModuleStatus;
  config: Record<string, unknown>;
  enabledAt: Date | null;
  disabledAt: Date | null;
}

// ============================================================================
// SECTION 7: PERMISSION TYPE
// ============================================================================

/** Permission string — format: "module:action" (e.g., "order:read", "business:write") */
export type Permission = string;

/** Permission group by module */
export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

/** Role-to-permission mapping */
export interface RolePermissionMap {
  [role: string]: Permission[];
}

// ============================================================================
// SECTION 8: CART TYPES
// ============================================================================

/** Cart item for online ordering */
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

/** Full cart for online ordering */
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

/** POS-specific cart item with additional billing fields */
export interface POSCartItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  discountPrice?: number;
  discountPercent?: number;
  gstRate: number;
  gstAmount: number;
  totalPrice: number;
  isVeg?: boolean;
  unit?: string;
}

/** POS cart summary with tax breakdown */
export interface POSCartSummary {
  items: POSCartItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  deliveryFee: number;
  packagingFee: number;
  convenienceFee: number;
  roundOff: number;
  totalAmount: number;
  itemCount: number;
}

// ============================================================================
// SECTION 9: DASHBOARD TYPES
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

export interface PlatformDashboardStats extends DashboardStats {
  totalBusinesses: number;
  activeBusinesses: number;
  onboardingBusinesses: number;
  totalRevenue: number;
  mrr: number; // Monthly recurring revenue
  activeLeads: number;
  leadsConvertedThisMonth: number;
  churnedBusinesses: number;
  demoTenantsInUse: number;
}

export interface BusinessStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  activeStores: number;
  totalProducts: number;
  totalDeliveryPartners: number;
  avgOrderValue: number;
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

// ============================================================================
// SECTION 10: GST BREAKDOWN TYPE
// ============================================================================

/** GST calculation result */
export interface GSTBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

// ============================================================================
// SECTION 11: DELIVERY ZONE CONFIG TYPES
// ============================================================================

export interface DeliveryZoneCircle {
  zoneType: 'CIRCLE';
  centerLat: number;
  centerLng: number;
  radius: number;
}

export interface DeliveryZonePolygon {
  zoneType: 'POLYGON';
  polygon: string; // GeoJSON string
}

export interface DeliveryZonePincode {
  zoneType: 'PINCODE';
  pincodes: string[];
}

export type DeliveryZoneConfig = DeliveryZoneCircle | DeliveryZonePolygon | DeliveryZonePincode;

// ============================================================================
// SECTION 12: SESSION / AUTH TYPES
// ============================================================================

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar: string | null;
  role: Role;
  businessId?: string;
  businessName?: string;
  businessType?: BusinessType;
  businessSlug?: string;
  storeId?: string;
  permissions: Permission[];
  isPlatformAdmin: boolean;
}

// ============================================================================
// SECTION 13: MODEL LIST ITEM TYPES (Lightweight for frontend use)
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
  subscriptionStatus?: SubscriptionStatus;
  domain?: string | null;
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
  posEnabled: boolean;
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

export interface LeadListItem {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessType: BusinessType;
  source: LeadSource;
  stage: LeadStage;
  estimatedValue: number | null;
  salesRepId: string | null;
  salesRepName?: string | null;
  convertedBusinessId: string | null;
  followUpDate: string | null;
  createdAt: string;
}

// ============================================================================
// SECTION 14: DEPLOYMENT / DOMAIN TYPES
// ============================================================================

export interface DeploymentInfo {
  id: string;
  type: DeploymentType;
  status: DeploymentStatus;
  environment: string;
  hostingProvider: string;
  liveUrl: string | null;
  version: string | null;
  healthStatus: string;
  deployedAt: string | null;
}

export interface DomainInfo {
  id: string;
  domain: string;
  subdomain: string | null;
  status: DomainStatus;
  sslStatus: string;
  isPrimary: boolean;
  configuredAt: string | null;
}

// ============================================================================
// SECTION 15: ORDER ENGINE TYPES
// ============================================================================

/** Order item input for creating orders */
export interface OrderItemInput {
  itemType: string;
  itemId: string;
  itemName: string;
  variantName?: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  discountPrice?: number;
  discountPercent?: number;
  gstRate?: number;
  isVeg?: boolean;
  unit?: string;
  specialInstructions?: string;
  customizations?: string;
  metadata?: string;
}

/** Order totals calculated from items */
export interface OrderTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  deliveryFee: number;
  packagingFee: number;
  convenienceFee: number;
  tip: number;
  roundOff: number;
  totalAmount: number;
}

/** Status transition map for order state machine */
export interface OrderStatusTransitions {
  [status: string]: string[];
}

/** Parameters for creating an order */
export interface CreateOrderParams {
  businessId: string;
  storeId: string;
  orderType: string;
  orderSource?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddressId?: string;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryInstructions?: string;
  scheduledAt?: Date;
  pickupAddress?: string;
  pickupScheduledAt?: Date;
  paymentMethod?: string;
  deliveryFee?: number;
  packagingFee?: number;
  convenienceFee?: number;
  tip?: number;
  posSessionId?: string;
  posOperatorId?: string;
  tableNumber?: string;
  subscriptionId?: string;
  promoCodeId?: string;
  notes?: string;
  metadata?: string;
  items: OrderItemInput[];
}

// ============================================================================
// SECTION 16: ONBOARDING TYPES
// ============================================================================

export interface OnboardingStepInfo {
  id: string;
  stepKey: string;
  stepName: string;
  status: OnboardingStepStatus;
  completedAt: Date | null;
  notes: string | null;
}

export interface OnboardingProgress {
  businessId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string | null;
  progress: number; // 0-100 percentage
  steps: OnboardingStepInfo[];
}

// ============================================================================
// SECTION 17: DEMO TENANT TYPES
// ============================================================================

export interface DemoTenantInfo {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  status: DemoTenantStatus;
  leadId: string | null;
  leadName: string | null;
  accessUrl: string;
  expiresAt: Date | null;
}

// ============================================================================
// SECTION 18: BUSINESS TYPE MODULE DEFAULTS
// ============================================================================

export interface BusinessTypeModuleDefaults {
  moduleKey: string;
  moduleName: string;
  status: ModuleStatus;
}
