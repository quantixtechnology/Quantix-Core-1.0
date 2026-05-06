// ============================================================================
// Quantix Technology - Platform Constants
// ============================================================================

import type {
  BusinessType,
  OrderStatus,
  PaymentMethod,
  Role,
  SubscriptionType,
  BillingCycle,
  DeliveryStatus,
  TaxType,
} from './types';

// ============================================================================
// BUSINESS TYPES
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
  HOME_SERVICES: {
    label: 'Home Services',
    icon: 'Home',
    description: 'Professional home cleaning, repair & maintenance',
    color: '#EF4444',
  },
};

// ============================================================================
// ORDER STATUSES
// ============================================================================

export const ORDER_STATUSES: Record<OrderStatus, { label: string; color: string; bgColor: string; description: string }> = {
  PENDING: {
    label: 'Pending',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    description: 'Order placed, awaiting confirmation',
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    description: 'Order confirmed by the store',
  },
  PREPARING: {
    label: 'Preparing',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    description: 'Order is being prepared',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
    description: 'Order is ready for pickup/delivery',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    color: '#F97316',
    bgColor: '#FFEDD5',
    description: 'Order is on its way',
  },
  DELIVERED: {
    label: 'Delivered',
    color: '#10B981',
    bgColor: '#D1FAE5',
    description: 'Order has been delivered',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    description: 'Order has been cancelled',
  },
  REFUNDED: {
    label: 'Refunded',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    description: 'Order has been refunded',
  },
  SCHEDULED: {
    label: 'Scheduled',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    description: 'Order scheduled for future delivery',
  },
};

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string; description: string }> = {
  CASH: {
    label: 'Cash',
    icon: 'Banknote',
    description: 'Cash payment at counter or delivery',
  },
  CARD: {
    label: 'Card',
    icon: 'CreditCard',
    description: 'Debit or credit card payment',
  },
  UPI: {
    label: 'UPI',
    icon: 'Smartphone',
    description: 'Unified Payments Interface',
  },
  NETBANKING: {
    label: 'Net Banking',
    icon: 'Building2',
    description: 'Internet banking transfer',
  },
  WALLET: {
    label: 'Wallet',
    icon: 'Wallet',
    description: 'Digital wallet payment',
  },
  COD: {
    label: 'Cash on Delivery',
    icon: 'Package',
    description: 'Pay on delivery',
  },
  CREDIT: {
    label: 'Store Credit',
    icon: 'Coins',
    description: 'Store credit / loyalty points',
  },
};

// ============================================================================
// ROLES
// ============================================================================

export const ROLES: Record<Role, { label: string; description: string; level: number }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Platform administrator with full access',
    level: 100,
  },
  BUSINESS_OWNER: {
    label: 'Business Owner',
    description: 'Business owner with full business access',
    level: 90,
  },
  BUSINESS_ADMIN: {
    label: 'Business Admin',
    description: 'Business administrator',
    level: 80,
  },
  STORE_MANAGER: {
    label: 'Store Manager',
    description: 'Manages a specific store',
    level: 70,
  },
  STORE_STAFF: {
    label: 'Store Staff',
    description: 'Store staff with limited access',
    level: 50,
  },
  CASHIER: {
    label: 'Cashier',
    description: 'POS cashier',
    level: 40,
  },
  DELIVERY_MANAGER: {
    label: 'Delivery Manager',
    description: 'Manages delivery operations',
    level: 60,
  },
  DELIVERY_PARTNER: {
    label: 'Delivery Partner',
    description: 'Delivery driver/rider',
    level: 30,
  },
  CUSTOMER: {
    label: 'Customer',
    description: 'End customer',
    level: 10,
  },
};

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export const SUBSCRIPTION_TYPES: Record<SubscriptionType, { label: string; description: string; icon: string }> = {
  CAR_WASH: {
    label: 'Car Wash Plans',
    description: 'Monthly car wash packages',
    icon: 'Car',
  },
  HOME_SERVICE: {
    label: 'Home Service Plans',
    description: 'Recurring home services',
    icon: 'Home',
  },
  LAUNDRY: {
    label: 'Laundry Plans',
    description: 'Monthly laundry plans',
    icon: 'Shirt',
  },
  GROCERY: {
    label: 'Grocery Plans',
    description: 'Recurring grocery deliveries',
    icon: 'ShoppingCart',
  },
  CUSTOM: {
    label: 'Custom Plans',
    description: 'Custom subscription plans',
    icon: 'Settings',
  },
};

// ============================================================================
// BILLING CYCLES
// ============================================================================

export const BILLING_CYCLES: Record<BillingCycle, { label: string; days: number; description: string }> = {
  DAILY: {
    label: 'Daily',
    days: 1,
    description: 'Billed every day',
  },
  WEEKLY: {
    label: 'Weekly',
    days: 7,
    description: 'Billed every week',
  },
  BIWEEKLY: {
    label: 'Bi-Weekly',
    days: 14,
    description: 'Billed every 2 weeks',
  },
  MONTHLY: {
    label: 'Monthly',
    days: 30,
    description: 'Billed every month',
  },
  QUARTERLY: {
    label: 'Quarterly',
    days: 90,
    description: 'Billed every 3 months',
  },
  HALF_YEARLY: {
    label: 'Half-Yearly',
    days: 180,
    description: 'Billed every 6 months',
  },
  YEARLY: {
    label: 'Yearly',
    days: 365,
    description: 'Billed every year',
  },
};

// ============================================================================
// INDIAN GST TAX RATES
// ============================================================================

export const TAX_RATES: Record<TaxType, { label: string; totalRate: number; cgstRate: number; sgstRate: number; igstRate: number; hsnExample: string }> = {
  GST_0: {
    label: 'GST 0% (Exempt)',
    totalRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    hsnExample: '0101',
  },
  GST_5: {
    label: 'GST 5%',
    totalRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 5,
    hsnExample: '0201',
  },
  GST_12: {
    label: 'GST 12%',
    totalRate: 12,
    cgstRate: 6,
    sgstRate: 6,
    igstRate: 12,
    hsnExample: '1701',
  },
  GST_18: {
    label: 'GST 18%',
    totalRate: 18,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    hsnExample: '2106',
  },
  GST_28: {
    label: 'GST 28%',
    totalRate: 28,
    cgstRate: 14,
    sgstRate: 14,
    igstRate: 28,
    hsnExample: '2402',
  },
  CUSTOM: {
    label: 'Custom Rate',
    totalRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    hsnExample: '',
  },
};

// ============================================================================
// DELIVERY STATUSES
// ============================================================================

export const DELIVERY_STATUSES: Record<DeliveryStatus, { label: string; color: string; bgColor: string }> = {
  ASSIGNING: {
    label: 'Assigning',
    color: '#6B7280',
    bgColor: '#F3F4F6',
  },
  ASSIGNED: {
    label: 'Assigned',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  PICKED_UP: {
    label: 'Picked Up',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
  },
  ON_THE_WAY: {
    label: 'On the Way',
    color: '#F97316',
    bgColor: '#FFEDD5',
  },
  ARRIVED: {
    label: 'Arrived',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
  },
  DELIVERED: {
    label: 'Delivered',
    color: '#10B981',
    bgColor: '#D1FAE5',
  },
  FAILED: {
    label: 'Failed',
    color: '#EF4444',
    bgColor: '#FEE2E2',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#6B7280',
    bgColor: '#F3F4F6',
  },
};

// ============================================================================
// ORDER TYPE CONFIGURATION PER BUSINESS TYPE
// ============================================================================

export const ORDER_TYPE_CONFIG: Record<BusinessType, { supportedTypes: string[]; defaultType: string; hasDelivery: boolean; hasPickup: boolean; hasDineIn: boolean; hasPOS: boolean; hasSubscription: boolean }> = {
  GROCERY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true,
    hasPickup: true,
    hasDineIn: false,
    hasPOS: true,
    hasSubscription: true,
  },
  FOOD_DELIVERY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'DINE_IN', 'POS'],
    defaultType: 'DELIVERY',
    hasDelivery: true,
    hasPickup: true,
    hasDineIn: true,
    hasPOS: true,
    hasSubscription: false,
  },
  LAUNDRY: {
    supportedTypes: ['DELIVERY', 'PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true,
    hasPickup: true,
    hasDineIn: false,
    hasPOS: true,
    hasSubscription: true,
  },
  CAR_WASH: {
    supportedTypes: ['PICKUP', 'POS', 'SUBSCRIPTION'],
    defaultType: 'PICKUP',
    hasDelivery: false,
    hasPickup: true,
    hasDineIn: false,
    hasPOS: true,
    hasSubscription: true,
  },
  HOME_SERVICES: {
    supportedTypes: ['DELIVERY', 'SUBSCRIPTION'],
    defaultType: 'DELIVERY',
    hasDelivery: true,
    hasPickup: false,
    hasDineIn: false,
    hasPOS: false,
    hasSubscription: true,
  },
};

// ============================================================================
// PLATFORM CONSTANTS
// ============================================================================

export const PLATFORM = {
  NAME: 'Quantix Technology',
  VERSION: '1.0.0',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_LOCALE: 'en-IN',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DEFAULT_COUNTRY: 'India',
  DEFAULT_PRIMARY_COLOR: '#10B981',
  DEFAULT_DELIVERY_RADIUS_KM: 5,
  DEFAULT_PREPARATION_TIME_MIN: 30,
  DEFAULT_MIN_ORDER_AMOUNT: 0,
  DEFAULT_DELIVERY_FEE: 0,
  OTP_LENGTH: 4,
  OTP_EXPIRY_MINUTES: 5,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MINUTES: 15,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================================
// INDIAN STATES (for GST place of supply)
// ============================================================================

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export const INDIAN_STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chhattisgarh': 'CG',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OD',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TS',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
  'Andaman and Nicobar Islands': 'AN',
  'Chandigarh': 'CH',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  'Delhi': 'DL',
  'Jammu and Kashmir': 'JK',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Puducherry': 'PY',
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
