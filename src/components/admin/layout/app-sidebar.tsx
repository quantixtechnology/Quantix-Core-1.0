"use client"

import {
  LayoutDashboard, Users, Building2, CreditCard, Globe,
  UserCheck, Bell, Settings, ChevronDown,
  Rocket, Hammer, GitBranch, PlayCircle, Smartphone, Activity,
  Image, Workflow, Upload, FileCheck, Server, Lock, ScrollText,
  BarChart3, Wallet, HeadphonesIcon, Receipt, ShieldCheck, KeyRound,
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
import { useState } from "react"

const platformNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "workflow-engine", label: "Workflow Engine", icon: Workflow },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "leads", label: "Sales & Leads", icon: UserCheck },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "plan-management", label: "Plan Management", icon: Receipt },
  { key: "payment-plugins", label: "Payment Plugins", icon: CreditCard },
  { key: "domains", label: "Domains & Deploys", icon: Globe },
  { key: "sales", label: "Sales Team", icon: Users },
  { key: "platform-users", label: "User Management", icon: ShieldCheck },
]

const mobileNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "mobile-apps", label: "Mobile Apps", icon: Smartphone },
]

const deployNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "ops-dashboard", label: "Operations Dashboard", icon: Activity },
  { key: "deployment-pipeline", label: "Deployment Pipeline", icon: Rocket },
  { key: "build-automation", label: "Build Automation", icon: Hammer },
  { key: "release-management", label: "Release Management", icon: GitBranch },
  { key: "play-store", label: "Play Store", icon: PlayCircle },
  { key: "mobile-versions", label: "Version Control", icon: Smartphone },
]

const clientNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "client-assets", label: "Client Assets", icon: Image },
  { key: "tenant-provisioning", label: "Tenant Provisioning", icon: Workflow },
  { key: "product-import", label: "Product Import", icon: Upload },
  { key: "onboarding-checklist", label: "Onboarding Checklist", icon: FileCheck },
]

const opsNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "platform-analytics", label: "Analytics & Reports", icon: BarChart3 },
  { key: "revenue", label: "Revenue & Payouts", icon: Wallet },
  { key: "support", label: "Support & Tickets", icon: HeadphonesIcon },
  { key: "notifications", label: "Notifications", icon: Bell },
]

const systemNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "roles-permissions", label: "Roles & Permissions", icon: KeyRound },
  { key: "backup-monitoring", label: "Backup & Monitoring", icon: Server },
  { key: "security-access", label: "Security & Access", icon: Lock },
  { key: "audit-logs", label: "Audit Logs", icon: ScrollText },
  { key: "settings", label: "Settings", icon: Settings },
]

function CollapsibleSection({
  title, items, activePage, onNavigate, defaultOpen = false,
}: {
  title: string
  items: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[]
  activePage: AdminPage
  onNavigate: (page: AdminPage) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#25B8F5]/60 hover:text-[#25B8F5] transition-colors"
        aria-expanded={isOpen}
      >
        {title}
        <ChevronDown className={`size-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 px-2">
          {items.map((item) => {
            const isActive = activePage === item.key
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all min-h-[36px] ${
                  isActive
                    ? "admin-nav-active"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="shrink-0 size-4" />
                <span className="text-xs">{item.label}</span>
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
  const { user } = useAuthStore()
  const { isMobile } = useResponsive()

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "QT"
  const userName = user?.name ?? "Quantix Admin"
  const userEmail = user?.email ?? "admin@quantix.in"

  const handleNavigate = (page: AdminPage) => {
    setActivePage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const sections = [
    { title: "Platform Control", items: platformNavItems, open: true },
    { title: "Mobile & Apps", items: mobileNavItems, open: true },
    { title: "Deployment & Ops", items: deployNavItems, open: false },
    { title: "Client Operations", items: clientNavItems, open: false },
    { title: "Platform Operations", items: opsNavItems, open: false },
    { title: "System", items: systemNavItems, open: false },
  ]

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Quantix" className="size-10 rounded-xl" />
              <div>
                <SheetTitle className="text-left text-sm font-bold text-sidebar-foreground">
                  QUANTIX CORE
                </SheetTitle>
                <SheetDescription className="text-left text-[10px] text-[#25B8F5]/70 font-medium tracking-wider uppercase">
                  Platform Admin
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 px-1 py-3 h-[calc(100vh-130px)]">
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
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[#155BDB] text-white text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{userName}</p>
                <p className="truncate text-xs text-sidebar-foreground/50">{userEmail}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent gap-3"
              tooltip="Quantix Core Platform"
            >
              <img src="/logo.svg" alt="Quantix" className="size-8 rounded-xl shrink-0" />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-xs font-bold tracking-wider text-sidebar-foreground uppercase">
                  Quantix Core
                </span>
                <span className="truncate text-[10px] font-medium text-[#25B8F5]/70 tracking-widest uppercase">
                  Platform Admin
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((s) => (
          <SidebarGroup key={s.title}>
            <SidebarGroupLabel className="text-[10px] font-bold tracking-widest text-[#25B8F5]/60 uppercase px-3">
              {s.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {s.items.map((item) => {
                  const isActive = activePage === item.key
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setActivePage(item.key)}
                        tooltip={item.label}
                        className={isActive ? "admin-nav-active" : ""}
                      >
                        <item.icon className="size-4" />
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

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-sidebar-accent"
              tooltip={`${userName} · ${userEmail}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-[#155BDB] text-white text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">{userName}</span>
                <span className="truncate text-xs text-sidebar-foreground/50">{userEmail}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
