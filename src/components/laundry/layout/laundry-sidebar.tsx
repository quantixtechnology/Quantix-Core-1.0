"use client"

import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useResponsive } from "@/hooks/use-responsive"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import { SCREEN_PAGE_MAP, defaultNavigationConfig, screenDisplayName, screenKeyPermission, screenKeyLegacyPermission, resolveLaundryLandingPage } from "@/lib/laundry-nav-config"
import {
  LayoutDashboard, ShoppingBag, Users, Store, Factory, BarChart3, Settings,
  Plus, ClipboardCheck, CreditCard, Truck, IndianRupee, Wallet,
  UsersRound, Shirt, Droplets, Wind, Layers, ShieldCheck, Barcode, Repeat,
  Target, CheckSquare, ClipboardList, PieChart, SlidersHorizontal, Gauge,
  PackageCheck, CheckCheck, Sparkles, Package, Shield,
  Megaphone, Ticket, BadgePercent, Gift, Crown, UserPlus, Coins, ShoppingCart,
  WashingMachine, Calculator, Tags, ChevronDown, Bike, Smartphone, Search,
  Menu, Calendar, type LucideIcon,
} from "lucide-react"

const VIEW_LEVEL = 1

type NavCfg = {
  key: string
  label: string
  icon: LucideIcon
  page?: LaundryBusinessPage
  comingSoon?: boolean
  perm?: string
  permFallback?: string
  badge?: string
  hidden?: boolean
}

type NavGroup = { label: string | null; sectionHeader?: string; items: NavCfg[]; expanded?: boolean; collapsible?: boolean }

interface NavItemDto {
  id?: string
  screenKey: string
  displayName: string
  icon: string
  order: number
  active: boolean
  hidden: boolean
  badge?: string
  comingSoon: boolean
}

interface NavSectionDto {
  id?: string
  name: string
  icon: string
  order: number
  expanded: boolean
  collapsible: boolean
  active: boolean
  description?: string
  items: NavItemDto[]
}

const ICON_MAP: Record<string, LucideIcon> = {
  "LayoutDashboard": LayoutDashboard, "ShoppingBag": ShoppingBag,
  "Users": Users, "Store": Store, "Factory": Factory, "BarChart3": BarChart3,
  "Settings": Settings, "Plus": Plus, "ClipboardCheck": ClipboardCheck,
  "CreditCard": CreditCard, "Truck": Truck, "IndianRupee": IndianRupee,
  "Wallet": Wallet, "UsersRound": UsersRound, "Shirt": Shirt,
  "Droplets": Droplets, "Wind": Wind, "Layers": Layers, "ShieldCheck": ShieldCheck,
  "Barcode": Barcode, "Repeat": Repeat, "Target": Target, "CheckSquare": CheckSquare,
  "ClipboardList": ClipboardList, "PieChart": PieChart, "SlidersHorizontal": SlidersHorizontal,
  "Gauge": Gauge, "PackageCheck": PackageCheck, "CheckCheck": CheckCheck,
  "Sparkles": Sparkles, "Package": Package, "Shield": Shield,
  "Megaphone": Megaphone, "Ticket": Ticket, "BadgePercent": BadgePercent,
  "Gift": Gift, "Crown": Crown, "UserPlus": UserPlus, "Coins": Coins,
  "ShoppingCart": ShoppingCart, "WashingMachine": WashingMachine,
  "Calculator": Calculator, "Tags": Tags, "ChevronDown": ChevronDown,
  "Bike": Bike, "Smartphone": Smartphone, "Search": Search, "Menu": Menu,
  "Circle": ShoppingBag, "Calendar": Calendar,
}

// PAGE_MAP is now imported as SCREEN_PAGE_MAP from @/lib/laundry-nav-config
// Permission mapping (SCREEN_KEY_PERM_MAP + legacy fallback) lives in
// @/lib/laundry-nav-config — the single source of truth for nav → RBAC sync.

function fallbackGroups(permAllows: (i: NavCfg) => boolean): NavGroup[] {
  const defaults = defaultNavigationConfig()
  const groups: NavGroup[] = defaults
    .filter((sec) => sec.active)
    .map((sec) => ({
      label: sec.name,
      items: sec.items.map((item) => ({
        key: item.screenKey,
        label: item.displayName ?? screenDisplayName(item.screenKey),
        icon: ICON_MAP[item.icon ?? "Circle"] ?? ShoppingBag,
        page: SCREEN_PAGE_MAP[item.screenKey] as LaundryBusinessPage | undefined,
        comingSoon: item.comingSoon,
        perm: screenKeyPermission(item.screenKey),
        permFallback: screenKeyLegacyPermission(item.screenKey),
      })).filter((navItem) => permAllows(navItem)),
    }))
    .filter((g) => g.items.length > 0)
  return groups.length > 0 ? groups : [{ label: null, items: [] }]
}

const PROGRAMMATIC_PAGES = new Set<LaundryBusinessPage>(["order-detail", "audit-barcode", "garment-lookup"])

const WHITE_THEME = {
  "--sidebar": "#FFFFFF",
  "--sidebar-foreground": "#475569",
  "--sidebar-accent": "#EFF6FF",
  "--sidebar-accent-foreground": "#1D4ED8",
  "--sidebar-border": "#E2E8F0",
  "--sidebar-primary": "#2563EB",
  "--sidebar-primary-foreground": "#FFFFFF",
  "--sidebar-ring": "#2563EB",
} as React.CSSProperties

interface LaundrySidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

const COLLAPSE_KEY = "quantix_nav_collapsed"
const SCROLL_KEY = "quantix_nav_scroll"
function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try { return new Set(JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || "[]") as string[]) } catch { return new Set() }
}
function persistCollapsed(s: Set<string>) {
  try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s])) } catch {}
}
const groupKey = (g: { sectionHeader?: string; label: string | null }) => `${g.sectionHeader ?? ""}::${g.label ?? ""}`

export function LaundrySidebar({ mobileOpen = false, onMobileOpenChange }: LaundrySidebarProps) {
  const { laundryPage, setLaundryPage, currentBusinessId, navRevision } = useAdminStore()
  const { user } = useAuthStore()
  const { isMobile } = useResponsive()
  const { screenLevels, isOwner, isLoaded } = useRuntimeAuth()

  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const toggleGroup = (key: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); persistCollapsed(n); return n
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const onNavScroll = (e: React.UIEvent<HTMLDivElement>) => {
    try { sessionStorage.setItem(SCROLL_KEY, String(e.currentTarget.scrollTop)) } catch {}
  }
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || "0")
    if (saved > 0) el.scrollTop = saved
  }, [])

  const [navSections, setNavSections] = useState<NavSectionDto[]>([])
  const [navLoaded, setNavLoaded] = useState(false)
  const [navError, setNavError] = useState(false)

  const businessId = currentBusinessId || ""

  useEffect(() => {
    if (!businessId) return
    setNavError(false)
    fetch(`/api/laundry/navigation?businessId=${businessId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Navigation API error")
        return r.json()
      })
      .then((json) => {
        if (json.data?.sections) setNavSections(json.data.sections)
        setNavLoaded(true)
      })
      .catch(() => {
        setNavError(true)
        setNavLoaded(true)
      })
  }, [businessId, navRevision])

  const permAllows = useCallback((item: NavCfg) => {
    if (!isLoaded || isOwner) return true
    if (!item.perm) return true
    if ((screenLevels[item.perm] ?? 0) >= VIEW_LEVEL) return true
    // Legacy fallback: roles saved before these screens were registered only
    // hold the legacy mapped permission — preserve their existing access.
    if (item.permFallback && (screenLevels[item.permFallback] ?? 0) >= VIEW_LEVEL) return true
    return false
  }, [isLoaded, isOwner, screenLevels])

  const groups: NavGroup[] = useMemo(() => {
    if (navError) {
      return fallbackGroups(permAllows)
    }
    return navSections
      .filter((sec) => sec.active)
      .map((sec) => ({
        label: sec.name,
        items: sec.items
          .filter((item) => !item.hidden)
          .map((item) => ({
            key: item.id ?? item.screenKey,
            label: item.displayName,
            icon: ICON_MAP[item.icon] ?? ShoppingBag,
            page: SCREEN_PAGE_MAP[item.screenKey] as LaundryBusinessPage | undefined,
            comingSoon: item.comingSoon,
            perm: screenKeyPermission(item.screenKey),
            permFallback: screenKeyLegacyPermission(item.screenKey),
            badge: item.badge ?? undefined,
          }))
          .filter((navItem) => permAllows(navItem)),
        expanded: sec.expanded,
        collapsible: sec.collapsible,
      }))
      .filter((g) => g.items.length > 0)
  }, [navSections, navError, permAllows])

  const validPages = useMemo(() => {
    const pages = new Set([
      ...groups.flatMap((g) => g.items).filter((i) => i.page && !i.comingSoon).map((i) => i.page),
      ...PROGRAMMATIC_PAGES,
    ])
    return pages
  }, [groups])

  useEffect(() => {
    if (!navLoaded) return
    if (!validPages.has(laundryPage)) {
      const landing = resolveLaundryLandingPage(screenLevels, isOwner) as LaundryBusinessPage
      setLaundryPage(landing)
    }
  }, [laundryPage, navLoaded, validPages, screenLevels, isOwner])

  const navigate = (page?: LaundryBusinessPage) => {
    if (!page) return
    setLaundryPage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const brand = user?.businessName || "Laundry OS"
  const brandInitials = brand.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const Brand = (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
        <Shirt className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold text-slate-800">{brand}</p>
        <p className="text-[10px] font-semibold tracking-[0.15em] text-blue-500 uppercase">Laundry</p>
      </div>
    </div>
  )

  const renderNav = (collapsedTooltips = true) => (
    <>
      {groups.map((section, gi) => {
        const gk = groupKey(section)
        const canCollapse = section.collapsible !== false && !!section.label
        const isCollapsed = canCollapse && collapsed.has(gk)
        return (
        <div key={`${gk}-${gi}`}>
          <SidebarGroup className="px-2 py-0">
          {section.label && (
            <SidebarGroupLabel asChild className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1 mt-2 h-auto py-1 text-slate-400">
              <button type="button" onClick={() => canCollapse && toggleGroup(gk)} className="w-full flex items-center justify-between gap-2 hover:text-slate-600 transition-colors">
                <span>{section.label}</span>
                {canCollapse && <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />}
              </button>
            </SidebarGroupLabel>
          )}
          {!isCollapsed && (
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const isActive = item.page === laundryPage
                if (item.comingSoon) {
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton disabled tooltip={collapsedTooltips ? `${item.label} (Coming Soon)` : undefined}
                        className="font-medium text-[13px] h-9 !text-slate-400 cursor-not-allowed opacity-70">
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-semibold border-slate-200 text-slate-400 bg-slate-50">Soon</Badge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton isActive={isActive} onClick={() => navigate(item.page)}
                      tooltip={collapsedTooltips ? item.label : undefined}
                      className={`font-medium text-[13px] h-9 ${isActive ? "!bg-blue-600 !text-white shadow-sm" : "!text-slate-600 hover:!bg-blue-50 hover:!text-blue-700"}`}>
                      <item.icon className="size-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          )}
        </SidebarGroup>
        </div>
      )})}
    </>
  )

  const Footer = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold shrink-0">{brandInitials}</div>
        <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-700">{brand}</p><p className="text-[11px] text-slate-400">Workspace</p></div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-white">
          <SheetHeader className="p-0 shrink-0 border-b border-slate-200">
            <SheetTitle className="sr-only">Laundry Workspace</SheetTitle>
            <SheetDescription className="sr-only">Navigation</SheetDescription>
            <div className="flex items-center h-16 px-4">{Brand}</div>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 py-3" style={WHITE_THEME}>{renderNav(false)}</ScrollArea>
          <div className="p-3 shrink-0 border-t border-slate-200">{Footer}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200" style={WHITE_THEME}>
      <SidebarHeader className="p-0 shrink-0 border-b border-slate-200">
        <div className="flex items-center h-16 px-2">{Brand}</div>
      </SidebarHeader>
      <SidebarContent ref={scrollRef} onScroll={onNavScroll} className="py-3 gap-0">
        {renderNav()}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-slate-200">{Footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
