// ============================================================================
// Quantix Core Platform — Barrel Export
// All future business modules import from @/lib/core
//
// BUSINESS MODEL:
// - NO free trial, NO self-signup, NO self-onboarding
// - ONLY 2 plans: ₹4,999/mo (MONTHLY) and ₹49,999/yr (YEARLY)
// - Super Admin can override pricing per customer
// - Demo credentials given first; tenant created ONLY after payment verified
// ============================================================================

// Types
export type * from './types';

// Platform Config & Module Registry
export { MODULE_REGISTRY, BUSINESS_TYPE_DEFAULT_MODULES, PLATFORM_PLANS, seedPlatformPlans, getPlatformConfig, setPlatformConfig, getBusinessModules, isModuleEnabled, enableModule, disableModule, enableDefaultModules, getPlatformPlan, getEffectivePrice, calculateDiscountPercentage } from './platform';

// Multi-Tenant Architecture
export { BUSINESS_TYPE_FEATURES, tenantFilter, businessFilter, storeFilter, canAccessBusiness, canAccessStore, resolveTenantContext, getBusinessTypeFeatures, businessSupportsOrderType, validateBusinessLicenses, canSwitchBusiness } from './tenant';
export type { TenantContext, TenantQueryFilter, BusinessTypeFeatureConfig } from './tenant';

// Role-Based Access Control
export { PLATFORM_PERMISSIONS, BUSINESS_PERMISSIONS, SALES_PERMISSIONS, LEAD_PERMISSIONS, DEMO_TENANT_PERMISSIONS, ONBOARDING_PERMISSIONS, STORE_PERMISSIONS, PRODUCT_PERMISSIONS, ORDER_PERMISSIONS, CUSTOMER_PERMISSIONS, DELIVERY_PERMISSIONS, SUBSCRIPTION_PERMISSIONS, POS_PERMISSIONS, INVOICE_PERMISSIONS, SETTINGS_PERMISSIONS, DEPLOYMENT_PERMISSIONS, DOMAIN_PERMISSIONS, ALL_PERMISSIONS, ROLE_PERMISSIONS, hasPermission, hasAnyPermission, hasAllPermissions, getPermissionsForRole, isPlatformRole, canCreateBusiness, canOverridePricing, getPermissionsByModule } from './rbac';

// Audit Logging
export { logActivity, getActivityLogs, exportAuditLog } from './audit';

// Business Management
export { createBusiness, updateBusiness, getBusiness, listBusinesses, updateBusinessStatus, toggleOnline, evaluateActivation, toggleChecklistItem, getBusinessStats, getOnboardingProgress, updateOnboardingStep, completeOnboarding, convertLeadToBusiness } from './business';

// Store Management
export { createStore, updateStore, getStore, listStores, updateStoreTimings, getDefaultStoreTimings, checkStoreOpen, timingForDate, slotsWithinWorkingHours, formatTimeLabel, formatReopenAt, istWeekday } from './store';
export type { StoreOpenResult, StoreDayTiming } from './store';

// Order Engine
export { createOrder, updateOrderStatus, cancelOrder, getOrder, listOrders, calculateOrderTotals, generateOrderNumber, isValidStatusTransition } from './order';

// POS Core
export { openPOSSession, closePOSSession, getPOSSession, getActiveSession, calculatePOSCart, generateThermalReceipt, numberToWords, getDefaultPrinterConfig, validatePrinterConfig } from './pos';

// Delivery Core
export { haversineDistance, checkServiceability, findNearestDeliveryPartner, generateDeliveryOtp, verifyOtp, calculateDeliveryFee, isValidPickupDeliveryTransition, isValidRegularDeliveryTransition, getValidNextStatuses, transitionPickupDeliveryOrder } from './delivery';
export type { ServiceabilityResult, DeliveryFeeParams, PickupDeliveryStatus, RegularDeliveryStatus } from './delivery';

// Subscription Engine
export { createPlatformSubscription, processBillingCycle, overrideSubscriptionPricing, removePricingOverride, suspendPlatformSubscription, reactivatePlatformSubscription, cancelPlatformSubscription, subscribeCustomerToPlan, deductCredits, processRenewal, pauseSubscription, resumeSubscription, checkRenewals, calculatePeriodEnd } from './subscription';

// Payment Processing
export { createPayment, updatePaymentStatus, processRefund, getPaymentByOrder, getPaymentStats, validatePaymentMethod } from './payment';

// Notifications
export { sendNotification, sendOrderNotification, sendDeliveryNotification, getNotifications, markAsRead, markAllAsRead, getNotificationTemplate, renderTemplate } from './notification';
