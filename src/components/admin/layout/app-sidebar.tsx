"use client"

import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  ClipboardList,
  Globe,
  Monitor,
  UserCheck,
  Bell,
  Settings,
  Zap,
  ChevronDown,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminStore, type AdminPage } from "@/stores/admin-store"
import { useResponsive } from "@/hooks/use-responsive"
import { useState } from "react"

const mainNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: Users },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "onboarding", label: "Onboarding", icon: ClipboardList },
  { key: "domains", label: "Domains & Deploy", icon: Globe },
  { key: "demo-tenants", label: "Demo Tenants", icon: Monitor },
  { key: "sales", label: "Sales Team", icon: UserCheck },
]

const systemNavItems: { key: AdminPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: Settings },
]

/** Collapsible section for mobile sidebar */
function CollapsibleSection({
  title,
  items,
  activePage,
  onNavigate,
  defaultOpen = true,
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
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 px-2">
          {items.map((item) => {
            const isActive = activePage === item.key
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="shrink-0 size-5" />
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
  const { isMobile } = useResponsive()

  const handleNavigate = (page: AdminPage) => {
    setActivePage(page)
    if (isMobile && onMobileOpenChange) {
      onMobileOpenChange(false)
    }
  }

  // Mobile: Sheet-based sidebar with collapsible sections and touch-friendly targets
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
                <SheetDescription className="text-left text-xs">Super Admin</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-1 py-3">
            <CollapsibleSection
              title="Platform"
              items={mainNavItems}
              activePage={activePage}
              onNavigate={handleNavigate}
              defaultOpen={true}
            />
            <CollapsibleSection
              title="System"
              items={systemNavItems}
              activePage={activePage}
              onNavigate={handleNavigate}
              defaultOpen={true}
            />
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

  // Desktop: Persistent sidebar
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
                <span className="truncate text-xs text-muted-foreground">Super Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
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
