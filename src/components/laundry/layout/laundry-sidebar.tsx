"use client"

import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect } from "react"
import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useResponsive } from "@/hooks/use-responsive"
import { useLaundryLicensing } from "@/hooks/use-laundry-licensing"
import { LAUNDRY_ROLES } from "@/lib/permissions"
import {
  LayoutDashboard, Inbox, ShoppingBag, Users, Store,
  Factory, BarChart3, Settings, ChevronLeft, Sparkles, Plus,
  ClipboardCheck, CreditCard, Truck, Tags, Shirt, WashingMachine, IndianRupee,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type NavItem = {
  key: LaundryBusinessPage
  label: string
  icon: React.ComponentType<{ className?: string }>
  feature?: string
}

const PROCESSING_ROLES = new Set(["PROCESSING_MANAGER", "PROCESSING_STAFF", "QC_EXECUTIVE"])

// Orders / Customers / Reports / Settings are not yet implemented as real
// modules (their views are static "coming soon"/"future update" stubs), so they
// are hidden from navigation rather than shown as placeholder screens. The
// page-validation effect below redirects any stale laundryPage value to
// "dashboard", so the stub views are unreachable.
const processingNavItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
]

// OPERATIONS — the live workflow (engine-driven). Unchanged.
const storeNavItems: NavItem[] = [
  { key: "dashboard",          label: "Dashboard",          icon: LayoutDashboard },
  { key: "inbox",              label: "My Inbox",           icon: Inbox },
  { key: "new-order",          label: "New Order",          icon: Plus },
  { key: "audit-queue",        label: "Store Audit",        icon: ClipboardCheck },
  { key: "payment-queue",      label: "Payment Collection", icon: CreditCard },
  { key: "dispatch-queue",     label: "Dispatch",           icon: Truck },
]

// MASTERS — permanent, always-editable OPERATIONAL master data. The Business /
// Tenant itself is owned by the Quantix Platform and is NOT recreated here.
// Processing Center is a Store Type, not a separate module. Services / Pricing /
// Subscription Plans / Employees / etc. are added as their masters ship.
const mastersNavItems: NavItem[] = [
  { key: "stores",     label: "Stores & Processing Centers", icon: Store },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "services",   label: "Services",   icon: WashingMachine },
  { key: "garments",   label: "Garments",   icon: Shirt },
  { key: "pricing",    label: "Pricing Engine", icon: IndianRupee },
]

interface LaundrySidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function LaundrySidebar({ mobileOpen = false, onMobileOpenChange }: LaundrySidebarProps) {
  const { laundryPage, setLaundryPage } = useAdminStore()
  const { user, currentBusinessId, currentRole } = useAuthStore()
  const { isMobile } = useResponsive()
  const { isEnabled } = useLaundryLicensing(currentBusinessId)

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "LB"
  const userName = user?.name ?? "Laundry User"

  const sidebarVars = {
    "--sidebar": "#04132E",
    "--sidebar-foreground": "#FFFFFF",
    "--sidebar-accent": "rgba(255,255,255,0.06)",
    "--sidebar-accent-foreground": "#FFFFFF",
    "--sidebar-border": "rgba(255,255,255,0.08)",
    "--sidebar-primary": "#0284C7",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-ring": "#0284C7",
    "--sidebar-heading": "rgba(56,189,248,0.55)",
  } as React.CSSProperties

  const isProcessingRole = currentRole ? PROCESSING_ROLES.has(currentRole) : false
  const operationsItems = isProcessingRole ? processingNavItems : storeNavItems
  const masterItems = isProcessingRole ? [] : mastersNavItems
  const laundryNavItems = [...operationsItems, ...masterItems]

  // Redirect to dashboard if current page is hidden by licensing or role
  useEffect(() => {
    const validKeys = new Set(laundryNavItems.map(i => i.key))
    if (!validKeys.has(laundryPage)) {
      setLaundryPage("dashboard")
      return
    }
    const hiddenPage = laundryNavItems.find(
      item => item.key === laundryPage && item.feature && !isEnabled(item.feature)
    )
    if (hiddenPage) {
      setLaundryPage("dashboard")
    }
  }, [laundryPage, isEnabled, setLaundryPage, currentRole])

  const handleNavigate = (page: LaundryBusinessPage) => {
    setLaundryPage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const sidebarContent = (
    <>
      <SidebarHeader className="p-0 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between h-[60px] px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-wide text-white">Laundry OS</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3 gap-0">
        {([
          { title: "Operations", items: operationsItems },
          { title: "Masters", items: masterItems },
        ] as { title: string; items: NavItem[] }[])
          .filter(section => section.items.length > 0)
          .map(section => (
            <SidebarGroup key={section.title} className="px-2 py-0">
              <SidebarGroupLabel
                className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1 h-auto py-1"
                style={{ color: "var(--sidebar-heading)" }}
              >
                {section.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.filter(item => !item.feature || isEnabled(item.feature)).map((item) => {
                    const isActive = laundryPage === item.key
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => handleNavigate(item.key)}
                          tooltip={item.label}
                          className={`font-semibold text-xs h-9 ${isActive ? "admin-nav-active" : "!text-white/72 hover:!text-white hover:!bg-white/8"}`}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:!bg-white/8 h-auto py-2" tooltip={userName}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs font-bold text-white" style={{ background: "#0284C7" }}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-white">{userName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[272px] p-0 flex flex-col" style={{ ...sidebarVars, background: "#04132E", borderColor: "rgba(255,255,255,0.08)" }}>
          <SheetHeader className="p-0 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <SheetTitle className="sr-only">Laundry Workspace</SheetTitle>
            <SheetDescription className="sr-only">Laundry business workspace navigation</SheetDescription>
            <div className="flex items-center justify-between h-[60px] px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
            <span className="text-sm font-bold tracking-wide text-white">{isProcessingRole ? "Processing" : "Laundry OS"}</span>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 px-1 py-3">
            <div className="space-y-0.5 px-2">
              {laundryNavItems.filter(item => !item.feature || isEnabled(item.feature)).map((item) => {
                const isActive = laundryPage === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNavigate(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all min-h-[34px] ${
                      isActive ? "admin-nav-active" : "hover:bg-white/8"
                    }`}
                    style={isActive ? undefined : { color: "rgba(255,255,255,0.72)" }}
                  >
                    <item.icon className="shrink-0 size-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs font-bold text-white" style={{ background: "#0284C7" }}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={sidebarVars}>
      {sidebarContent}
      <SidebarRail />
    </Sidebar>
  )
}
