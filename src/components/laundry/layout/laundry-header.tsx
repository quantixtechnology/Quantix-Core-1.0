"use client"

// Laundry OS shell header — premium enterprise top bar: global search UI,
// notification bell, and tenant user profile. Presentation only (search and
// notifications are UI shells; no backend behavior changed). Profile logout
// uses the existing auth action.

import { useState } from "react"
import { Menu, Shield, Search, Bell, ChevronDown, LogOut, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import { ROLES } from "@/lib/constants"

export function LaundryHeader({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const { supportMode, clearSupportMode } = useAdminStore()
  const { user, logout } = useAuthStore()
  const { assignedRbacRole, isLoaded, businessRole, platformRole } = useRuntimeAuth()
  const { setLaundryPage } = useAdminStore()
  const [search, setSearch] = useState("")

  const name = user?.name ?? "Laundry User"
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  const effectiveRole = platformRole || assignedRbacRole || businessRole
  const roleLabel = isLoaded
    ? (ROLES[effectiveRole as keyof typeof ROLES]?.label || effectiveRole || "Team Member")
    : "Loading..."

  // Detect GAR codes in search bar and redirect to Garment Lookup
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) {
      const q = search.trim().toUpperCase()
      if (/^GAR\d{12}$/.test(q) || /^ITM-/.test(q)) {
        e.preventDefault()
        setSearch(q)
        setLaundryPage("garment-lookup")
      }
    }
  }

  const handleLogout = () => { try { logout() } catch {} ; window.location.href = "/" }

  return (
    <>
      {supportMode.active && (
        <div className="flex h-9 items-center justify-center gap-2 bg-amber-500 px-4 text-xs font-medium text-white">
          <Shield className="h-3.5 w-3.5" />
          <span>Logged in as <strong>{supportMode.platformAdminName}</strong> (Support Mode)</span>
          <span className="mx-2 opacity-50">|</span>
          <span className="opacity-80">{supportMode.laundryBusinessName}</span>
          <button onClick={() => { clearSupportMode(); window.location.href = "/" }} className="ml-2 rounded bg-white/20 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/30">Exit Support Mode</button>
        </div>
      )}
      <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <Button variant="ghost" size="icon" className="md:hidden text-slate-600" onClick={onMobileMenuClick}><Menu className="h-5 w-5" /></Button>
        <SidebarTrigger className="hidden md:flex text-slate-500" />

        {/* Global search */}
        <div className="relative flex-1 max-w-xl mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search orders, customers, invoices... (GAR codes open lookup)"
            className="h-10 pl-10 bg-slate-50 border-slate-200 rounded-lg text-sm focus-visible:bg-white font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b"><p className="text-sm font-semibold text-slate-800">Notifications</p></div>
              <div className="px-4 py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</div>
            </PopoverContent>
          </Popover>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg pl-1.5 pr-2 py-1 hover:bg-slate-50">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-blue-600 text-white text-xs font-bold">{initials}</AvatarFallback></Avatar>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-sm font-semibold text-slate-800">{name}</p>
                  <p className="text-[11px] text-slate-400">{roleLabel}</p>
                </div>
                <ChevronDown className="hidden sm:block h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs font-normal text-slate-400">{user?.email || roleLabel}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled><UserCircle className="h-4 w-4 mr-2" /> My Profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  )
}
