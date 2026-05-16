// ============================================================================
// Quantix Technology — Comprehensive Mock Data
// Managed White-Label Multi-Tenant SaaS Platform
// ============================================================================

export type BusinessType = 'GROCERY' | 'FOOD_DELIVERY' | 'LAUNDRY' | 'CAR_WASH' | 'PHARMACY' | 'HOME_SERVICES' | 'ECOMMERCE' | 'COSMETICS' | 'MEAT_DELIVERY' | 'FURNITURE' | 'DIRECTORY';
export type BusinessStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED';
export type Role = 'QUANTIX_SUPER_ADMIN' | 'QUANTIX_SALES_TEAM' | 'CLIENT_OWNER' | 'STORE_MANAGER' | 'DELIVERY_STAFF' | 'CUSTOMER';
export type LeadSource = 'META_ADS' | 'GOOGLE_ADS' | 'DIRECT_REFERRAL' | 'WEBSITE_INQUIRY' | 'COLD_OUTREACH' | 'WHATSAPP_INQUIRY' | 'PHONE_CALL' | 'OTHER';
export type LeadStage = 'LEAD' | 'FOLLOW_UP' | 'INTERESTED' | 'HOT_LEAD' | 'NOT_INTERESTED' | 'WRONG_NUMBER' | 'RNR' | 'DEMO_PLANNED' | 'DEMO_DONE' | 'NEGOTIATION' | 'PAYMENT_PENDING' | 'PAYMENT_RECEIVED' | 'CLOSED_WON' | 'LOST' | 'DUPLICATE';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'PICKUP_ASSIGNED' | 'PICKED_UP' | 'PROCESSING' | 'READY_FOR_DELIVERY';
export type OrderType = 'DELIVERY' | 'PICKUP' | 'DINE_IN' | 'POS' | 'SUBSCRIPTION' | 'PICKUP_AND_DELIVERY';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
export type DomainStatus = 'PENDING_DNS' | 'DNS_PROPAGATING' | 'SSL_PENDING' | 'ACTIVE' | 'ERROR';
export type DeploymentStatus = 'PENDING' | 'BUILDING' | 'DEPLOYING' | 'LIVE' | 'FAILED' | 'MAINTENANCE';
export type DeploymentType = 'WEBSITE' | 'ADMIN_DASHBOARD' | 'CUSTOMER_APP' | 'DELIVERY_APP' | 'ADMIN_APP';

// Business Type Config
export const businessTypeConfig: Record<BusinessType, { label: string; icon: string; color: string; desc: string }> = {
  GROCERY: { label: 'Grocery Delivery', icon: 'ShoppingCart', color: '#10B981', desc: 'Online grocery store with delivery' },
  FOOD_DELIVERY: { label: 'Food Delivery', icon: 'UtensilsCrossed', color: '#F59E0B', desc: 'Restaurant food delivery' },
  LAUNDRY: { label: 'Laundry', icon: 'Shirt', color: '#6366F1', desc: 'Pickup & delivery laundry service' },
  CAR_WASH: { label: 'Car/Bike Wash', icon: 'Car', color: '#3B82F6', desc: 'Subscription car wash service' },
  PHARMACY: { label: 'Pharmacy', icon: 'Pill', color: '#EF4444', desc: 'Medicine delivery' },
  HOME_SERVICES: { label: 'Home Services', icon: 'Home', color: '#8B5CF6', desc: 'Home repair & maintenance' },
  ECOMMERCE: { label: 'E-Commerce', icon: 'Package', color: '#EC4899', desc: 'General e-commerce store' },
  COSMETICS: { label: 'Cosmetics', icon: 'Sparkles', color: '#F472B6', desc: 'Beauty & cosmetics store' },
  MEAT_DELIVERY: { label: 'Meat Delivery', icon: 'Beef', color: '#DC2626', desc: 'Fresh meat delivery' },
  FURNITURE: { label: 'Furniture', icon: 'Sofa', color: '#92400E', desc: 'Furniture delivery' },
  DIRECTORY: { label: 'Directory', icon: 'BookOpen', color: '#0891B2', desc: 'Business directory listings' },
};

export const statusColors: Record<BusinessStatus, string> = {
  ONBOARDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CHURNED: 'bg-slate-100 text-slate-600',
};

export const orderStatusColors: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  READY_FOR_PICKUP: 'bg-orange-100 text-orange-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  PICKUP_ASSIGNED: 'bg-indigo-100 text-indigo-700',
  PICKED_UP: 'bg-cyan-100 text-cyan-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  READY_FOR_DELIVERY: 'bg-lime-100 text-lime-700',
};

export const subStatusColors: Record<SubscriptionStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

export const domainStatusColors: Record<DomainStatus, string> = {
  PENDING_DNS: 'bg-amber-100 text-amber-700',
  DNS_PROPAGATING: 'bg-blue-100 text-blue-700',
  SSL_PENDING: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ERROR: 'bg-red-100 text-red-700',
};

export const leadStageColors: Record<LeadStage, string> = {
  LEAD:             'bg-slate-100 text-slate-700',
  FOLLOW_UP:        'bg-blue-100 text-blue-700',
  INTERESTED:       'bg-cyan-100 text-cyan-700',
  HOT_LEAD:         'bg-orange-100 text-orange-700',
  NOT_INTERESTED:   'bg-red-100 text-red-700',
  WRONG_NUMBER:     'bg-rose-100 text-rose-700',
  RNR:              'bg-amber-100 text-amber-700',
  DEMO_PLANNED:     'bg-violet-100 text-violet-700',
  DEMO_DONE:        'bg-purple-100 text-purple-700',
  NEGOTIATION:      'bg-orange-100 text-orange-800',
  PAYMENT_PENDING:  'bg-yellow-100 text-yellow-700',
  PAYMENT_RECEIVED: 'bg-teal-100 text-teal-700',
  CLOSED_WON:       'bg-emerald-100 text-emerald-700',
  LOST:             'bg-red-100 text-red-600',
  DUPLICATE:        'bg-slate-100 text-slate-500',
};

// Platform Plans — Only 2 fixed plans
export const platformPlans = [
  { id: 'plan_monthly', name: 'Quantix Standard', billingCycle: 'MONTHLY', price: 4999, tier: 'STANDARD', monthlyPrice: 4999, yearlyPrice: 49999, maxStores: 5, maxProducts: 5000, maxOrders: 10000, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: true },
  { id: 'plan_yearly', name: 'Quantix Professional', billingCycle: 'YEARLY', price: 49999, tier: 'PROFESSIONAL', monthlyPrice: 4166, yearlyPrice: 49999, maxStores: 5, maxProducts: 5000, maxOrders: 10000, hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true, hasWhiteLabel: true },
];

// Businesses
export const businesses = [
  { id: 'biz_1', name: 'FreshMart Grocers', slug: 'freshmart', type: 'GROCERY' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Mumbai', plan: 'Professional', customPrice: null, monthlyRevenue: 285000, totalOrders: 1240, activeCustomers: 856, isOnline: true, contactPhone: '+91 98765 43210' },
  { id: 'biz_2', name: 'SpiceRoute Kitchen', slug: 'spiceroute', type: 'FOOD_DELIVERY' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Delhi', plan: 'Professional', customPrice: null, monthlyRevenue: 420000, totalOrders: 2100, activeCustomers: 1450, isOnline: true, contactPhone: '+91 87654 32109' },
  { id: 'biz_3', name: 'QuickClean Laundry', slug: 'quickclean', type: 'LAUNDRY' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Bangalore', plan: 'Starter', customPrice: null, monthlyRevenue: 95000, totalOrders: 380, activeCustomers: 210, isOnline: true, contactPhone: '+91 76543 21098' },
  { id: 'biz_4', name: 'SparkleWash Auto', slug: 'sparklewash', type: 'CAR_WASH' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Hyderabad', plan: 'Professional', customPrice: 7999, monthlyRevenue: 185000, totalOrders: 620, activeCustomers: 340, isOnline: true, contactPhone: '+91 65432 10987' },
  { id: 'biz_5', name: 'MedQuick Pharmacy', slug: 'medquick', type: 'PHARMACY' as BusinessType, status: 'ONBOARDING' as BusinessStatus, city: 'Chennai', plan: 'Monthly', customPrice: null, monthlyRevenue: 45000, totalOrders: 180, activeCustomers: 120, isOnline: false, contactPhone: '+91 54321 09876' },
  { id: 'biz_6', name: 'HomeFix Services', slug: 'homefix', type: 'HOME_SERVICES' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Pune', plan: 'Yearly', customPrice: null, monthlyRevenue: 520000, totalOrders: 890, activeCustomers: 620, isOnline: true, contactPhone: '+91 43210 98765' },
  { id: 'biz_7', name: 'ShopNow Express', slug: 'shopnow', type: 'ECOMMERCE' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Jaipur', plan: 'Professional', customPrice: null, monthlyRevenue: 340000, totalOrders: 1560, activeCustomers: 920, isOnline: true, contactPhone: '+91 32109 87654' },
  { id: 'biz_8', name: 'GlowUp Beauty', slug: 'glowup', type: 'COSMETICS' as BusinessType, status: 'ONBOARDING' as BusinessStatus, city: 'Kolkata', plan: 'Starter', customPrice: null, monthlyRevenue: 0, totalOrders: 0, activeCustomers: 0, isOnline: false, contactPhone: '+91 21098 76543' },
  { id: 'biz_9', name: 'FreshCuts Meat', slug: 'freshcuts', type: 'MEAT_DELIVERY' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Lucknow', plan: 'Professional', customPrice: 6499, monthlyRevenue: 165000, totalOrders: 720, activeCustomers: 480, isOnline: true, contactPhone: '+91 10987 65432' },
  { id: 'biz_10', name: 'WoodCraft Furniture', slug: 'woodcraft', type: 'FURNITURE' as BusinessType, status: 'SUSPENDED' as BusinessStatus, city: 'Ahmedabad', plan: 'Starter', customPrice: null, monthlyRevenue: 0, totalOrders: 45, activeCustomers: 30, isOnline: false, contactPhone: '+91 09876 54321' },
  { id: 'biz_11', name: 'CityGuide Directory', slug: 'cityguide', type: 'DIRECTORY' as BusinessType, status: 'ACTIVE' as BusinessStatus, city: 'Indore', plan: 'Starter', customPrice: null, monthlyRevenue: 38000, totalOrders: 0, activeCustomers: 250, isOnline: true, contactPhone: '+91 98765 12345' },
];

// Sales Team
export const salesTeam = [
  { id: 'sales_1', name: 'Priya Sharma', email: 'priya@quantixtechnology.in', phone: '+91 98765 11111', region: 'North India', target: 500000, achieved: 385000, leads: 12, conversions: 5 },
  { id: 'sales_2', name: 'Rahul Verma', email: 'rahul@quantixtechnology.in', phone: '+91 98765 22222', region: 'South India', target: 500000, achieved: 520000, leads: 18, conversions: 8 },
];

// Leads
export const leads = [
  { id: 'lead_1', businessName: 'TasteBud Restaurant', contactName: 'Amit Patel', contactEmail: 'amit@tastebud.in', contactPhone: '+91 99887 76543', source: 'META_ADS' as LeadSource, stage: 'LEAD' as LeadStage, estimatedValue: 59988, salesRep: 'Priya Sharma', followUpDate: '2025-01-20', type: 'FOOD_DELIVERY' as BusinessType },
  { id: 'lead_2', businessName: 'WashMaster Pro', contactName: 'Suresh Kumar', contactEmail: 'suresh@washmaster.in', contactPhone: '+91 88776 65432', source: 'WHATSAPP_INQUIRY' as LeadSource, stage: 'DEMO_DONE' as LeadStage, estimatedValue: 119988, salesRep: 'Rahul Verma', followUpDate: '2025-01-18', type: 'CAR_WASH' as BusinessType },
  { id: 'lead_3', businessName: 'GreenLeaf Organic', contactName: 'Meera Nair', contactEmail: 'meera@greenleaf.in', contactPhone: '+91 77665 54321', source: 'DIRECT_REFERRAL' as LeadSource, stage: 'NEGOTIATION' as LeadStage, estimatedValue: 59988, salesRep: 'Priya Sharma', followUpDate: '2025-01-22', type: 'GROCERY' as BusinessType },
  { id: 'lead_4', businessName: 'MedPlus Health', contactName: 'Dr. Rajesh', contactEmail: 'rajesh@medplus.in', contactPhone: '+91 66554 43210', source: 'GOOGLE_ADS' as LeadSource, stage: 'PAYMENT_PENDING' as LeadStage, estimatedValue: 119988, salesRep: 'Rahul Verma', followUpDate: '2025-01-19', type: 'PHARMACY' as BusinessType },
  { id: 'lead_5', businessName: 'StyleHut Fashion', contactName: 'Neha Gupta', contactEmail: 'neha@stylehut.in', contactPhone: '+91 55443 32109', source: 'PHONE_CALL' as LeadSource, stage: 'PAYMENT_RECEIVED' as LeadStage, estimatedValue: 59988, salesRep: 'Priya Sharma', followUpDate: '2025-01-21', type: 'ECOMMERCE' as BusinessType },
  { id: 'lead_6', businessName: 'CleanPro Services', contactName: 'Vikram Singh', contactEmail: 'vikram@cleanpro.in', contactPhone: '+91 44332 21098', source: 'COLD_OUTREACH' as LeadSource, stage: 'CLOSED_WON' as LeadStage, estimatedValue: 59988, salesRep: 'Rahul Verma', followUpDate: '', type: 'LAUNDRY' as BusinessType },
  { id: 'lead_7', businessName: 'HomeCare Plus', contactName: 'Anita Desai', contactEmail: 'anita@homecare.in', contactPhone: '+91 33221 10987', source: 'WEBSITE_INQUIRY' as LeadSource, stage: 'LOST' as LeadStage, estimatedValue: 249988, salesRep: 'Priya Sharma', followUpDate: '', type: 'HOME_SERVICES' as BusinessType },
  { id: 'lead_8', businessName: 'BeautyBox Store', contactName: 'Kavita Reddy', contactEmail: 'kavita@beautybox.in', contactPhone: '+91 22110 09876', source: 'META_ADS' as LeadSource, stage: 'HOT_LEAD' as LeadStage, estimatedValue: 59988, salesRep: 'Rahul Verma', followUpDate: '2025-01-25', type: 'COSMETICS' as BusinessType },
];

// Client Subscriptions
export const clientSubscriptions = [
  { id: 'sub_1', businessId: 'biz_1', businessName: 'FreshMart Grocers', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-02-01' },
  { id: 'sub_2', businessId: 'biz_2', businessName: 'SpiceRoute Kitchen', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-02-01' },
  { id: 'sub_3', businessId: 'biz_3', businessName: 'QuickClean Laundry', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-02-01' },
  { id: 'sub_4', businessId: 'biz_4', businessName: 'SparkleWash Auto', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: 3999, discountPercentage: 20, manualOverride: true, billingCycle: 'MONTHLY', nextBilling: '2025-02-01' },
  { id: 'sub_5', businessId: 'biz_5', businessName: 'MedQuick Pharmacy', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-02-15' },
  { id: 'sub_6', businessId: 'biz_6', businessName: 'HomeFix Services', plan: 'Yearly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 49999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'YEARLY', nextBilling: '2025-12-01' },
  { id: 'sub_7', businessId: 'biz_7', businessName: 'ShopNow Express', plan: 'Monthly', status: 'PAST_DUE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-01-01' },
  { id: 'sub_8', businessId: 'biz_8', businessName: 'GlowUp Beauty', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2025-02-20' },
  { id: 'sub_9', businessId: 'biz_9', businessName: 'FreshCuts Meat', plan: 'Monthly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 4999, customPrice: 3499, discountPercentage: 30, manualOverride: true, billingCycle: 'MONTHLY', nextBilling: '2025-02-01' },
  { id: 'sub_10', businessId: 'biz_10', businessName: 'WoodCraft Furniture', plan: 'Monthly', status: 'SUSPENDED' as SubscriptionStatus, planPrice: 4999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'MONTHLY', nextBilling: '2024-12-01' },
  { id: 'sub_11', businessId: 'biz_11', businessName: 'CityGuide Directory', plan: 'Yearly', status: 'ACTIVE' as SubscriptionStatus, planPrice: 49999, customPrice: null, discountPercentage: null, manualOverride: false, billingCycle: 'YEARLY', nextBilling: '2025-11-01' },
];

// Domains
export const domains = [
  { id: 'dom_1', businessId: 'biz_1', businessName: 'FreshMart Grocers', domain: 'www.freshmart.in', isPrimary: true, sslStatus: 'active', status: 'ACTIVE' as DomainStatus, dnsProvider: 'Cloudflare' },
  { id: 'dom_2', businessId: 'biz_2', businessName: 'SpiceRoute Kitchen', domain: 'order.spiceroute.in', isPrimary: true, sslStatus: 'active', status: 'ACTIVE' as DomainStatus, dnsProvider: 'Cloudflare' },
  { id: 'dom_3', businessId: 'biz_3', businessName: 'QuickClean Laundry', domain: 'quickclean.in', isPrimary: true, sslStatus: 'active', status: 'ACTIVE' as DomainStatus, dnsProvider: 'GoDaddy' },
  { id: 'dom_4', businessId: 'biz_4', businessName: 'SparkleWash Auto', domain: 'sparklewash.in', isPrimary: true, sslStatus: 'active', status: 'ACTIVE' as DomainStatus, dnsProvider: 'Cloudflare' },
  { id: 'dom_5', businessId: 'biz_5', businessName: 'MedQuick Pharmacy', domain: 'medquick.in', isPrimary: true, sslStatus: 'pending', status: 'SSL_PENDING' as DomainStatus, dnsProvider: 'Route53' },
  { id: 'dom_6', businessId: 'biz_6', businessName: 'HomeFix Services', domain: 'homefix.co.in', isPrimary: true, sslStatus: 'active', status: 'ACTIVE' as DomainStatus, dnsProvider: 'Cloudflare' },
  { id: 'dom_7', businessId: 'biz_8', businessName: 'GlowUp Beauty', domain: 'glowupbeauty.in', isPrimary: true, sslStatus: 'pending', status: 'PENDING_DNS' as DomainStatus, dnsProvider: 'GoDaddy' },
];

// Deployments
export const deployments = [
  { id: 'dep_1', businessId: 'biz_1', businessName: 'FreshMart Grocers', type: 'WEBSITE' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'replit', version: '2.1.3', healthStatus: 'healthy' },
  { id: 'dep_2', businessId: 'biz_1', businessName: 'FreshMart Grocers', type: 'ADMIN_DASHBOARD' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'replit', version: '2.1.3', healthStatus: 'healthy' },
  { id: 'dep_3', businessId: 'biz_2', businessName: 'SpiceRoute Kitchen', type: 'WEBSITE' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'vercel', version: '2.1.3', healthStatus: 'healthy' },
  { id: 'dep_4', businessId: 'biz_4', businessName: 'SparkleWash Auto', type: 'WEBSITE' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'replit', version: '2.1.2', healthStatus: 'healthy' },
  { id: 'dep_5', businessId: 'biz_5', businessName: 'MedQuick Pharmacy', type: 'WEBSITE' as DeploymentType, status: 'BUILDING' as DeploymentStatus, hostingProvider: 'replit', version: '2.1.3', healthStatus: 'unknown' },
  { id: 'dep_6', businessId: 'biz_6', businessName: 'HomeFix Services', type: 'WEBSITE' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'aws', version: '2.1.3', healthStatus: 'healthy' },
  { id: 'dep_7', businessId: 'biz_8', businessName: 'GlowUp Beauty', type: 'WEBSITE' as DeploymentType, status: 'PENDING' as DeploymentStatus, hostingProvider: 'replit', version: '-', healthStatus: 'unknown' },
  { id: 'dep_8', businessId: 'biz_9', businessName: 'FreshCuts Meat', type: 'WEBSITE' as DeploymentType, status: 'LIVE' as DeploymentStatus, hostingProvider: 'digitalocean', version: '2.1.3', healthStatus: 'degraded' },
];

// Orders
export const orders = [
  { id: 'ord_1', orderNumber: 'ORD-20250115-001', businessId: 'biz_1', businessName: 'FreshMart', customerName: 'Rajesh Kumar', type: 'DELIVERY' as OrderType, status: 'DELIVERED' as OrderStatus, total: 1250, paymentMethod: 'UPI', items: 5, createdAt: '2025-01-15 10:30' },
  { id: 'ord_2', orderNumber: 'ORD-20250115-002', businessId: 'biz_2', businessName: 'SpiceRoute', customerName: 'Sneha Patil', type: 'DELIVERY' as OrderType, status: 'OUT_FOR_DELIVERY' as OrderStatus, total: 850, paymentMethod: 'CARD', items: 3, createdAt: '2025-01-15 11:15' },
  { id: 'ord_3', orderNumber: 'ORD-20250115-003', businessId: 'biz_3', businessName: 'QuickClean', customerName: 'Anand Joshi', type: 'PICKUP_AND_DELIVERY' as OrderType, status: 'PICKED_UP' as OrderStatus, total: 450, paymentMethod: 'UPI', items: 8, createdAt: '2025-01-15 09:00' },
  { id: 'ord_4', orderNumber: 'ORD-20250115-004', businessId: 'biz_4', businessName: 'SparkleWash', customerName: 'Deepa Nair', type: 'SUBSCRIPTION' as OrderType, status: 'PROCESSING' as OrderStatus, total: 0, paymentMethod: 'CREDIT', items: 1, createdAt: '2025-01-15 08:30' },
  { id: 'ord_5', orderNumber: 'ORD-20250115-005', businessId: 'biz_1', businessName: 'FreshMart', customerName: 'Mohan Sharma', type: 'POS' as OrderType, status: 'DELIVERED' as OrderStatus, total: 3200, paymentMethod: 'CASH', items: 12, createdAt: '2025-01-15 14:20' },
  { id: 'ord_6', orderNumber: 'ORD-20250115-006', businessId: 'biz_5', businessName: 'MedQuick', customerName: 'Kavita Reddy', type: 'DELIVERY' as OrderType, status: 'PENDING' as OrderStatus, total: 560, paymentMethod: 'COD', items: 3, createdAt: '2025-01-15 15:00' },
  { id: 'ord_7', orderNumber: 'ORD-20250115-007', businessId: 'biz_6', businessName: 'HomeFix', customerName: 'Arjun Mehta', type: 'DELIVERY' as OrderType, status: 'CONFIRMED' as OrderStatus, total: 2500, paymentMethod: 'UPI', items: 2, createdAt: '2025-01-15 16:30' },
  { id: 'ord_8', orderNumber: 'ORD-20250114-008', businessId: 'biz_7', businessName: 'ShopNow', customerName: 'Priti Singh', type: 'DELIVERY' as OrderType, status: 'CANCELLED' as OrderStatus, total: 1800, paymentMethod: 'CARD', items: 4, createdAt: '2025-01-14 12:00' },
  { id: 'ord_9', orderNumber: 'ORD-20250114-009', businessId: 'biz_9', businessName: 'FreshCuts', customerName: 'Suresh Kumar', type: 'DELIVERY' as OrderType, status: 'PREPARING' as OrderStatus, total: 980, paymentMethod: 'UPI', items: 2, createdAt: '2025-01-14 17:45' },
  { id: 'ord_10', orderNumber: 'ORD-20250114-010', businessId: 'biz_3', businessName: 'QuickClean', customerName: 'Ravi Iyer', type: 'PICKUP_AND_DELIVERY' as OrderType, status: 'PICKUP_ASSIGNED' as OrderStatus, total: 320, paymentMethod: 'UPI', items: 5, createdAt: '2025-01-14 10:00' },
];

// Customers
export const customers = [
  { id: 'cust_1', name: 'Rajesh Kumar', phone: '+91 98765 11111', email: 'rajesh@email.com', totalOrders: 24, totalSpent: 28500, loyaltyPoints: 1420, tier: 'GOLD' },
  { id: 'cust_2', name: 'Sneha Patil', phone: '+91 98765 22222', email: 'sneha@email.com', totalOrders: 12, totalSpent: 8400, loyaltyPoints: 420, tier: 'SILVER' },
  { id: 'cust_3', name: 'Anand Joshi', phone: '+91 98765 33333', email: 'anand@email.com', totalOrders: 36, totalSpent: 16200, loyaltyPoints: 810, tier: 'GOLD' },
  { id: 'cust_4', name: 'Deepa Nair', phone: '+91 98765 44444', email: 'deepa@email.com', totalOrders: 8, totalSpent: 5600, loyaltyPoints: 280, tier: 'BRONZE' },
  { id: 'cust_5', name: 'Mohan Sharma', phone: '+91 98765 55555', email: 'mohan@email.com', totalOrders: 52, totalSpent: 78000, loyaltyPoints: 3900, tier: 'PLATINUM' },
  { id: 'cust_6', name: 'Kavita Reddy', phone: '+91 98765 66666', email: 'kavita@email.com', totalOrders: 3, totalSpent: 1680, loyaltyPoints: 84, tier: 'BRONZE' },
];

// Revenue Chart Data
export const revenueData = [
  { month: 'Aug', revenue: 850000 },
  { month: 'Sep', revenue: 920000 },
  { month: 'Oct', revenue: 1050000 },
  { month: 'Nov', revenue: 1180000 },
  { month: 'Dec', revenue: 1350000 },
  { month: 'Jan', revenue: 1498000 },
];

// Business type distribution
export const businessTypeData = [
  { name: 'Grocery', value: 25, color: '#10B981' },
  { name: 'Food', value: 20, color: '#F59E0B' },
  { name: 'Laundry', value: 10, color: '#6366F1' },
  { name: 'Car Wash', value: 8, color: '#3B82F6' },
  { name: 'Pharmacy', value: 12, color: '#EF4444' },
  { name: 'Home Services', value: 10, color: '#8B5CF6' },
  { name: 'Others', value: 15, color: '#94A3B8' },
];

// Lead source distribution
export const leadSourceData = [
  { name: 'Meta Ads', value: 35, color: '#1877F2' },
  { name: 'WhatsApp', value: 25, color: '#25D366' },
  { name: 'Google Ads', value: 15, color: '#4285F4' },
  { name: 'Referral', value: 12, color: '#10B981' },
  { name: 'Cold Outreach', value: 8, color: '#F59E0B' },
  { name: 'Others', value: 5, color: '#94A3B8' },
];

// Subscription plans for Car Wash example
export const carWashPlans = [
  { id: 'cwp_1', name: 'Basic Wash', price: 999, credits: 8, creditLabel: 'washes', features: ['8 Exterior Washes', 'Valid 30 days', 'Any vehicle type'] },
  { id: 'cwp_2', name: 'Premium Care', price: 1999, credits: 17, creditLabel: 'washes', features: ['15 Exterior Washes', '2 Interior Washes', 'Valid 30 days', 'Priority booking'] },
  { id: 'cwp_3', name: 'Ultimate Shine', price: 3499, credits: 30, creditLabel: 'washes', features: ['25 Exterior Washes', '5 Interior Washes', 'Valid 30 days', 'Priority booking', 'Free wax coating'] },
];
