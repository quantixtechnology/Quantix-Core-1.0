"use client"

import { create } from "zustand"
import { PLATFORM_IMAGE_DEFAULTS } from "@/config/product-image-config"
import type { CardStyle } from "@/design-system"
import { type PwaAppearance, PWA_APPEARANCE_DEFAULTS } from "@/lib/pwa-appearance"

// ── Business theme (overrides from ecommerceConfig.theme) ──────────────────
export interface BusinessTheme {
  /** Extra brand tint color (lighter accent, e.g. for hover states) */
  accentColor: string
  /** Card corner style preset — "modern" | "minimal" | "bold" */
  cardStyle: CardStyle
  /** Card border-radius override in pixels (0 = use cardStyle default) */
  cardBorderRadius: number
}

export const DEFAULT_BUSINESS_THEME: BusinessTheme = {
  accentColor:      "",        // empty = derive from primaryColor in components
  cardStyle:        "modern",
  cardBorderRadius: 0,
}

// ============================================================================
// VIEW / ROUTING TYPES
// ============================================================================

export type ViewMode = "super_admin" | "business_owner" | "customer" | "delivery_partner"

export type AdminPage =
  | "dashboard"
  | "leads"
  | "businesses"
  | "create-business"
  | "manage-business"
  | "subscriptions"
  | "onboarding"
  | "domains"
  | "sales"
  | "notifications"
  | "settings"
  | "ops-dashboard"
  | "deployment-pipeline"
  | "build-automation"
  | "release-management"
  | "play-store"
  | "mobile-versions"
  | "client-assets"
  | "tenant-provisioning"
  | "product-import"
  | "onboarding-checklist"
  | "backup-monitoring"
  | "security-access"
  | "audit-logs"
  | "platform-analytics"
  | "revenue"
  | "support"
  | "mobile-apps"
  | "workflow-engine"
  | "plan-management"
  | "payment-plugins"
  | "platform-users"
  | "roles-permissions"
  | "leads-import"
  | "business-data-import"
  | "proposals"
  | "proposal-documents"
  | "payment-config"
  | "platform-invoices"
  | "addons"
  | "platform-settings"
  | "commission-calculator"
  | "hrms-employees"
  | "hrms-offer-letter"
  | "hrms-annexure"
  | "hrms-commission-slip"
  | "hrms-payslip"
  | "hrms-templates"
  | "hrms-settings"
  | "rev-signup-ownership"
  | "rev-renewal-ownership"
  | "rev-addon-ownership"
  | "rev-commission-processing"
  | "brand-studio"
  | "quantix-website"
  | "account-billing"
  | "laundry-os"
  | "laundry-businesses"
  | "products"
  | "workspaces"
  | "commerce-templates"

export type LaundryBusinessPage =
  | "crm-dashboard"
  | "crm-leads"
  | "crm-opportunities"
  | "crm-activities"
  | "crm-tasks"
  | "crm-reports"
  | "crm-settings"
  | "dashboard"
  | "inbox"
  | "orders"
  | "new-order"
  | "audit-queue"
  | "payment-queue"
  | "packing-queue"
  | "dispatch-queue"
  | "store-receive-queue"
  | "ready-delivery-queue"
  | "pickup-bags"
  | "bag-management"
  | "dispatch-center"
  | "pickup-scheduler"
  | "delivery-assignments"
  | "delivery-executives"
  | "mobile-apps"
  | "order-detail"
  | "customers"
  | "stores"
  | "processing-centers"
  | "reports"
  | "settings"
  | "categories"
  | "garments"
  | "services"
  | "pricing"
  | "subscription-plans"
  | "charges-rules"
  | "pricing-simulator"
  | "subscriptions"
  | "roles"
  | "staff"
  | "ws-wash"
  | "ws-dry"
  | "ws-dryclean"
  | "ws-iron"
  | "ws-fold"
  | "ws-qc"
  | "ws-pack"
  | "ws-sorting"
  | "ws-transit"
  | "audit-barcode"
  | "garment-lookup"
  | "navigation"
  // Marketing module (Phase 1: dashboard/discounts/coupons/reports live; rest placeholder)
  | "marketing-dashboard"
  | "marketing-discounts"
  | "marketing-coupons"
  | "marketing-loyalty"
  | "marketing-membership"
  | "marketing-giftcards"
  | "marketing-referral"
  | "marketing-credits"
  | "marketing-cart-recovery"
  | "marketing-campaigns"
  | "marketing-reports"

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
  | "delivery-partners"
  | "stores"
  | "storefront"
  | "workflow-config"
  | "workflows"
  | "gateway-config"
  | "business-data-import"
  | "customer-import"
  | "user-creation"
  | "user-management"
  | "categories"
  | "branding"
  | "feature-flags"
  | "subscription-view"
  | "customer-app"
  | "delivery-app"
  | "admin-app"
  | "website"
  | "onboarding-progress"
  | "invoices"

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
  | "notifications"
  | "wishlist"
  | "review"
  | "coupons"
  | "invoices"
  | "invoice-detail"

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

// ============================================================================
// BUSINESS TYPE → WORKFLOWS MAPPING
// Replaces demo-based activeWorkflows — derives from real businessType
// ============================================================================

export const BUSINESS_TYPE_WORKFLOWS: Record<string, WorkflowType[]> = {
  GROCERY:       ["ECOMMERCE", "PICKUP_DELIVERY"],
  ECOMMERCE:     ["ECOMMERCE"],
  FOOD_DELIVERY: ["ECOMMERCE", "PICKUP_DELIVERY"],
  LAUNDRY:       ["ECOMMERCE", "PICKUP_DELIVERY", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
  CAR_WASH:      ["ECOMMERCE", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
  PHARMACY:      ["ECOMMERCE", "PICKUP_DELIVERY"],
  HOME_SERVICES: ["APPOINTMENT", "POST_SERVICE_BILLING"],
  MEAT_DELIVERY: ["ECOMMERCE", "PICKUP_DELIVERY"],
  COSMETICS:     ["ECOMMERCE"],
  FURNITURE:     ["ECOMMERCE"],
  DIRECTORY:     ["ECOMMERCE"],
  PLATFORM:      ["ECOMMERCE", "PICKUP_DELIVERY", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
}

// ============================================================================
// BUSINESS TYPE → UI CONFIG (icons, colors, labels)
// Replaces DEMO_BUSINESSES for display purposes only
// ============================================================================

export interface BusinessTypeUI {
  icon: string           // lucide icon name
  color: string          // tailwind bg+text classes
  label: string          // human-readable label
  description: string
}

export const BUSINESS_TYPE_UI: Record<string, BusinessTypeUI> = {
  GROCERY:       { icon: "ShoppingCart", color: "bg-emerald-600 text-white", label: "Grocery",          description: "Fresh grocery & daily essentials" },
  ECOMMERCE:     { icon: "ShoppingBag",  color: "bg-indigo-600 text-white",  label: "E-Commerce",       description: "Online retail store" },
  FOOD_DELIVERY: { icon: "ChefHat",      color: "bg-orange-600 text-white",  label: "Food Delivery",    description: "Restaurant & cloud kitchen" },
  LAUNDRY:       { icon: "Droplets",     color: "bg-sky-600 text-white",     label: "Laundry",          description: "Laundry & dry cleaning" },
  CAR_WASH:      { icon: "Car",          color: "bg-amber-600 text-white",   label: "Car Wash",         description: "Car & bike wash services" },
  PHARMACY:      { icon: "Pill",         color: "bg-teal-600 text-white",    label: "Pharmacy",         description: "Medical & pharmacy" },
  HOME_SERVICES: { icon: "Wrench",       color: "bg-rose-600 text-white",    label: "Home Services",    description: "Repair & maintenance" },
  MEAT_DELIVERY: { icon: "Beef",         color: "bg-red-700 text-white",     label: "Meat & Seafood",   description: "Fresh meat & seafood delivery" },
  COSMETICS:     { icon: "Sparkles",     color: "bg-pink-600 text-white",    label: "Cosmetics",        description: "Beauty & personal care" },
  FURNITURE:     { icon: "Sofa",         color: "bg-yellow-700 text-white",  label: "Furniture",        description: "Furniture & home decor" },
  DIRECTORY:     { icon: "MapPin",       color: "bg-cyan-600 text-white",    label: "Directory",        description: "Local business directory" },
  PLATFORM:      { icon: "Zap",          color: "bg-primary text-primary-foreground", label: "Platform Admin", description: "Quantix platform control" },
}

// ============================================================================
// WORKFLOW CONFIG (unchanged — used by workflow engine)
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
// PLAN CONFIG — Feature access only. No pricing. Billing is dynamic per business.
// ============================================================================

export interface PlanConfig {
  tier: PlanTier
  name: string
  description: string
  features: string[]
  allowedWorkflows: WorkflowType[]
  limits: { stores: number; products: number; orders: number; partners: number; staff: number }
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    tier: "STANDARD",
    name: "Standard",
    description: "Core ecommerce + basic operations",
    features: [
      "Ecommerce workflow",
      "Standard POS",
      "Basic inventory management",
      "Customer management",
      "Order management",
      "Basic reports",
      "WhatsApp notifications",
    ],
    allowedWorkflows: ["ECOMMERCE"],
    limits: { stores: 1, products: 2000, orders: 5000, partners: 10, staff: 10 },
  },
  {
    tier: "PRO",
    name: "Pro",
    description: "Full workflow engine for multi-service businesses",
    features: [
      "All Standard features",
      "Multi-workflow access",
      "Subscription engine",
      "Pickup & delivery workflow",
      "Appointment workflow",
      "Post-service billing",
      "Advanced workflow engine",
      "Advanced POS",
      "Multi-store support",
      "Advanced reports & analytics",
      "Custom domain",
      "White-label branding",
    ],
    allowedWorkflows: ["ECOMMERCE", "PICKUP_DELIVERY", "APPOINTMENT", "SUBSCRIPTION", "POST_SERVICE_BILLING"],
    limits: { stores: 5, products: 10000, orders: 25000, partners: 50, staff: 50 },
  },
]

// ============================================================================
// STORE — Real tenant context, no demo/mock state
// ============================================================================

interface AdminState {
  // ── View routing ────────────────────────────────────────────────────────
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  // ── Super Admin pages ───────────────────────────────────────────────────
  activePage: AdminPage
  setActivePage: (page: AdminPage) => void
  // ── Business Owner pages ────────────────────────────────────────────────
  businessPage: BusinessPage
  setBusinessPage: (page: BusinessPage) => void
  // ── Customer App pages ──────────────────────────────────────────────────
  customerPage: CustomerPage
  customerNavStack: CustomerPage[]
  setCustomerPage: (page: CustomerPage) => void
  // Push page onto history stack (supports back navigation)
  pushCustomerPage: (page: CustomerPage) => void
  // Pop last page off history stack and navigate back
  popCustomerPage: () => void
  // ── Delivery Partner pages ──────────────────────────────────────────────
  deliveryPage: DeliveryPage
  setDeliveryPage: (page: DeliveryPage) => void
  // ── Laundry Business Workspace pages ────────────────────────────────────
  laundryPage: LaundryBusinessPage
  setLaundryPage: (page: LaundryBusinessPage) => void
  // Order selected for the dedicated Barcode Generation page.
  processingOrderId: string | null
  setProcessingOrderId: (id: string | null) => void
  openAuditBarcode: (orderId: string) => void

  // ── Real tenant context ─────────────────────────────────────────────────
  // The real database business ID currently being viewed/managed
  currentBusinessId: string
  setCurrentBusinessId: (id: string) => void
  // Business metadata for display — set when super admin impersonates or business owner logs in
  currentBusinessName: string
  currentBusinessType: string       // e.g. "GROCERY", "LAUNDRY"
  currentBusinessSlug: string
  currentBusinessPrimaryColor: string  // hex, e.g. "#10B981"
  setCurrentBusinessPrimaryColor: (color: string) => void
  currentBusinessLogo: string          // URL of the business logo image
  currentBusinessFavicon: string       // URL of the browser-tab favicon
  setCurrentBusinessLogo: (url: string) => void
  setCurrentBusinessFavicon: (url: string) => void
  // Active store within the current business (set by storefront detection or store selection)
  currentStoreId: string
  setCurrentStoreId: (id: string) => void
  currentStoreName: string
  setCurrentStoreName: (name: string) => void
  currentStoreCode: string
  setCurrentStoreCode: (code: string) => void
  // Set all business context at once (used by login, impersonation, business selection)
  setCurrentBusiness: (id: string, name: string, type: string, slug?: string) => void
  // Set business context for real business owner login (does NOT set isImpersonating)
  setBusinessOwnerContext: (id: string, name: string, type: string, slug?: string) => void
  // Clear business context (when super admin exits impersonation)
  clearCurrentBusiness: () => void
  // Reset ALL workspace-scoped state (view mode, business/tenant context,
  // workspace page, support mode, storefront context) back to the platform
  // defaults. Used by logout / workspace cleanup. Never touches Super Admin
  // selections or navigation data.
  resetWorkspaceState: () => void
  // Whether super admin is currently impersonating a business
  isImpersonating: boolean

  // ── Laundry OS Support Mode ─────────────────────────────────────────────
  // Platform admin can enter Laundry OS in support mode (not impersonation)
  supportMode: {
    active: boolean
    platformAdminId: string
    platformAdminName: string
    platformAdminRole: string
    laundryBusinessId: string
    laundryBusinessName: string
  }
  setSupportMode: (ctx: {
    platformAdminId: string
    platformAdminName: string
    platformAdminRole: string
    laundryBusinessId: string
    laundryBusinessName: string
  }) => void
  clearSupportMode: () => void

  // ── Selected items (CRM / detail panels) ───────────────────────────────
  selectedProductId: string | null
  setSelectedProductId: (id: string | null) => void
  selectedOrderId: string | null
  setSelectedOrderId: (id: string | null) => void
  // Customer-360 deep-link: New Order "View Customer/Orders" quick actions set
  // this so the target laundry view opens focused on that customer (consumed +
  // cleared by the Customers / Orders views).
  laundryFocusCustomerId: string | null
  setLaundryFocusCustomerId: (id: string | null) => void
  // Normalized mobile carried alongside the focus id so the Orders view can
  // filter by the person's phone (matching the phone-aggregated snapshot),
  // not just one Customer id. Null when the customer has no usable phone.
  laundryFocusCustomerPhone: string | null
  setLaundryFocusCustomerPhone: (phone: string | null) => void
  selectedReviewProductId: string | null
  setSelectedReviewProductId: (id: string | null) => void
  selectedLeadId: string | null
  setSelectedLeadId: (id: string | null) => void
  selectedBusinessId: string | null
  setSelectedBusinessId: (id: string | null) => void
  // Business to resume in the onboarding wizard (null = fresh create)
  resumeBusinessId: string | null
  setResumeBusinessId: (id: string | null) => void
  // Business opened in the full-page Business Management wizard
  manageBusinessId: string | null
  setManageBusinessId: (id: string | null) => void
  selectedSubscriptionId: string | null
  setSelectedSubscriptionId: (id: string | null) => void

  // ── Shared UI state ─────────────────────────────────────────────────────
  searchQuery: string
  setSearchQuery: (query: string) => void
  isCreateDialogOpen: boolean
  setIsCreateDialogOpen: (open: boolean) => void
  isDetailSheetOpen: boolean
  setIsDetailSheetOpen: (open: boolean) => void

  // ── Customer auth state ─────────────────────────────────────────────────
  customerLoggedIn: boolean
  setCustomerLoggedIn: (val: boolean) => void
  customerName: string
  setCustomerName: (name: string) => void

  // ── Delivery partner auth state ─────────────────────────────────────────
  deliveryLoggedIn: boolean
  setDeliveryLoggedIn: (val: boolean) => void
  deliveryPartnerName: string
  setDeliveryPartnerName: (name: string) => void

  // ── Store list refresh signal ───────────────────────────────────────────
  // Increment to force context bar + stores view to re-fetch from DB.
  storeRefreshKey: number
  bumpStoreRefresh: () => void

  // ── CRM state ──────────────────────────────────────────────────────────
  crmLeadTab: string
  setCrmLeadTab: (tab: string) => void

  // ── Order stage labels ──────────────────────────────────────────────────
  orderStages: import('@/lib/order-stages').OrderStage[]
  setOrderStages: (stages: import('@/lib/order-stages').OrderStage[]) => void

  // ── Storefront product image config (hydrated from ecommerceConfig) ──────
  currentImageConfig: import('@/config/product-image-config').ProductImageConfig
  setImageConfig: (cfg: Partial<import('@/config/product-image-config').ProductImageConfig>) => void

  // ── Business theme (card style, accent color — from ecommerceConfig.theme)
  currentBusinessTheme: BusinessTheme
  setBusinessTheme: (theme: Partial<BusinessTheme>) => void

  // ── Storefront homepage content (business-controlled, from settings JSON)
  storefrontWhyChooseUs: Array<{ emoji: string; title: string; desc: string }>
  setStorefrontWhyChooseUs: (items: Array<{ emoji: string; title: string; desc: string }>) => void
  storefrontPromiseBar: Array<{ emoji: string; label: string; sub: string }>
  setStorefrontPromiseBar: (items: Array<{ emoji: string; label: string; sub: string }>) => void

  // ── PWA appearance settings (hydrated from ecommerceConfig.pwaAppearance) ─
  currentPwaAppearance: PwaAppearance
  setPwaAppearance: (appearance: Partial<PwaAppearance>) => void

  // ── Customer invoice navigation ─────────────────────────────────────────
  selectedInvoiceId: string | null
  setSelectedInvoiceId: (id: string | null) => void

  // ── Navigation manager revision (triggers sidebar re-fetch) ──────────────
  navRevision: number
  bumpNavRevision: () => void
}

export const useAdminStore = create<AdminState>((set) => ({
  // View
  viewMode: "super_admin",
  setViewMode: (mode) => set({ viewMode: mode, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),

  // Pages
  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page, searchQuery: "", selectedLeadId: null, selectedBusinessId: null, selectedSubscriptionId: null, isCreateDialogOpen: false, isDetailSheetOpen: false }),
  businessPage: "dashboard",
  setBusinessPage: (page) => set({ businessPage: page, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  customerPage: "auth",
  customerNavStack: [],
  setCustomerPage: (page) => set({ customerPage: page, customerNavStack: [], searchQuery: "" }),
  pushCustomerPage: (page) => set((s) => ({
    customerNavStack: [...s.customerNavStack, s.customerPage],
    customerPage: page,
    searchQuery: "",
  })),
  popCustomerPage: () => set((s) => {
    if (s.customerNavStack.length === 0) return {}
    const stack = [...s.customerNavStack]
    const prev = stack.pop()!
    return { customerPage: prev, customerNavStack: stack, searchQuery: "" }
  }),
  deliveryPage: "login",
  setDeliveryPage: (page) => set({ deliveryPage: page }),
  laundryPage: "dashboard",
  setLaundryPage: (page) => set({ laundryPage: page, searchQuery: "" }),
  processingOrderId: null,
  setProcessingOrderId: (id) => set({ processingOrderId: id }),
  openAuditBarcode: (orderId) => set({ processingOrderId: orderId, laundryPage: "audit-barcode", searchQuery: "" }),

  // Real tenant context
  currentBusinessId: "",
  setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
  currentStoreId: "",
  setCurrentStoreId: (id) => set({ currentStoreId: id }),
  currentStoreName: "",
  setCurrentStoreName: (name) => set({ currentStoreName: name }),
  currentStoreCode: "",
  setCurrentStoreCode: (code) => set({ currentStoreCode: code }),
  currentBusinessName: "",
  currentBusinessType: "",
  currentBusinessSlug: "",
  currentBusinessPrimaryColor: "",
  setCurrentBusinessPrimaryColor: (color) => set({ currentBusinessPrimaryColor: color }),
  currentBusinessLogo: "",
  currentBusinessFavicon: "",
  setCurrentBusinessLogo: (url) => set({ currentBusinessLogo: url }),
  setCurrentBusinessFavicon: (url) => set({ currentBusinessFavicon: url }),
  setCurrentBusiness: (id, name, type, slug = "") => set({
    currentBusinessId: id,
    currentBusinessName: name,
    currentBusinessType: type,
    currentBusinessSlug: slug,
    isImpersonating: true,
    viewMode: "business_owner",
    businessPage: "dashboard",
    searchQuery: "",
  }),
  setBusinessOwnerContext: (id, name, type, slug = "") => set({
    currentBusinessId: id,
    currentBusinessName: name,
    currentBusinessType: type,
    currentBusinessSlug: slug,
    isImpersonating: false,
    viewMode: "business_owner",
    businessPage: "dashboard",
    searchQuery: "",
  }),
  clearCurrentBusiness: () => set({
    currentBusinessId: "",
    currentBusinessName: "",
    currentBusinessType: "",
    currentBusinessSlug: "",
    currentBusinessPrimaryColor: "",
    currentBusinessLogo: "",
    currentBusinessFavicon: "",
    currentStoreId: "",
    currentStoreName: "",
    currentStoreCode: "",
    isImpersonating: false,
    viewMode: "super_admin",
    searchQuery: "",
    orderStages: [],
  }),
  resetWorkspaceState: () => set({
    // View routing → platform default (never leave a workspace view active)
    viewMode: "super_admin",
    // Workspace pages → defaults
    businessPage: "dashboard",
    laundryPage: "dashboard",
    processingOrderId: null,
    // Real tenant context → cleared (a NEW session must rebuild it)
    currentBusinessId: "",
    currentBusinessName: "",
    currentBusinessType: "",
    currentBusinessSlug: "",
    currentBusinessPrimaryColor: "",
    currentBusinessLogo: "",
    currentBusinessFavicon: "",
    currentStoreId: "",
    currentStoreName: "",
    currentStoreCode: "",
    isImpersonating: false,
    // Support mode → off
    supportMode: {
      active: false,
      platformAdminId: "",
      platformAdminName: "",
      platformAdminRole: "",
      laundryBusinessId: "",
      laundryBusinessName: "",
    },
    // Storefront context → defaults (business-scoped, must not leak to next session)
    orderStages: [],
    currentImageConfig: PLATFORM_IMAGE_DEFAULTS,
    currentBusinessTheme: DEFAULT_BUSINESS_THEME,
    storefrontWhyChooseUs: [],
    storefrontPromiseBar: [],
    currentPwaAppearance: PWA_APPEARANCE_DEFAULTS,
    storeRefreshKey: 0,
    // Shared UI → closed
    searchQuery: "",
    isCreateDialogOpen: false,
    isDetailSheetOpen: false,
    // Customer / delivery flags → logged out
    customerLoggedIn: false,
    customerName: "",
    deliveryLoggedIn: false,
    deliveryPartnerName: "",
  }),
  isImpersonating: false,

  // ── Laundry OS Support Mode ────────────────────────────────────────────
  supportMode: {
    active: false,
    platformAdminId: "",
    platformAdminName: "",
    platformAdminRole: "",
    laundryBusinessId: "",
    laundryBusinessName: "",
  },
  setSupportMode: (ctx) => set({
    supportMode: { ...ctx, active: true },
    currentBusinessId: ctx.laundryBusinessId,
    currentBusinessName: ctx.laundryBusinessName,
    currentBusinessType: "LAUNDRY",
    viewMode: "business_owner",
    laundryPage: "dashboard",
  }),
  clearSupportMode: () => set({
    supportMode: {
      active: false,
      platformAdminId: "",
      platformAdminName: "",
      platformAdminRole: "",
      laundryBusinessId: "",
      laundryBusinessName: "",
    },
    currentBusinessId: "",
    currentBusinessName: "",
    currentBusinessType: "",
    isImpersonating: false,
    viewMode: "super_admin",
  }),

  // Selected items
  selectedProductId: null,
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
  laundryFocusCustomerId: null,
  setLaundryFocusCustomerId: (id) => set({ laundryFocusCustomerId: id }),
  laundryFocusCustomerPhone: null,
  setLaundryFocusCustomerPhone: (phone) => set({ laundryFocusCustomerPhone: phone }),
  selectedReviewProductId: null,
  setSelectedReviewProductId: (id) => set({ selectedReviewProductId: id }),
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id, isDetailSheetOpen: id !== null }),
  selectedBusinessId: null,
  setSelectedBusinessId: (id) => set({ selectedBusinessId: id, isDetailSheetOpen: id !== null }),
  resumeBusinessId: null,
  setResumeBusinessId: (id) => set({ resumeBusinessId: id }),
  manageBusinessId: null,
  setManageBusinessId: (id) => set({ manageBusinessId: id }),
  selectedSubscriptionId: null,
  setSelectedSubscriptionId: (id) => set({ selectedSubscriptionId: id, isDetailSheetOpen: id !== null }),

  // Shared UI
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  isCreateDialogOpen: false,
  setIsCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
  isDetailSheetOpen: false,
  setIsDetailSheetOpen: (open) => set({ isDetailSheetOpen: open }),

  // Customer
  customerLoggedIn: false,
  setCustomerLoggedIn: (val) => set({ customerLoggedIn: val }),
  customerName: "",
  setCustomerName: (name) => set({ customerName: name }),

  // Delivery
  deliveryLoggedIn: false,
  setDeliveryLoggedIn: (val) => set({ deliveryLoggedIn: val }),
  deliveryPartnerName: "",
  setDeliveryPartnerName: (name) => set({ deliveryPartnerName: name }),

  // Store refresh signal
  storeRefreshKey: 0,
  bumpStoreRefresh: () => set(s => ({ storeRefreshKey: s.storeRefreshKey + 1 })),

  // CRM
  crmLeadTab: "timeline",
  setCrmLeadTab: (tab) => set({ crmLeadTab: tab }),

  // Order stage labels
  orderStages: [],
  setOrderStages: (stages) => set({ orderStages: stages }),

  // Storefront product image config
  currentImageConfig: PLATFORM_IMAGE_DEFAULTS,
  setImageConfig: (cfg) => set((s) => ({ currentImageConfig: { ...s.currentImageConfig, ...cfg } })),

  // Business theme
  currentBusinessTheme: DEFAULT_BUSINESS_THEME,
  setBusinessTheme: (theme) => set((s) => ({ currentBusinessTheme: { ...s.currentBusinessTheme, ...theme } })),

  storefrontWhyChooseUs: [],
  setStorefrontWhyChooseUs: (items) => set({ storefrontWhyChooseUs: items }),
  storefrontPromiseBar: [],
  setStorefrontPromiseBar: (items) => set({ storefrontPromiseBar: items }),

  currentPwaAppearance: PWA_APPEARANCE_DEFAULTS,
  setPwaAppearance: (appearance) => set((s) => ({
    currentPwaAppearance: { ...s.currentPwaAppearance, ...appearance },
  })),

  // Customer invoice navigation
  selectedInvoiceId: null,
  setSelectedInvoiceId: (id) => set({ selectedInvoiceId: id }),

  // Navigation manager revision
  navRevision: 0,
  bumpNavRevision: () => set((s) => ({ navRevision: s.navRevision + 1 })),
}))
