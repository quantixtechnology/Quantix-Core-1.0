"use client"

import { create } from "zustand"

export type ViewMode = "super_admin" | "business_owner" | "customer" | "delivery_partner"

export type AdminPage =
  | "dashboard"
  | "leads"
  | "businesses"
  | "subscriptions"
  | "onboarding"
  | "domains"
  | "demo-tenants"
  | "sales"
  | "notifications"
  | "settings"
  // Phase 6 — Deployment & Operations
  | "ops-dashboard"
  | "deployment-pipeline"
  | "build-automation"
  | "release-management"
  | "play-store"
  | "mobile-versions"
  // Phase 6 — Client Operations
  | "client-assets"
  | "tenant-provisioning"
  | "product-import"
  | "onboarding-checklist"
  // Phase 6 — System
  | "backup-monitoring"
  | "security-access"
  | "audit-logs"
  | "platform-analytics"
  | "revenue"
  | "support"
  | "mobile-apps"
  // Workflow Engine
  | "workflow-engine"
  | "plan-management"

export type BusinessPage =
  | "dashboard"
  | "orders"
  | "products"
  | "inventory"
  | "pos"
  | "customers"
  | "reports"
  | "settings"
  | "marketing"
  | "offers"
  | "reviews"
  | "staff"
  | "tax"
  | "loyalty"
  | "product-import"
  | "delivery-zones"
  | "storefront"
  // Workflow Engine — Business Owner
  | "workflow-config"
  | "workflows"

export type CustomerPage =
  | "auth"
  | "home"
  | "products"
  | "product-detail"
  | "cart"
  | "checkout"
  | "order-tracking"
  | "profile"
  | "orders"
  | "addresses"
  | "support"

export type DeliveryPage =
  | "login"
  | "dashboard"
  | "order-detail"
  | "navigation"
  | "otp-verify"
  | "earnings"
  | "profile"

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export type WorkflowType = 
  | "ECOMMERCE"
  | "PICKUP_DELIVERY"
  | "APPOINTMENT"
  | "SUBSCRIPTION"
  | "POST_SERVICE_BILLING"

export type PlanTier = "STANDARD" | "PRO"

export interface DemoBusiness {
  id: string
  name: string
  businessType: string
  planTier: PlanTier
  icon: string
  color: string
  description: string
  activeWorkflows: WorkflowType[]
  categories: { name: string; workflow: WorkflowType }[]
}

// ============================================================================
// DEMO BUSINESS PRESETS
// ============================================================================

// ============================================================================
// DEMO-TO-REAL BUSINESS ID MAPPING
// Maps demo business IDs to real database business IDs (cuid format)
// ============================================================================

export const DEMO_TO_REAL_BUSINESS_MAP: Record<string, string> = {
  super_admin: "",           // No real business for super admin
  standard_grocery: "",     // Will be resolved dynamically
  standard_laundry: "",
  pro_laundry: "",
  pro_carwash: "",
  // New slug-based IDs (used when selecting from business list)
  "freshmart-grocery": "",
  "tastybites-food": "",
  "sparkleclean-laundry": "",
  "autoglow-carwash": "",
  "medquick-pharmacy": "",
  "homefix-services": "",
  "shopnow-ecommerce": "",
  "glowup-cosmetics": "",
  "freshmeat-direct": "",
  "woodcraft-furniture": "",
  "cityguide-directory": "",
}

// Map business type to the database slug for default demo selection
const BUSINESS_TYPE_TO_SLUG: Record<string, string> = {
  GROCERY: "freshmart-grocery",
  FOOD_DELIVERY: "tastybites-food",
  LAUNDRY: "sparkleclean-laundry",
  CAR_WASH: "autoglow-carwash",
  PHARMACY: "medquick-pharmacy",
  HOME_SERVICES: "homefix-services",
  ECOMMERCE: "shopnow-ecommerce",
  COSMETICS: "glowup-cosmetics",
  MEAT_DELIVERY: "freshmeat-direct",
  FURNITURE: "woodcraft-furniture",
  DIRECTORY: "cityguide-directory",
}

export function getSlugForDemoId(demoId: string): string | null {
  // Direct slug mapping
  if (BUSINESS_TYPE_TO_SLUG[demoId.toUpperCase()]) return BUSINESS_TYPE_TO_SLUG[demoId.toUpperCase()]
  // Legacy demo IDs
  const legacyMap: Record<string, string> = {
    standard_grocery: "freshmart-grocery",
    standard_laundry: "sparkleclean-laundry",
    pro_laundry: "sparkleclean-laundry",
    pro_carwash: "autoglow-carwash",
  }
  return legacyMap[demoId] || null
}

export const DEMO_BUSINESSES: DemoBusiness[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    businessType: "PLATFORM",
    planTier: "PRO",
    icon: "Zap",
    color: "bg-primary text-primary-foreground",
    description: "Full platform control",
    activeWorkflows: ["ECOMMERCE", "PICKUP_DELIVERY", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
    categories: [],
  },
  {
    id: "standard_grocery",
    name: "FreshMart Grocers",
    businessType: "GROCERY",
    planTier: "STANDARD",
    icon: "ShoppingCart",
    color: "bg-emerald-600 text-white",
    description: "Standard Grocery — Ecommerce & Delivery",
    activeWorkflows: ["ECOMMERCE"],
    categories: [
      { name: "Fruits & Vegetables", workflow: "ECOMMERCE" },
      { name: "Dairy & Bakery", workflow: "ECOMMERCE" },
      { name: "Snacks & Beverages", workflow: "ECOMMERCE" },
      { name: "Household Items", workflow: "ECOMMERCE" },
    ],
  },
  {
    id: "standard_laundry",
    name: "QuickWash Laundry",
    businessType: "LAUNDRY",
    planTier: "STANDARD",
    icon: "Droplets",
    color: "bg-sky-600 text-white",
    description: "Standard Laundry — Ecommerce Only",
    activeWorkflows: ["ECOMMERCE"],
    categories: [
      { name: "Wash & Fold", workflow: "ECOMMERCE" },
      { name: "Dry Cleaning", workflow: "ECOMMERCE" },
      { name: "Ironing", workflow: "ECOMMERCE" },
    ],
  },
  {
    id: "pro_laundry",
    name: "ProWash Premium",
    businessType: "LAUNDRY",
    planTier: "PRO",
    icon: "Droplets",
    color: "bg-sky-700 text-white",
    description: "Pro Laundry — Multiple Workflows",
    activeWorkflows: ["ECOMMERCE", "PICKUP_DELIVERY", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
    categories: [
      { name: "Standard Wash", workflow: "ECOMMERCE" },
      { name: "Weight Wash", workflow: "POST_SERVICE_BILLING" },
      { name: "Subscription Wash", workflow: "SUBSCRIPTION" },
      { name: "Pickup & Delivery", workflow: "PICKUP_DELIVERY" },
    ],
  },
  {
    id: "pro_carwash",
    name: "SparkleCar Wash",
    businessType: "CAR_WASH",
    planTier: "PRO",
    icon: "Car",
    color: "bg-amber-600 text-white",
    description: "Pro Car Wash — All Workflows",
    activeWorkflows: ["ECOMMERCE", "PICKUP_DELIVERY", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
    categories: [
      { name: "Subscription Wash", workflow: "SUBSCRIPTION" },
      { name: "Pickup Wash", workflow: "PICKUP_DELIVERY" },
      { name: "Accessories", workflow: "ECOMMERCE" },
      { name: "Appointment Wash", workflow: "APPOINTMENT" },
      { name: "Detailing Service", workflow: "POST_SERVICE_BILLING" },
    ],
  },
]

// ============================================================================
// WORKFLOW CONFIG
// ============================================================================

export interface WorkflowConfig {
  type: WorkflowType
  label: string
  description: string
  icon: string
  color: string
  bgColor: string
  features: string[]
  standardAllowed: boolean
  proAllowed: boolean
}

export const WORKFLOW_CONFIGS: WorkflowConfig[] = [
  {
    type: "ECOMMERCE",
    label: "Ecommerce Workflow",
    description: "Traditional online shopping flow",
    icon: "ShoppingCart",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200",
    features: ["Cart", "Checkout", "Payment", "Delivery"],
    standardAllowed: true,
    proAllowed: true,
  },
  {
    type: "PICKUP_DELIVERY",
    label: "Pickup & Delivery Workflow",
    description: "Pickup → Process → Return delivery",
    icon: "Truck",
    color: "text-sky-600",
    bgColor: "bg-sky-50 border-sky-200",
    features: ["Pickup Scheduling", "Delivery Scheduling", "Pickup Assignment", "Return Delivery"],
    standardAllowed: false,
    proAllowed: true,
  },
  {
    type: "APPOINTMENT",
    label: "Appointment Workflow",
    description: "Book time slots with technicians",
    icon: "Calendar",
    color: "text-violet-600",
    bgColor: "bg-violet-50 border-violet-200",
    features: ["Date/Time Booking", "Technician Assignment", "Slot Management"],
    standardAllowed: false,
    proAllowed: true,
  },
  {
    type: "SUBSCRIPTION",
    label: "Subscription Workflow",
    description: "Credit-based recurring packages",
    icon: "CreditCard",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    features: ["Package Purchase", "Credit Tracking", "Usage Deduction", "Renewal Reminders"],
    standardAllowed: false,
    proAllowed: true,
  },
  {
    type: "POST_SERVICE_BILLING",
    label: "Post-Service Billing Workflow",
    description: "Bill after inspection/service completion",
    icon: "Receipt",
    color: "text-rose-600",
    bgColor: "bg-rose-50 border-rose-200",
    features: ["Estimated Pricing", "Final Billing After Inspection", "Customer Approval", "Delayed Payment"],
    standardAllowed: false,
    proAllowed: true,
  },
]

// ============================================================================
// PLAN CONFIG
// ============================================================================

export interface PlanConfig {
  tier: PlanTier
  name: string
  monthlyPrice: number
  yearlyPrice: number
  implementationCharge: number
  description: string
  features: string[]
  allowedWorkflows: WorkflowType[]
  limits: { stores: number; products: number; orders: number; partners: number; staff: number }
  popular?: boolean
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    tier: "STANDARD",
    name: "Standard",
    monthlyPrice: 2999,
    yearlyPrice: 30000,
    implementationCharge: 1999,
    description: "Essential tools for single-workflow businesses",
    features: [
      "Ecommerce workflow",
      "Standard POS",
      "Delivery workflow",
      "Basic inventory management",
      "Customer management",
      "Order management",
      "Single store support",
      "Basic reports",
      "WhatsApp notifications",
    ],
    allowedWorkflows: ["ECOMMERCE"],
    limits: { stores: 1, products: 2000, orders: 5000, partners: 10, staff: 10 },
  },
  {
    tier: "PRO",
    name: "Pro",
    monthlyPrice: 4999,
    yearlyPrice: 49999,
    implementationCharge: 1999,
    description: "Full workflow engine for multi-service businesses",
    features: [
      "Multiple workflows",
      "Subscription engine",
      "Pickup & delivery workflow",
      "Appointment workflow",
      "Post-service billing",
      "Advanced workflow engine",
      "Advanced POS",
      "Multi-store support",
      "Advanced reports & analytics",
      "Priority support",
      "Custom domain",
      "White-label branding",
    ],
    allowedWorkflows: ["ECOMMERCE", "PICKUP_DELIVERY", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
    limits: { stores: 5, products: 10000, orders: 25000, partners: 50, staff: 50 },
    popular: true,
  },
]

// ============================================================================
// STORE
// ============================================================================

interface AdminState {
  // View mode
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  // Super Admin
  activePage: AdminPage
  setActivePage: (page: AdminPage) => void
  // Business Owner
  businessPage: BusinessPage
  setBusinessPage: (page: BusinessPage) => void
  // Customer App
  customerPage: CustomerPage
  setCustomerPage: (page: CustomerPage) => void
  // Delivery Partner App
  deliveryPage: DeliveryPage
  setDeliveryPage: (page: DeliveryPage) => void
  // Current business context (for business owner view)
  currentBusinessId: string
  setCurrentBusinessId: (id: string) => void
  // Business slug for DB lookups
  currentBusinessSlug: string
  setCurrentBusinessSlug: (slug: string) => void
  // Demo Business Context
  demoBusinessId: string
  setDemoBusinessId: (id: string) => void
  // Selected items
  selectedProductId: string | null
  setSelectedProductId: (id: string | null) => void
  selectedOrderId: string | null
  setSelectedOrderId: (id: string | null) => void
  selectedLeadId: string | null
  setSelectedLeadId: (id: string | null) => void
  selectedBusinessId: string | null
  setSelectedBusinessId: (id: string | null) => void
  selectedSubscriptionId: string | null
  setSelectedSubscriptionId: (id: string | null) => void
  // Shared
  searchQuery: string
  setSearchQuery: (query: string) => void
  isCreateDialogOpen: boolean
  setIsCreateDialogOpen: (open: boolean) => void
  isDetailSheetOpen: boolean
  setIsDetailSheetOpen: (open: boolean) => void
  // Customer auth state
  customerLoggedIn: boolean
  setCustomerLoggedIn: (val: boolean) => void
  customerName: string
  setCustomerName: (name: string) => void
  // Delivery partner auth state
  deliveryLoggedIn: boolean
  setDeliveryLoggedIn: (val: boolean) => void
  deliveryPartnerName: string
  setDeliveryPartnerName: (name: string) => void
  // CRM detail mode
  crmLeadTab: string
  setCrmLeadTab: (tab: string) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  viewMode: "super_admin",
  setViewMode: (mode) => set({ viewMode: mode, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  activePage: "workflow-engine",
  setActivePage: (page) => set({ activePage: page, searchQuery: "", selectedLeadId: null, selectedBusinessId: null, selectedSubscriptionId: null, isCreateDialogOpen: false, isDetailSheetOpen: false }),
  businessPage: "dashboard",
  setBusinessPage: (page) => set({ businessPage: page, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  customerPage: "auth",
  setCustomerPage: (page) => set({ customerPage: page, searchQuery: "" }),
  deliveryPage: "login",
  setDeliveryPage: (page) => set({ deliveryPage: page }),
  currentBusinessId: "",
  setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
  // Demo Business Context — used for UI context, sidebar config etc.
  demoBusinessId: "super_admin",
  setDemoBusinessId: (id) => set({ demoBusinessId: id }),
  // Business slug — for looking up the real DB business ID
  currentBusinessSlug: "",
  setCurrentBusinessSlug: (slug: string) => set({ currentBusinessSlug: slug }),
  selectedProductId: null,
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id, isDetailSheetOpen: id !== null }),
  selectedBusinessId: null,
  setSelectedBusinessId: (id) => set({ selectedBusinessId: id, isDetailSheetOpen: id !== null }),
  selectedSubscriptionId: null,
  setSelectedSubscriptionId: (id) => set({ selectedSubscriptionId: id, isDetailSheetOpen: id !== null }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  isCreateDialogOpen: false,
  setIsCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
  isDetailSheetOpen: false,
  setIsDetailSheetOpen: (open) => set({ isDetailSheetOpen: open }),
  customerLoggedIn: false,
  setCustomerLoggedIn: (val) => set({ customerLoggedIn: val }),
  customerName: "",
  setCustomerName: (name) => set({ customerName: name }),
  deliveryLoggedIn: false,
  setDeliveryLoggedIn: (val) => set({ deliveryLoggedIn: val }),
  deliveryPartnerName: "",
  setDeliveryPartnerName: (name) => set({ deliveryPartnerName: name }),
  crmLeadTab: "timeline",
  setCrmLeadTab: (tab) => set({ crmLeadTab: tab }),
}))
