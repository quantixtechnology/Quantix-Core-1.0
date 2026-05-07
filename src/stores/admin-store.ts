"use client"

import { create } from "zustand"

export type ViewMode = "super_admin" | "business_owner"

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
  // Current business context (for business owner view)
  currentBusinessId: string
  setCurrentBusinessId: (id: string) => void
  // Shared
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedLeadId: string | null
  setSelectedLeadId: (id: string | null) => void
  selectedBusinessId: string | null
  setSelectedBusinessId: (id: string | null) => void
  selectedSubscriptionId: string | null
  setSelectedSubscriptionId: (id: string | null) => void
  isCreateDialogOpen: boolean
  setIsCreateDialogOpen: (open: boolean) => void
  isDetailSheetOpen: boolean
  setIsDetailSheetOpen: (open: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  viewMode: "super_admin",
  setViewMode: (mode) => set({ viewMode: mode, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page, searchQuery: "", selectedLeadId: null, selectedBusinessId: null, selectedSubscriptionId: null, isCreateDialogOpen: false, isDetailSheetOpen: false }),
  businessPage: "dashboard",
  setBusinessPage: (page) => set({ businessPage: page, searchQuery: "", isCreateDialogOpen: false, isDetailSheetOpen: false }),
  currentBusinessId: "biz_1",
  setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id, isDetailSheetOpen: id !== null }),
  selectedBusinessId: null,
  setSelectedBusinessId: (id) => set({ selectedBusinessId: id, isDetailSheetOpen: id !== null }),
  selectedSubscriptionId: null,
  setSelectedSubscriptionId: (id) => set({ selectedSubscriptionId: id, isDetailSheetOpen: id !== null }),
  isCreateDialogOpen: false,
  setIsCreateDialogOpen: (open) => set({ isCreateDialogOpen: open }),
  isDetailSheetOpen: false,
  setIsDetailSheetOpen: (open) => set({ isDetailSheetOpen: open }),
}))
