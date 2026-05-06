// ============================================================================
// Quantix Technology - Zod Validation Schemas
// ============================================================================

import { z } from 'zod';

// ============================================================================
// COMMON HELPERS
// ============================================================================

const indianPhoneRegex = /^[6-9]\d{9}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().regex(indianPhoneRegex, 'Invalid Indian phone number').optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// ============================================================================
// BUSINESS SCHEMAS
// ============================================================================

export const businessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(200),
  slug: z.string().regex(slugRegex, 'Invalid slug format').min(2).max(100),
  businessType: z.enum(['GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'HOME_SERVICES']),
  description: z.string().max(1000).optional(),
  domain: z.string().optional(),
  subdomain: z.string().regex(slugRegex, 'Invalid subdomain format').optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#10B981'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  logo: z.string().url('Invalid logo URL').optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().regex(pincodeRegex, 'Invalid pincode').optional(),
  gstNumber: z.string().regex(gstRegex, 'Invalid GST number').optional(),
  panNumber: z.string().regex(panRegex, 'Invalid PAN number').optional(),
  contactEmail: z.string().email('Invalid email').optional(),
  contactPhone: z.string().regex(indianPhoneRegex, 'Invalid phone number').optional(),
  supportEmail: z.string().email('Invalid email').optional(),
  supportPhone: z.string().regex(indianPhoneRegex, 'Invalid phone number').optional(),
});

export const updateBusinessSchema = businessSchema.partial();

// ============================================================================
// STORE SCHEMAS
// ============================================================================

export const storeSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters').max(200),
  slug: z.string().regex(slugRegex, 'Invalid slug format').min(2).max(100),
  code: z.string().max(10).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().regex(pincodeRegex, 'Invalid pincode').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phone: z.string().regex(indianPhoneRegex, 'Invalid phone number').optional(),
  email: z.string().email('Invalid email').optional(),
  isMainStore: z.boolean().default(false),
  deliveryRadius: z.number().min(0).max(100).default(5),
  minOrderAmount: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  freeDeliveryAbove: z.number().min(0).optional(),
  preparationTime: z.number().min(0).max(480).default(30),
  posEnabled: z.boolean().default(true),
  gstNumber: z.string().regex(gstRegex, 'Invalid GST number').optional(),
});

// ============================================================================
// PRODUCT & CATEGORY SCHEMAS
// ============================================================================

export const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(200),
  slug: z.string().regex(slugRegex, 'Invalid slug format').min(2).max(100),
  description: z.string().max(1000).optional(),
  image: z.string().url('Invalid image URL').optional(),
  icon: z.string().max(50).optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const productVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required').max(100),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  mrp: z.number().min(0, 'MRP must be non-negative'),
  costPrice: z.number().min(0).optional(),
  discountPrice: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  attributes: z.record(z.string(), z.string()).default({}),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(300),
  slug: z.string().regex(slugRegex, 'Invalid slug format').min(2).max(100),
  categoryId: z.string().optional(),
  description: z.string().max(5000).optional(),
  shortDesc: z.string().max(200).optional(),
  type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE', 'SUBSCRIPTION']).default('PHYSICAL'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  images: z.array(z.string().url()).default([]),
  unit: z.string().max(20).optional(),
  unitQuantity: z.number().positive().optional(),
  isVeg: z.boolean().optional(),
  isFeatured: z.boolean().default(false),
  isPopular: z.boolean().default(false),
  preparationTime: z.number().int().min(0).optional(),
  minOrderQty: z.number().min(0.1).default(1),
  maxOrderQty: z.number().min(1).default(100),
  tags: z.array(z.string()).default([]),
  nutritionInfo: z.string().optional(),
  allergenInfo: z.string().optional(),
  variants: z.array(productVariantSchema).min(1, 'At least one variant is required').default([]),
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().min(0.1, 'Quantity must be positive'),
  specialInstructions: z.string().max(500).optional(),
  customizations: z.record(z.string(), z.string()).optional(),
});

export const orderSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN', 'POS', 'SUBSCRIPTION']),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'NETBANKING', 'WALLET', 'COD', 'CREDIT']).optional(),
  customerId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  customerPhone: z.string().regex(indianPhoneRegex, 'Invalid phone number').optional(),
  customerEmail: z.string().email('Invalid email').optional(),
  deliveryAddressId: z.string().optional(),
  deliveryInstructions: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  pickupName: z.string().max(200).optional(),
  pickupPhone: z.string().regex(indianPhoneRegex, 'Invalid phone number').optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  promoCodeId: z.string().optional(),
  notes: z.string().max(500).optional(),
  posSessionId: z.string().optional(),
  posOperatorId: z.string().optional(),
  tableNumber: z.string().max(20).optional(),
});

// ============================================================================
// SUBSCRIPTION SCHEMAS
// ============================================================================

export const subscriptionPlanItemSchema = z.object({
  productId: z.string().optional(),
  serviceName: z.string().max(200).optional(),
  creditsPerCycle: z.number().int().min(1).default(1),
  maxPerUse: z.number().int().min(1).default(1),
  rollover: z.boolean().default(false),
  rolloverMax: z.number().int().min(0).default(0),
});

export const subscriptionPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters').max(200),
  slug: z.string().regex(slugRegex, 'Invalid slug format').min(2).max(100),
  description: z.string().max(2000).optional(),
  type: z.enum(['CAR_WASH', 'HOME_SERVICE', 'LAUNDRY', 'GROCERY', 'CUSTOM']),
  billingCycle: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']),
  price: z.number().min(0, 'Price must be non-negative'),
  originalPrice: z.number().min(0).optional(),
  setupFee: z.number().min(0).default(0),
  trialDays: z.number().int().min(0).default(0),
  totalCredits: z.number().int().min(0).default(0),
  creditLabel: z.string().max(50).optional(),
  features: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
  maxSubscribers: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  planItems: z.array(subscriptionPlanItemSchema).optional(),
});

// ============================================================================
// CUSTOMER & ADDRESS SCHEMAS
// ============================================================================

export const addressSchema = z.object({
  label: z.string().max(50).optional(),
  addressLine1: z.string().min(5, 'Address is too short').max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  pincode: z.string().regex(pincodeRegex, 'Invalid pincode'),
  country: z.string().default('India'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
  landmark: z.string().max(200).optional(),
  instructions: z.string().max(500).optional(),
});

export const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().email('Invalid email').optional(),
  phone: z.string().regex(indianPhoneRegex, 'Invalid Indian phone number').optional(),
  gstNumber: z.string().regex(gstRegex, 'Invalid GST number').optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  address: addressSchema.optional(),
});

// ============================================================================
// DELIVERY ZONE SCHEMAS
// ============================================================================

export const deliveryZoneSchema = z.object({
  name: z.string().min(2, 'Zone name is required').max(200),
  storeId: z.string().optional(),
  zoneType: z.enum(['CIRCLE', 'POLYGON', 'PINCODE']),
  // Circle zone
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radius: z.number().positive().optional(),
  // Polygon zone (GeoJSON)
  polygon: z.string().optional(),
  // Pincode zone
  pincodes: z.string().optional(),
  deliveryFee: z.number().min(0).default(0),
  minOrderAmount: z.number().min(0).default(0),
  freeDeliveryAbove: z.number().min(0).optional(),
  estimatedTime: z.number().int().min(0).default(30),
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.zoneType === 'CIRCLE') {
      return data.centerLat !== undefined && data.centerLng !== undefined && data.radius !== undefined;
    }
    return true;
  },
  { message: 'Circle zones require center coordinates and radius', path: ['centerLat'] }
);

// ============================================================================
// PROMO CODE SCHEMA
// ============================================================================

export const promoCodeSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').max(50).toUpperCase(),
  description: z.string().max(500).optional(),
  promoType: z.enum(['PERCENTAGE', 'FLAT', 'FREE_DELIVERY', 'BOGO']),
  value: z.number().min(0, 'Value must be non-negative'),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  applicableCategories: z.array(z.string()).default([]),
  applicableProducts: z.array(z.string()).default([]),
  applicableStores: z.array(z.string()).default([]),
  isFirstOrderOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).refine(
  (data) => new Date(data.startsAt) < new Date(data.endsAt),
  { message: 'End date must be after start date', path: ['endsAt'] }
);

// ============================================================================
// TAX CONFIG SCHEMA
// ============================================================================

export const taxConfigSchema = z.object({
  name: z.string().min(2, 'Tax name is required').max(200),
  taxType: z.enum(['GST_0', 'GST_5', 'GST_12', 'GST_18', 'GST_28', 'CUSTOM']),
  gstRate: z.number().min(0).max(100),
  cgstRate: z.number().min(0).max(100).default(0),
  sgstRate: z.number().min(0).max(100).default(0),
  igstRate: z.number().min(0).max(100).default(0),
  cessRate: z.number().min(0).max(100).default(0),
  hsnCode: z.string().max(20).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
}).refine(
  (data) => {
    const totalRate = data.cgstRate + data.sgstRate;
    if (totalRate > 0 && Math.abs(totalRate - data.gstRate) > 0.01) {
      return false;
    }
    if (data.igstRate > 0 && Math.abs(data.igstRate - data.gstRate) > 0.01) {
      return false;
    }
    return true;
  },
  { message: 'CGST + SGST or IGST must equal total GST rate', path: ['gstRate'] }
);

// ============================================================================
// POS SESSION SCHEMA
// ============================================================================

export const posSessionSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  operatorId: z.string().min(1, 'Operator ID is required'),
  openingBalance: z.number().min(0).default(0),
});

export const posSessionCloseSchema = z.object({
  closingBalance: z.number().min(0),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type BusinessInput = z.infer<typeof businessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type StoreInput = z.infer<typeof storeSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type SubscriptionPlanInput = z.infer<typeof subscriptionPlanSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type DeliveryZoneInput = z.infer<typeof deliveryZoneSchema>;
export type PromoCodeInput = z.infer<typeof promoCodeSchema>;
export type TaxConfigInput = z.infer<typeof taxConfigSchema>;
export type POSSessionInput = z.infer<typeof posSessionSchema>;
export type POSSessionCloseInput = z.infer<typeof posSessionCloseSchema>;
