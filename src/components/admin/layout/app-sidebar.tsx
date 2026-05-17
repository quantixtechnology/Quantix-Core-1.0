"use client"

import {
  LayoutDashboard, Users, Building2, CreditCard, Globe,
  UserCheck, Bell, Settings, ChevronDown,
  Rocket, Hammer, GitBranch, PlayCircle, Smartphone, Activity,
  Image, Workflow, Upload, FileCheck, Server, Lock, ScrollText,
  BarChart3, Wallet, HeadphonesIcon, Receipt, ShieldCheck, KeyRound,
  DatabaseZap, FileText,
} from "lucide-react"
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
import { useAdminStore, type AdminPage } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useResponsive } from "@/hooks/use-responsive"
import { ADMIN_NAV_PERMISSIONS } from "@/lib/permissions"
import { useState } from "react"

const NAVY = "#081028"

// CSS variables scoped directly to the sidebar element — main content stays light
const sidebarVars = {
  "--sidebar": NAVY,
  "--sidebar-foreground": "rgba(255, 255, 255, 0.82)",
  "--sidebar-accent": "rgba(255, 255, 255, 0.06)",
  "--sidebar-accent-foreground": "rgba(255, 255, 255, 0.95)",
  "--sidebar-border": "rgba(255, 255, 255, 0.08)",
  "--sidebar-primary": "#2563EB",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-ring": "#2563EB",
} as React.CSSProperties

// Nav items carry only key, label, and icon.
// Visibility is driven entirely by ADMIN_NAV_PERMISSIONS — no inline permission
// fields, no superAdminOnly flags. One source of truth for all access control.
type NavItem = {
  key: AdminPage
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const platformNavItems: NavItem[] = [
  { key: "dashboard",         label: "Dashboard",          icon: LayoutDashboard },
  { key: "workflow-engine",   label: "Workflow Engine",    icon: Workflow    },
  { key: "businesses",        label: "Businesses",         icon: Building2   },
  { key: "leads",             label: "Sales & Leads",      icon: UserCheck   },
  { key: "proposals",        label: "Quote & Proposals",  icon: FileText    },
  { key: "subscriptions",     label: "Subscriptions",      icon: CreditCard  },
  { key: "plan-management",   label: "Plan Management",    icon: Receipt     },
  { key: "payment-plugins",   label: "Payment Plugins",    icon: CreditCard  },
  { key: "domains",           label: "Website Management", icon: Globe       },
  { key: "sales",             label: "Sales Team",         icon: Users       },
  { key: "platform-users",    label: "User Management",    icon: ShieldCheck },
]

const mobileNavItems: NavItem[] = [
  { key: "mobile-apps", label: "Mobile Apps", icon: Smartphone },
]

const deployNavItems: NavItem[] = [
  { key: "ops-dashboard",       label: "Operations Dashboard", icon: Activity   },
  { key: "deployment-pipeline", label: "Deployment Pipeline",  icon: Rocket     },
  { key: "build-automation",    label: "Build Automation",     icon: Hammer     },
  { key: "release-management",  label: "Release Management",   icon: GitBranch  },
  { key: "play-store",          label: "Play Store",           icon: PlayCircle },
  { key: "mobile-versions",     label: "Version Control",      icon: Smartphone },
]

const clientNavItems: NavItem[] = [
  { key: "client-assets",        label: "Client Assets",       icon: Image    },
  { key: "tenant-provisioning",  label: "Tenant Provisioning", icon: Workflow },
  { key: "product-import",       label: "Product Import",      icon: Upload   },
  { key: "onboarding-checklist", label: "Onboarding Checklist",icon: FileCheck},
]

const opsNavItems: NavItem[] = [
  { key: "platform-analytics", label: "Analytics & Reports", icon: BarChart3      },
  { key: "revenue",            label: "Revenue & Payouts",   icon: Wallet         },
  { key: "support",            label: "Support & Tickets",   icon: HeadphonesIcon },
  { key: "notifications",      label: "Notifications",       icon: Bell           },
]

const importNavItems: NavItem[] = [
  { key: "leads-import",         label: "Lead Import",          icon: Upload     },
  { key: "business-data-import", label: "Business Data Upload", icon: DatabaseZap},
]

const systemNavItems: NavItem[] = [
  { key: "roles-permissions", label: "Roles & Permissions", icon: KeyRound  },
  { key: "backup-monitoring", label: "Backup & Monitoring", icon: Server    },
  { key: "security-access",   label: "Security & Access",   icon: Lock      },
  { key: "audit-logs",        label: "Audit Logs",          icon: ScrollText},
  { key: "settings",          label: "Settings",            icon: Settings  },
]

function CollapsibleSection({
  title, items, activePage, onNavigate, defaultOpen = false,
}: {
  title: string
  items: NavItem[]
  activePage: AdminPage
  onNavigate: (page: AdminPage) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (items.length === 0) return null

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
        style={{ color: "rgba(34, 199, 240, 0.55)" }}
        aria-expanded={isOpen}
      >
        {title}
        <ChevronDown className={`size-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 px-2 mt-0.5">
          {items.map((item) => {
            const isActive = activePage === item.key
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all min-h-[34px] ${
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
      )}
    </div>
  )
}

interface AppSidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function AppSidebar({ mobileOpen = false, onMobileOpenChange }: AppSidebarProps) {
  const { activePage, setActivePage } = useAdminStore()
  const { user, permissions } = useAuthStore()
  const { isMobile } = useResponsive()

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "QT"
  const userName = user?.name ?? "Quantix Admin"
  const userEmail = user?.email ?? "admin@quantix.in"

  // Visibility is driven entirely by ADMIN_NAV_PERMISSIONS.
  // A nav item with no entry in the map is always hidden (fail-closed).
  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => {
      const required = ADMIN_NAV_PERMISSIONS[item.key]
      if (!required) return false
      return permissions.includes(required as never)
    })
  }

  const handleNavigate = (page: AdminPage) => {
    setActivePage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const sections = [
    { title: "Platform Control",  items: filterItems(platformNavItems), open: true },
    { title: "Mobile & Apps",     items: filterItems(mobileNavItems),   open: true },
    { title: "Deployment & Ops",  items: filterItems(deployNavItems),   open: false },
    { title: "Client Operations", items: filterItems(clientNavItems),   open: false },
    { title: "Data Imports",      items: filterItems(importNavItems),   open: false },
    { title: "Platform Ops",      items: filterItems(opsNavItems),      open: false },
    { title: "System",            items: filterItems(systemNavItems),   open: false },
  ]

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[272px] p-0 flex flex-col"
          style={{ ...sidebarVars, background: NAVY, borderColor: "rgba(255,255,255,0.08)" }}
        >
          {/* Brand header */}
          <SheetHeader className="px-4 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <SheetTitle className="sr-only">Quantix Technology</SheetTitle>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
            <div
              className="rounded-xl px-4 py-2.5"
              style={{
                background: "rgba(255,255,255,0.97)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              <img src="/quantix-logo.png" alt="Quantix Technology" style={{ height: "38px", display: "block" }} className="object-contain w-full" />
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-1 py-3">
            {sections.map((s) => (
              <CollapsibleSection
                key={s.title}
                title={s.title}
                items={s.items}
                activePage={activePage}
                onNavigate={handleNavigate}
                defaultOpen={s.open}
              />
            ))}
          </ScrollArea>

          {/* User footer */}
          <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs font-bold text-white" style={{ background: "#2563EB" }}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.40)" }}>{userEmail}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={sidebarVars}>
      {/* Brand header */}
      <SidebarHeader className="px-3 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="rounded-xl px-4 py-2.5 transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          style={{
            background: "rgba(255,255,255,0.97)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <img src="/quantix-logo.png" alt="Quantix Technology" style={{ height: "38px", display: "block" }} className="object-contain w-full" />
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3 gap-0">
        {sections.filter((s) => s.items.length > 0).map((s) => (
          <SidebarGroup key={s.title} className="px-2 py-0 mb-3">
            <SidebarGroupLabel
              className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1 h-auto py-1"
              style={{ color: "rgba(34,199,240,0.55)" }}
            >
              {s.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {s.items.map((item) => {
                  const isActive = activePage === item.key
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActivePage(item.key)}
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

      {/* User footer */}
      <SidebarFooter className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:!bg-white/8 h-auto py-2"
              tooltip={`${userName} · ${userEmail}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs font-bold text-white" style={{ background: "#2563EB" }}>
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-white">{userName}</span>
                <span className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.40)" }}>{userEmail}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
