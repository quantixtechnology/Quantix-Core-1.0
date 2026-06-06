// ============================================================================
// Quantix Technology — Managed White-Label Multi-Tenant SaaS Platform
// "Run Your Business Smarter"
// www.quantixtechnology.in
//
// ARCHITECTURE PRINCIPLE:
// This is a MANAGED platform. Customers CANNOT self-signup or create businesses.
// ONLY Quantix Super Admin creates, configures, and deploys businesses.
// Clients receive login access AFTER payment verification and deployment.
// NO free trial, NO self-onboarding, NO public business creation.
// ============================================================================

// ============================================================================
// ENUM TYPES (matching Prisma schema exactly)
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

/** Business lifecycle status — managed by Quantix, NO TRIAL */
export type BusinessStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED';

/** Platform roles for the MANAGED model */
export type Role =
  // Core platform team
  | 'QUANTIX_SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  // Named platform roles
  | 'SALES_MANAGER'
  | 'BD_EXECUTIVE'
  | 'HR_ADMIN'
  | 'FINANCE_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'SUPPORT_MANAGER'
  | 'READ_ONLY_AUDITOR'
  // Legacy team roles
  | 'QUANTIX_SALES_TEAM'
  | 'SUPPORT_TEAM'
  | 'DEPLOYMENT_TEAM'
  | 'FINANCE_TEAM'
  // Business staff (stored on BusinessUser.role)
  | 'CLIENT_OWNER'
  | 'STORE_MANAGER'
  | 'STORE_OPERATOR'
  | 'BILLING_STAFF'
  | 'INVENTORY_STAFF'
  | 'SUPPORT_STAFF'
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

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'COD' | 'CREDIT' | 'MIXED';

export type DeliveryStatus = 'ASSIGNING' | 'ASSIGNED' | 'PICKED_UP' | 'ON_THE_WAY' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

/** Subscription service types for car wash, home services etc. */
export type SubscriptionServiceType = 'CAR_WASH' | 'HOME_SERVICE' | 'LAUNDRY' | 'GROCERY' | 'CUSTOM';

/** Subscription billing cycles for customer-facing plans */
export type SubscriptionBillingCycle = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

/** Customer subscription status — NO TRIAL */
export type CustomerSubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

/** Platform (business) subscription status — NO TRIAL, managed by Quantix */
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

/** Platform plan billing cycle — ONLY MONTHLY and YEARLY */
export type PlanBillingCycle = 'MONTHLY' | 'YEARLY';

export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ARCHIVED';
export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';
export type TaxType = 'GST_0' | 'GST_5' | 'GST_12' | 'GST_18' | 'GST_28' | 'CUSTOM';
export type PromoType = 'PERCENTAGE' | 'FLAT' | 'FREE_DELIVERY' | 'BOGO';
export type InvoiceType = 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'RECEIPT';
export type NotificationType = 'ORDER_STATUS' | 'DELIVERY_UPDATE' | 'PROMOTION' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';

/** Notification channels — NO SMS, only Push, WhatsApp, Email, In-App */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';

export type POSSessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type ZoneType = 'CIRCLE' | 'POLYGON' | 'PINCODE';
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

/** Lead lifecycle stages — sales pipeline only */
export type LeadStage =
  | 'LEAD'
  | 'FOLLOW_UP'
  | 'INTERESTED'
  | 'HOT_LEAD'
  | 'NOT_INTERESTED'
  | 'WRONG_NUMBER'
  | 'RNR'
  | 'DEMO_PLANNED'
  | 'DEMO_DONE'
  | 'NEGOTIATION'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RECEIVED'
  | 'CLOSED_WON'
  | 'LOST'
  | 'DUPLICATE';

/** Demo tenant status for prospect demos */
export type DemoTenantStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DISABLED';

/** Onboarding step status for business setup tracking */
export type OnboardingStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

/** Business module status — NO TRIAL */
export type ModuleStatus = 'DISABLED' | 'ENABLED';

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
}

export interface UpdateBusinessRequest extends Partial<CreateBusinessRequest> {
  status?: BusinessStatus;
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
  notificationConfig?: Record<string, unknown>;
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

export interface CreateSubscriptionPlanRequest {
  name: string;
  slug: string;
  description?: string;
  serviceType: SubscriptionServiceType;
  billingCycle: SubscriptionBillingCycle;
  price: number;
  originalPrice?: number;
  setupFee?: number;
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

export interface CreateLeadRequest {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  businessType: BusinessType;
  source?: LeadSource;
  notes?: string;
  followUpDate?: string;
  estimatedValue?: number;
  salesRepId?: string;
  tags?: string[];
}

export interface DomainMappingRequest {
  domain: string;
  subdomain?: string;
  isPrimary?: boolean;
  dnsProvider?: string;
  dnsConfig?: Record<string, unknown>;
  notes?: string;
}

export interface DeploymentRequest {
  type: DeploymentType;
  environment?: 'production' | 'staging';
  hostingProvider?: string;
  hostingConfig?: Record<string, unknown>;
  version?: string;
  notes?: string;
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
  storeId?: string;
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

export interface LeadFilter {
  stage?: LeadStage | LeadStage[];
  source?: LeadSource | LeadSource[];
  businessType?: BusinessType | BusinessType[];
  salesRepId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
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
  isPlatformAdmin: boolean;
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
// SESSION / AUTH TYPES
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
  hasPassword?: boolean;
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
  polygon: string; // GeoJSON string
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
// DEPLOYMENT / DOMAIN TYPES
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
// ONBOARDING TYPES
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
// DEMO TENANT TYPES
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
