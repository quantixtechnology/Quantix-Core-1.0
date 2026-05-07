// ============================================================================
// Quantix Technology — Platform Constants
// MANAGED PLATFORM: All 11 business verticals
// ============================================================================

import type {
  BusinessType,
  BusinessStatus,
  OrderStatus,
  PaymentMethod,
  Role,
  SubscriptionServiceType,
  SubscriptionBillingCycle,
  SubscriptionStatus,
  DeliveryStatus,
  TaxType,
  LeadSource,
  LeadStage,
  PlanBillingCycle,
  DomainStatus,
  DeploymentStatus,
  DeploymentType,
} from './types';

// ============================================================================
// BUSINESS TYPES — All 11 categories
// ============================================================================

export const BUSINESS_TYPES: Record<BusinessType, { label: string; icon: string; description: string; color: string }> = {
  GROCERY: {
    label: 'Grocery Store',
    icon: 'ShoppingCart',
    description: 'Online grocery delivery with real-time inventory',
    color: '#10B981',
  },
  FOOD_DELIVERY: {
    label: 'Food Delivery',
    icon: 'UtensilsCrossed',
    description: 'Restaurant food delivery and takeout platform',
    color: '#F59E0B',
  },
  LAUNDRY: {
    label: 'Laundry Service',
    icon: 'Shirt',
    description: 'Pickup & delivery laundry and dry cleaning',
    color: '#3B82F6',
  },
  CAR_WASH: {
    label: 'Car Wash',
    icon: 'Car',
    description: 'On-demand car wash and detailing services',
    color: '#8B5CF6',
  },
  PHARMACY: {
    label: 'Pharmacy',
    icon: 'Pill',
    description: 'Online pharmacy with prescription delivery',
    color: '#EF4444',
  },
  HOME_SERVICES: {
    label: 'Home Services',
    icon: 'Home',
    description: 'Professional home cleaning, repair & maintenance',
    color: '#F97316',
  },
  ECOMMERCE: {
    label: 'E-Commerce',
    icon: 'Package',
    description: 'Multi-category online store with delivery',
    color: '#06B6D4',
  },
  COSMETICS: {
    label: 'Cosmetics & Beauty',
    icon: 'Sparkles',
    description: 'Beauty products and cosmetic services',
    color: '#EC4899',
  },
  MEAT_DELIVERY: {
    label: 'Meat Delivery',
    icon: 'Beef',
    description: 'Fresh meat and seafood delivery',
    color: '#DC2626',
  },
  FURNITURE: {
    label: 'Furniture',
    icon: 'Sofa',
    description: 'Furniture and home décor with delivery & assembly',
    color: '#92400E',
  },
  DIRECTORY: {
    label: 'Business Directory',
    icon: 'LayoutGrid',
    description: 'Local business directory and listing platform',
    color: '#6366F1',
  },
};

// ============================================================================
// BUSINESS STATUSES
// ============================================================================

export const BUSINESS_STATUSES: Record<BusinessStatus, { label: string; color: string; bgColor: string; description: string }> = {
  ONBOARDING: { label: 'Onboarding', color: '#F59E0B', bgColor: '#FEF3C7', description: 'Being set up by Quantix after payment verified' },
  ACTIVE: { label: 'Active', color: '#10B981', bgColor: '#D1FAE5', description: 'Live and operational' },
  SUSPENDED: { label: 'Suspended', color: '#EF4444', bgColor: '#FEE2E2', description: 'Payment failure / policy violation' },
  CHURNED: { label: 'Churned', color: '#6B7280', bgColor: '#F3F4F6', description: 'Cancelled / left the platform' },
};

// ============================================================================
// ROLES
// ============================================================================

export const ROLES: Record<Role, { label: string; description: string; level: number; scope: 'platform' | 'business' }> = {
  QUANTIX_SUPER_ADMIN: {
    label: 'Quantix Super Admin',
    description: 'Full platform access — creates businesses, deploys, manages pricing',
    level: 100,
    scope: 'platform',
  },
  QUANTIX_SALES_TEAM: {
    label: 'Quantix Sales Team',
    description: 'Lead management, onboarding tracking, follow-ups, renewal tracking',
    level: 90,
    scope: 'platform',
  },
  CLIENT_OWNER: {
    label: 'Client Owner',
    description: 'Business owner — manages products, orders, delivery, POS, staff, reports',
    level: 80,
    scope: 'business',
  },
  STORE_MANAGER: {
    label: 'Store Manager',
    description: 'Store operations, order handling, inventory management',
    level: 60,
    scope: 'business',
  },
  DELIVERY_STAFF: {
    label: 'Delivery Staff',
    description: 'Assigned deliveries, pickup/delivery, OTP verification, route navigation',
    level: 30,
    scope: 'business',
  },
  CUSTOMER: {
    label: 'Customer',
    description: 'Place orders, subscriptions, tracking, payments',
    level: 10,
    scope: 'business',
  },
};

// ============================================================================
// ORDER STATUSES — Extended with pickup & delivery specific
// ============================================================================

export const ORDER_STATUSES: Record<OrderStatus, { label: string; color: string; bgColor: string; description: string }> = {
  PENDING: { label: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7', description: 'Order placed, awaiting confirmation' },
  CONFIRMED: { label: 'Confirmed', color: '#3B82F6', bgColor: '#DBEAFE', description: 'Order confirmed by the store' },
  PREPARING: { label: 'Preparing', color: '#8B5CF6', bgColor: '#EDE9FE', description: 'Order is being prepared' },
  READY_FOR_PICKUP: { label: 'Ready for Pickup', color: '#06B6D4', bgColor: '#CFFAFE', description: 'Order is ready for pickup/delivery' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#F97316', bgColor: '#FFEDD5', description: 'Order is on its way' },
  DELIVERED: { label: 'Delivered', color: '#10B981', bgColor: '#D1FAE5', description: 'Order has been delivered' },
  CANCELLED: { label: 'Cancelled', color: '#EF4444', bgColor: '#FEE2E2', description: 'Order has been cancelled' },
  REFUNDED: { label: 'Refunded', color: '#6B7280', bgColor: '#F3F4F6', description: 'Order has been refunded' },
  SCHEDULED: { label: 'Scheduled', color: '#6366F1', bgColor: '#E0E7FF', description: 'Order scheduled for future delivery' },
  PICKUP_ASSIGNED: { label: 'Pickup Assigned', color: '#7C3AED', bgColor: '#EDE9FE', description: 'Pickup partner assigned (Laundry)' },
  PICKED_UP: { label: 'Picked Up', color: '#2563EB', bgColor: '#DBEAFE', description: 'Items picked up from customer' },
  PROCESSING: { label: 'Processing', color: '#D97706', bgColor: '#FEF3C7', description: 'Items being processed (Laundry)' },
  READY_FOR_DELIVERY: { label: 'Ready for Delivery', color: '#059669', bgColor: '#D1FAE5', description: 'Processed items ready for return delivery' },
};

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string; description: string }> = {
  CASH: { label: 'Cash', icon: 'Banknote', description: 'Cash payment at counter or delivery' },
  CARD: { label: 'Card', icon: 'CreditCard', description: 'Debit or credit card payment' },
  UPI: { label: 'UPI', icon: 'Smartphone', description: 'Unified Payments Interface' },
  NETBANKING: { label: 'Net Banking', icon: 'Building2', description: 'Internet banking transfer' },
  WALLET: { label: 'Wallet', icon: 'Wallet', description: 'Digital wallet payment' },
  COD: { label: 'Cash on Delivery', icon: 'Package', description: 'Pay on delivery' },
  CREDIT: { label: 'Store Credit', icon: 'Coins', description: 'Store credit / loyalty points' },
};

// ============================================================================
// LEAD SOURCES
// ============================================================================

export const LEAD_SOURCES: Record<LeadSource, { label: string; icon: string; description: string }> = {
  META_ADS: { label: 'Meta Ads', icon: 'Facebook', description: 'Facebook/Instagram advertising' },
  GOOGLE_ADS: { label: 'Google Ads', icon: 'Search', description: 'Google search/display advertising' },
  DIRECT_REFERRAL: { label: 'Direct Referral', icon: 'UserPlus', description: 'Word of mouth or existing client referral' },
  WEBSITE_INQUIRY: { label: 'Website Inquiry', icon: 'Globe', description: 'Contact form on quantixtechnology.in' },
  COLD_OUTREACH: { label: 'Cold Outreach', icon: 'Phone', description: 'Outbound sales calls/emails' },
  WHATSAPP_INQUIRY: { label: 'WhatsApp Inquiry', icon: 'MessageCircle', description: 'WhatsApp business inquiry' },
  PHONE_CALL: { label: 'Phone Call', icon: 'PhoneCall', description: 'Inbound phone call' },
  OTHER: { label: 'Other', icon: 'MoreHorizontal', description: 'Other source' },
};

// ============================================================================
// LEAD STATUSES
// ============================================================================

export const LEAD_STAGES: Record<LeadStage, { label: string; color: string; bgColor: string; description: string }> = {
  LEAD: { label: 'Lead', color: '#3B82F6', bgColor: '#DBEAFE', description: 'New lead received' },
  DEMO_SHARED: { label: 'Demo Shared', color: '#8B5CF6', bgColor: '#EDE9FE', description: 'Demo credentials shared with prospect' },
  NEGOTIATION: { label: 'Negotiation', color: '#F97316', bgColor: '#FFEDD5', description: 'Actively negotiating terms' },
  PAYMENT_PENDING: { label: 'Payment Pending', color: '#F59E0B', bgColor: '#FEF3C7', description: 'Awaiting payment from prospect' },
  PAYMENT_RECEIVED: { label: 'Payment Received', color: '#06B6D4', bgColor: '#CFFAFE', description: 'Payment verified — ready to onboard' },
  ONBOARDING: { label: 'Onboarding', color: '#6366F1', bgColor: '#E0E7FF', description: 'Business being set up by Quantix' },
  DEPLOYMENT: { label: 'Deployment', color: '#3B82F6', bgColor: '#DBEAFE', description: 'App being deployed and configured' },
  ACTIVE: { label: 'Active', color: '#10B981', bgColor: '#D1FAE5', description: 'Client live and operational' },
  LOST: { label: 'Lost', color: '#EF4444', bgColor: '#FEE2E2', description: 'Deal lost' },
  CHURNED: { label: 'Churned', color: '#6B7280', bgColor: '#F3F4F6', description: 'Client left the platform' },
};

// ============================================================================
// SUBSCRIPTION STATUSES (Platform/Business subscriptions)
// ============================================================================

export const SUBSCRIPTION_STATUSES: Record<SubscriptionStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Active', color: '#10B981', bgColor: '#D1FAE5' },
  PAST_DUE: { label: 'Past Due', color: '#F59E0B', bgColor: '#FEF3C7' },
  SUSPENDED: { label: 'Suspended', color: '#EF4444', bgColor: '#FEE2E2' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280', bgColor: '#F3F4F6' },
  EXPIRED: { label: 'Expired', color: '#9CA3AF', bgColor: '#F3F4F6' },
};

// ============================================================================
// PLAN BILLING CYCLES — Only 2 fixed plans
// ============================================================================

export const PLAN_BILLING_CYCLES: Record<PlanBillingCycle, { label: string; price: number; description: string; color: string }> = {
  MONTHLY: { label: 'Monthly', price: 4999, description: '₹4,999/month', color: '#10B981' },
  YEARLY: { label: 'Yearly', price: 49999, description: '₹49,999/year — Save ₹9,989!', color: '#8B5CF6' },
};

// ============================================================================
// SUBSCRIPTION SERVICE TYPES (Business's own plans)
// ============================================================================

export const SUBSCRIPTION_SERVICE_TYPES: Record<SubscriptionServiceType, { label: string; description: string; icon: string }> = {
  CAR_WASH: { label: 'Car Wash Plans', description: 'Monthly car wash packages', icon: 'Car' },
  HOME_SERVICE: { label: 'Home Service Plans', description: 'Recurring home services', icon: 'Home' },
  LAUNDRY: { label: 'Laundry Plans', description: 'Monthly laundry plans', icon: 'Shirt' },
  GROCERY: { label: 'Grocery Plans', description: 'Recurring grocery deliveries', icon: 'ShoppingCart' },
  CUSTOM: { label: 'Custom Plans', description: 'Custom subscription plans', icon: 'Settings' },
};

// ============================================================================
// SUBSCRIPTION BILLING CYCLES
// ============================================================================

export const BILLING_CYCLES: Record<SubscriptionBillingCycle, { label: string; days: number; description: string }> = {
  WEEKLY: { label: 'Weekly', days: 7, description: 'Billed every week' },
  MONTHLY: { label: 'Monthly', days: 30, description: 'Billed every month' },
  QUARTERLY: { label: 'Quarterly', days: 90, description: 'Billed every 3 months' },
  HALF_YEARLY: { label: 'Half-Yearly', days: 180, description: 'Billed every 6 months' },
  YEARLY: { label: 'Yearly', days: 365, description: 'Billed every year' },
};

// ============================================================================
// DELIVERY STATUSES
// ============================================================================

export const DELIVERY_STATUSES: Record<DeliveryStatus, { label: string; color: string; bgColor: string }> = {
  ASSIGNING: { label: 'Assigning', color: '#6B7280', bgColor: '#F3F4F6' },
  ASSIGNED: { label: 'Assigned', color: '#3B82F6', bgColor: '#DBEAFE' },
  PICKED_UP: { label: 'Picked Up', color: '#8B5CF6', bgColor: '#EDE9FE' },
  ON_THE_WAY: { label: 'On the Way', color: '#F97316', bgColor: '#FFEDD5' },
  ARRIVED: { label: 'Arrived', color: '#06B6D4', bgColor: '#CFFAFE' },
  DELIVERED: { label: 'Delivered', color: '#10B981', bgColor: '#D1FAE5' },
  FAILED: { label: 'Failed', color: '#EF4444', bgColor: '#FEE2E2' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280', bgColor: '#F3F4F6' },
};

// ============================================================================
// DOMAIN STATUSES
// ============================================================================

export const DOMAIN_STATUSES: Record<DomainStatus, { label: string; color: string; bgColor: string; description: string }> = {
  PENDING_DNS: { label: 'Pending DNS', color: '#6B7280', bgColor: '#F3F4F6', description: 'DNS not configured yet' },
  DNS_PROPAGATING: { label: 'DNS Propagating', color: '#F59E0B', bgColor: '#FEF3C7', description: 'DNS configured, waiting for propagation' },
  SSL_PENDING: { label: 'SSL Pending', color: '#3B82F6', bgColor: '#DBEAFE', description: 'DNS resolved, SSL being provisioned' },
  ACTIVE: { label: 'Active', color: '#10B981', bgColor: '#D1FAE5', description: 'Live with HTTPS' },
  ERROR: { label: 'Error', color: '#EF4444', bgColor: '#FEE2E2', description: 'Configuration error' },
};

// ============================================================================
// DEPLOYMENT STATUSES
// ============================================================================

export const DEPLOYMENT_STATUSES: Record<DeploymentStatus, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pending', color: '#6B7280', bgColor: '#F3F4F6' },
  BUILDING: { label: 'Building', color: '#F59E0B', bgColor: '#FEF3C7' },
  DEPLOYING: { label: 'Deploying', color: '#3B82F6', bgColor: '#DBEAFE' },
  LIVE: { label: 'Live', color: '#10B981', bgColor: '#D1FAE5' },
  FAILED: { label: 'Failed', color: '#EF4444', bgColor: '#FEE2E2' },
  MAINTENANCE: { label: 'Maintenance', color: '#8B5CF6', bgColor: '#EDE9FE' },
};

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

export const DEPLOYMENT_TYPES: Record<DeploymentType, { label: string; icon: string }> = {
  WEBSITE: { label: 'Website', icon: 'Globe' },
  ADMIN_DASHBOARD: { label: 'Admin Dashboard', icon: 'LayoutDashboard' },
  CUSTOMER_APP: { label: 'Customer App', icon: 'Smartphone' },
  DELIVERY_APP: { label: 'Delivery App', icon: 'Truck' },
  ADMIN_APP: { label: 'Admin App', icon: 'Tablet' },
};

// ============================================================================
// INDIAN GST TAX RATES
// ============================================================================

export const TAX_RATES: Record<TaxType, { label: string; totalRate: number; cgstRate: number; sgstRate: number; igstRate: number; hsnExample: string }> = {
  GST_0: { label: 'GST 0% (Exempt)', totalRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, hsnExample: '0101' },
  GST_5: { label: 'GST 5%', totalRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, hsnExample: '0201' },
  GST_12: { label: 'GST 12%', totalRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, hsnExample: '1701' },
  GST_18: { label: 'GST 18%', totalRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnExample: '2106' },
  GST_28: { label: 'GST 28%', totalRate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28, hsnExample: '2402' },
  CUSTOM: { label: 'Custom Rate', totalRate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, hsnExample: '' },
};

// ============================================================================
// PAPER SIZES (Thermal Printers)
// ============================================================================

export const PAPER_SIZES = [
  { value: '58mm', label: '58mm (Mini Thermal)', description: 'Small portable printers' },
  { value: '80mm', label: '80mm (Standard Thermal)', description: 'Standard POS printers' },
  { value: 'A4', label: 'A4 (Laser/Inkjet)', description: 'Full-page printers' },
] as const;

// ============================================================================
// PRICING PLANS — Quantix Platform Pricing (Only 2 fixed plans)
// ============================================================================

export const PRICING_PLANS = [
  {
    billingCycle: 'MONTHLY' as PlanBillingCycle,
    name: 'Quantix Monthly',
    price: 4999,
    description: 'Monthly subscription — ₹4,999/month',
    features: ['Up to 5 Stores', '5,000 Products', '10,000 Orders/month', '50 Delivery Partners', '50 Staff', 'Full POS Suite', 'Delivery Management', 'Subscription Plans', 'Custom Domain', 'White Label Branding', 'Advanced Reports', 'API Access', 'Priority Support'],
    maxStores: 5,
    maxProducts: 5000,
    maxOrders: 10000,
    maxDeliveryPartners: 50,
    maxStaff: 50,
    hasPOS: true,
    hasDelivery: true,
    hasSubscription: true,
    hasCustomDomain: true,
    hasWhiteLabel: true,
    hasAdvancedReports: true,
    hasAPIAccess: true,
  },
  {
    billingCycle: 'YEARLY' as PlanBillingCycle,
    name: 'Quantix Yearly',
    price: 49999,
    description: 'Annual subscription — ₹49,999/year (Save ₹9,989!)',
    features: ['Up to 5 Stores', '5,000 Products', '10,000 Orders/month', '50 Delivery Partners', '50 Staff', 'Full POS Suite', 'Delivery Management', 'Subscription Plans', 'Custom Domain', 'White Label Branding', 'Advanced Reports', 'API Access', 'Priority Support', '2 Months Free'],
    maxStores: 5,
    maxProducts: 5000,
    maxOrders: 10000,
    maxDeliveryPartners: 50,
    maxStaff: 50,
    hasPOS: true,
    hasDelivery: true,
    hasSubscription: true,
    hasCustomDomain: true,
    hasWhiteLabel: true,
    hasAdvancedReports: true,
    hasAPIAccess: true,
  },
] as const;

// ============================================================================
// HOSTING PROVIDERS
// ============================================================================

export const HOSTING_PROVIDERS = [
  { value: 'replit', label: 'Replit', icon: 'Cloud', description: 'Replit deployment' },
  { value: 'vercel', label: 'Vercel', icon: 'Triangle', description: 'Vercel deployment' },
  { value: 'aws', label: 'AWS', icon: 'Server', description: 'Amazon Web Services' },
  { value: 'digitalocean', label: 'DigitalOcean', icon: 'Droplets', description: 'DigitalOcean droplets' },
] as const;

// ============================================================================
// ORDER TYPE CONFIGURATION PER BUSINESS TYPE
// ============================================================================

export const ORDER_TYPE_CONFIG: Record<BusinessType, { supportedTypes: string[]; defaultType: string; hasDelivery: boolean; hasPickup: boolean; hasDineIn: boolean; hasPOS: boolean; hasSubscription: boolean; hasPickupAndDelivery: boolean }> = {
  GROCERY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
  FOOD_DELIVERY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'DINE_IN', 'POS'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: true, hasPOS: true, hasSubscription: false, hasPickupAndDelivery: false,
  },
  LAUNDRY: {
    supportedTypes: ['PICKUP_AND_DELIVERY', 'POS', 'SUBSCRIPTION'],
    defaultType: 'PICKUP_AND_DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: true,
  },
  CAR_WASH: {
    supportedTypes: ['PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'PICKUP',
    hasDelivery: false, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
  PHARMACY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
  HOME_SERVICES: {
    supportedTypes: ['DELIVERY', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: false, hasDineIn: false, hasPOS: false, hasSubscription: true, hasPickupAndDelivery: false,
  },
  ECOMMERCE: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: false, hasPickupAndDelivery: false,
  },
  COSMETICS: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
  MEAT_DELIVERY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
  FURNITURE: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS'],
    defaultType: 'DELIVERY',
    hasDelivery: true, hasPickup: true, hasDineIn: false, hasPOS: true, hasSubscription: false, hasPickupAndDelivery: false,
  },
  DIRECTORY: {
    supportedTypes: ['POS'],
    defaultType: 'POS',
    hasDelivery: false, hasPickup: false, hasDineIn: false, hasPOS: true, hasSubscription: true, hasPickupAndDelivery: false,
  },
};

// ============================================================================
// PLATFORM CONSTANTS
// ============================================================================

export const PLATFORM = {
  NAME: 'Quantix Technology',
  TAGLINE: 'Run Your Business Smarter',
  WEBSITE: 'www.quantixtechnology.in',
  VERSION: '2.0.0',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_LOCALE: 'en-IN',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DEFAULT_COUNTRY: 'India',
  DEFAULT_PRIMARY_COLOR: '#10B981',
  DEFAULT_DELIVERY_RADIUS_KM: 5,
  DEFAULT_PREPARATION_TIME_MIN: 30,
  DEFAULT_MIN_ORDER_AMOUNT: 0,
  DEFAULT_DELIVERY_FEE: 0,
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MINUTES: 15,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  // NO TRIAL — business created ONLY after payment verified
} as const;

// ============================================================================
// INDIAN STATES (for GST place of supply)
// ============================================================================

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export const INDIAN_STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR', 'Assam': 'AS', 'Bihar': 'BR',
  'Chhattisgarh': 'CG', 'Goa': 'GA', 'Gujarat': 'GJ', 'Haryana': 'HR',
  'Himachal Pradesh': 'HP', 'Jharkhand': 'JH', 'Karnataka': 'KA', 'Kerala': 'KL',
  'Madhya Pradesh': 'MP', 'Maharashtra': 'MH', 'Manipur': 'MN', 'Meghalaya': 'ML',
  'Mizoram': 'MZ', 'Nagaland': 'NL', 'Odisha': 'OD', 'Punjab': 'PB',
  'Rajasthan': 'RJ', 'Sikkim': 'SK', 'Tamil Nadu': 'TN', 'Telangana': 'TS',
  'Tripura': 'TR', 'Uttar Pradesh': 'UP', 'Uttarakhand': 'UK', 'West Bengal': 'WB',
  'Andaman and Nicobar Islands': 'AN', 'Chandigarh': 'CH',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN', 'Delhi': 'DL',
  'Jammu and Kashmir': 'JK', 'Ladakh': 'LA', 'Lakshadweep': 'LD', 'Puducherry': 'PY',
};

// ============================================================================
// PRODUCT UNITS
// ============================================================================

export const PRODUCT_UNITS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'ltr', label: 'Litre (ltr)' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'piece', label: 'Piece' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'bunch', label: 'Bunch' },
  { value: 'box', label: 'Box' },
  { value: 'set', label: 'Set' },
  { value: 'service', label: 'Service' },
  { value: 'hour', label: 'Hour' },
  { value: 'session', label: 'Session' },
] as const;

// ============================================================================
// WEEK DAYS
// ============================================================================

export const WEEK_DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;
