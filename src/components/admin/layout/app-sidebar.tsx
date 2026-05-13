"use client"

import {
  LayoutDashboard, Users, Building2, CreditCard, Globe,
  UserCheck, Bell, Settings, Zap, ChevronDown,
  Rocket, Hammer, GitBranch, PlayCircle, Smartphone, Activity,
  Image, Workflow, Upload, FileCheck, Server, Lock, ScrollText,
  BarChart3, Wallet, HeadphonesIcon, Receipt, ShieldCheck,
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
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[36px] ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
  const { isMobile } = useResponsive()

  const handleNavigate = (page: AdminPage) => {
    setActivePage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const sections = [
    { title: "Platform Control", items: platformNavItems, open: true },
    { title: "Mobile & Apps", items: mobileNavItems, open: true },
    { title: "Deployment & Operations", items: deployNavItems, open: false },
    { title: "Client Operations", items: clientNavItems, open: false },
    { title: "Platform Operations", items: opsNavItems, open: false },
    { title: "System", items: systemNavItems, open: false },
  ]

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-left text-base font-bold">Quantix Core</SheetTitle>
                <SheetDescription className="text-left text-xs">Platform Admin</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1 px-1 py-3">
            {sections.map((s) => (
              <CollapsibleSection key={s.title} title={s.title} items={s.items} activePage={activePage} onNavigate={handleNavigate} defaultOpen={s.open} />
            ))}
          </ScrollArea>
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">QT</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">Quantix Admin</p>
                <p className="truncate text-xs text-muted-foreground">admin@quantix.in</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">Quantix Core</span>
                <span className="truncate text-xs text-muted-foreground">Platform Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((s) => (
          <SidebarGroup key={s.title}>
            <SidebarGroupLabel>{s.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {s.items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={activePage === item.key}
                      onClick={() => setActivePage(item.key)}
                      tooltip={item.label}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">QT</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Quantix Admin</span>
                <span className="truncate text-xs text-muted-foreground">admin@quantix.in</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
