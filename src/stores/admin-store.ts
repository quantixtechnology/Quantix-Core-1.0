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

export type BusinessPage =
  | "dashboard"
  | "orders"
  | "products"
  | "pos"
  | "customers"
  | "reports"
  | "settings"

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
  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page, searchQuery: "", selectedLeadId: null, selectedBusinessId: null, selectedSubscriptionId: null, isCreateDialogOpen: false, isDetailSheetOpen: false }),
  businessPage: "dashboard",
  setBusinessPage: (page) => set({ businessPage: page, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  customerPage: "auth",
  setCustomerPage: (page) => set({ customerPage: page, searchQuery: "" }),
  deliveryPage: "login",
  setDeliveryPage: (page) => set({ deliveryPage: page }),
  currentBusinessId: "biz_1",
  setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
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
