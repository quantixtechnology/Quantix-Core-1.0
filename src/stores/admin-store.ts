"use client"

import { create } from "zustand"

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

interface AdminState {
  activePage: AdminPage
  setActivePage: (page: AdminPage) => void
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
  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page, searchQuery: "", selectedLeadId: null, selectedBusinessId: null, selectedSubscriptionId: null, isCreateDialogOpen: false, isDetailSheetOpen: false }),
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
