'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Database, Layers, FolderTree, Globe, Shield, Users, Monitor,
  Truck, CreditCard, Package, Crown, Rocket, MapPin, Calendar,
  Zap, Server, ChevronDown, Lock, CheckCircle2, XCircle, Clock,
  Building2, Store, Fingerprint, ShieldCheck, Search,
  ChevronsUpDown, BookOpen, List, CircuitBoard, ArrowDownRight, Hash, Table2, Binary,
} from 'lucide-react'

interface SectionData {
  id: string; number: number; title: string; icon: React.ReactNode
  description: string; badges?: string[]; content: React.ReactNode
}

function FlowStep({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50">
      <div className="flex items-center justify-center size-7 rounded-md shrink-0 bg-emerald-100 text-emerald-600">{icon}</div>
      <div><div className="font-semibold text-sm">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
    </div>
  )
}

function InfoCard({ color, icon, title, children }: { color: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={cn('p-3 rounded-lg border', colors[color] || colors.emerald)}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="font-semibold text-sm">{title}</span></div>
      <div className="text-xs opacity-80">{children}</div>
    </div>
  )
}

const sections: SectionData[] = [
  { id: 'database-schema', number: 1, title: 'Database Schema', icon: <Database className="size-5" />, description: '30+ Prisma models, 15+ enums, 50+ indexes', badges: ['30+ Models', '15+ Enums'], content: (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center"><p className="text-lg font-bold text-amber-700">30+</p><p className="text-[10px] text-amber-600">Models</p></div>
        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center"><p className="text-lg font-bold text-emerald-700">15+</p><p className="text-[10px] text-emerald-600">Enums</p></div>
        <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-center"><p className="text-lg font-bold text-sky-700">50+</p><p className="text-[10px] text-sky-600">Indexes</p></div>
      </div>
      <div className="flex flex-wrap gap-1">{['BusinessType', 'UserRole', 'SubscriptionStatus', 'OrderType', 'OrderStatus', 'PaymentStatus', 'DeliveryStatus', 'POSSessionStatus'].map(e => <Badge key={e} variant="outline" className="font-mono text-[9px] border-emerald-200 text-emerald-700">{e}</Badge>)}</div>
      <InfoCard color="emerald" icon={<ShieldCheck className="size-4" />} title="Key Principle"><code className="bg-emerald-100 px-1 rounded">business_id</code> on ALL tenant tables = row-level isolation. <code className="bg-emerald-100 px-1 rounded">store_id</code> scopes to store.</InfoCard>
      <p className="text-[10px] text-muted-foreground">Models: Platform, Business, User, Store, Product, Order, OrderItem, Delivery, Invoice, Payment, CustomerSubscription, POSSession, DomainMapping, Deployment, Lead, SubscriptionPlan...</p>
    </div>
  )},
  { id: 'multi-tenant', number: 2, title: 'Multi-Tenant Architecture', icon: <Layers className="size-5" />, description: 'Row-level isolation via business_id + store_id', badges: ['Isolated', 'Scalable'], content: (
    <div className="space-y-3">
      <InfoCard color="emerald" icon={<Database className="size-4" />} title="Shared Infra, Isolated Data">Same DB & app, data isolated via row-level tenant IDs. No cross-tenant access possible.</InfoCard>
      <div className="flex flex-col gap-1">
        <FlowStep icon={<Fingerprint className="size-4" />} title="1. User Request" desc="Auth request hits API" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<ShieldCheck className="size-4" />} title="2. Session → businessId" desc="JWT contains businessId claim" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<Lock className="size-4" />} title="3. Queries Scoped" desc="WHERE businessId = ? auto-appended" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded-lg border-2 border-amber-300 bg-amber-50"><p className="font-bold text-amber-700">Platform</p><p className="text-amber-600">No businessId</p></div>
        <div className="p-2 rounded-lg border-2 border-emerald-300 bg-emerald-50"><p className="font-bold text-emerald-700">Business</p><p className="text-emerald-600">Has businessId</p></div>
        <div className="p-2 rounded-lg border-2 border-sky-300 bg-sky-50"><p className="font-bold text-sky-700">Store</p><p className="text-sky-600">businessId + storeId</p></div>
      </div>
    </div>
  )},
  { id: 'folder-structure', number: 3, title: 'Folder Structure', icon: <FolderTree className="size-5" />, description: 'Monorepo with apps, packages, services', badges: ['Monorepo', 'Turborepo'], content: (
    <div className="space-y-2">
      <div className="p-3 rounded-lg bg-gray-900 font-mono text-[10px] text-green-400 overflow-x-auto">
        <div>quantix-platform/</div>
        <div className="ml-4">├── apps/ <span className="text-gray-500">{'// 2 Web + 3 Mobile + 1 Site'}</span></div>
        <div className="ml-8">├── web-admin/ · super-admin/ · customer-app/ · delivery-app/ · business-website/</div>
        <div className="ml-4">├── packages/ <span className="text-gray-500">{'// shared, database, auth, api-client, ui'}</span></div>
        <div className="ml-4">├── services/ <span className="text-gray-500">{'// api-server, websocket, worker, notifications'}</span></div>
        <div className="ml-4">├── prisma/ · docker/ · docs/</div>
      </div>
    </div>
  )},
  { id: 'api-architecture', number: 4, title: 'API Architecture', icon: <Globe className="size-5" />, description: 'REST API with middleware chain', badges: ['REST', 'Middleware'], content: (
    <div className="space-y-2 text-xs">
      <div className="space-y-1.5">
        <div className="p-2 rounded-lg border border-amber-200 bg-amber-50"><code className="font-mono font-bold text-amber-700">/api/platform/*</code> — Super Admin only</div>
        <div className="p-2 rounded-lg border border-violet-200 bg-violet-50"><code className="font-mono font-bold text-violet-700">/api/sales/*</code> — Sales team</div>
        <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50"><code className="font-mono font-bold text-emerald-700">/api/businesses/:id/*</code> — Tenant-scoped</div>
      </div>
      <p><strong>Middleware:</strong> CORS → Auth (JWT) → Tenant Resolution → Rate Limit → Validation → Handler</p>
    </div>
  )},
  { id: 'auth-flow', number: 5, title: 'Authentication Flow', icon: <Shield className="size-5" />, description: 'OTP-based auth, no SMS', badges: ['JWT', 'OTP'], content: (
    <div className="space-y-2">
      <InfoCard color="red" icon={<XCircle className="size-4" />} title="NO SMS OTP">SMS not supported as auth channel</InfoCard>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded-lg border border-sky-200 bg-sky-50"><p className="font-semibold text-sky-700">Email OTP</p><p className="text-sky-600">Email → 6-digit OTP → Verify → JWT</p></div>
        <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50"><p className="font-semibold text-emerald-700">WhatsApp OTP</p><p className="text-emerald-600">Phone → WA API → Verify → JWT</p></div>
        <div className="p-2 rounded-lg border border-violet-200 bg-violet-50"><p className="font-semibold text-violet-700">Push Notif</p><p className="text-violet-600">Device token → Push → Tap → JWT</p></div>
      </div>
      <p className="text-[10px] text-muted-foreground">JWT in httpOnly cookie, 24h expiry + refresh token</p>
    </div>
  )},
  { id: 'role-permissions', number: 6, title: 'Role Permission System', icon: <Users className="size-5" />, description: '6 roles, granular RBAC', badges: ['RBAC', '6 Roles'], content: (
    <div className="space-y-2">
      <InfoCard color="red" icon={<XCircle className="size-4" />} title="KEY RESTRICTION">Clients CANNOT create businesses, deploy apps, manage hosting, or configure infra</InfoCard>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {[['👑 SUPER_ADMIN', 'Full platform control'], ['👤 SALES_TEAM', 'Leads, onboarding, renewals'], ['🏢 CLIENT_OWNER', 'Products, orders, POS, staff'], ['🏪 STORE_MANAGER', 'Store ops, inventory'], ['🚚 DELIVERY_STAFF', 'Deliveries, OTP, GPS'], ['👤 CUSTOMER', 'Browse, order, subscribe']].map(([n, d]) => (
          <div key={n} className="p-1.5 rounded-lg border"><span className="font-mono font-bold">{n}</span> <span className="text-muted-foreground">— {d}</span></div>
        ))}
      </div>
    </div>
  )},
  { id: 'pos-architecture', number: 7, title: 'POS Architecture', icon: <Monitor className="size-5" />, description: 'Session management, thermal printing, GST', badges: ['POS', 'GST'], content: (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <FlowStep icon={<Monitor className="size-4" />} title="Open Session" desc="Staff opens POS with starting balance" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<CreditCard className="size-4" />} title="Process & Pay" desc="Add items, calculate GST, accept Cash/UPI/Card" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<Database className="size-4" />} title="Print Receipt" desc="58mm/80mm thermal — CGST/SGST/IGST with HSN" />
      </div>
    </div>
  )},
  { id: 'delivery-architecture', number: 8, title: 'Delivery Architecture', icon: <Truck className="size-5" />, description: 'Haversine serviceability, GPS, OTP', badges: ['GPS', 'Haversine'], content: (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <FlowStep icon={<Package className="size-4" />} title="Order Placed" desc="Pickup & drop addresses created" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<Truck className="size-4" />} title="Assign & Deliver" desc="Nearest partner, GPS tracking, live ETA" />
        <div className="flex items-center justify-center py-0.5"><ArrowDownRight className="size-3 text-emerald-500" /></div>
        <FlowStep icon={<ShieldCheck className="size-4" />} title="OTP Verify" desc="Customer provides OTP to confirm" />
      </div>
      <InfoCard color="emerald" icon={<MapPin className="size-4" />} title="Haversine Formula">Distance ≤ deliveryRadius → show products. Else → &quot;Not available in your area&quot;</InfoCard>
    </div>
  )},
  { id: 'subscription-engine', number: 9, title: 'Subscription Engine', icon: <CreditCard className="size-5" />, description: 'Credit-based for Car Wash / Home Services', badges: ['Credits', 'Rollover'], content: (
    <div className="space-y-2">
      <InfoCard color="emerald" icon={<CreditCard className="size-4" />} title="Credit-Based">Buy credit packages → use per service → tracking, expiry, renewal</InfoCard>
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        {[['Credit Pkgs', '8/17/30 per plan'], ['Usage Track', 'Per-service deduct'], ['Rollover', 'Unused carry over'], ['Auto Renew', 'Cycle-end recharge']].map(([l, d]) => (
          <div key={l} className="p-1.5 rounded-lg border bg-muted/30"><p className="font-semibold">{l}</p><p className="text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </div>
  )},
  { id: 'pickup-delivery', number: 10, title: 'Pickup & Delivery', icon: <Package className="size-5" />, description: 'Laundry-style pickup → delivery', badges: ['Pickup', 'OTP'], content: (
    <div className="space-y-2 text-[10px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {['Pickup Request', '→', 'Assigned', '→', 'Picked Up (OTP)', '→', 'Processing', '→', 'Ready', '→', 'Delivered (OTP) ✅'].map((s, i) => (
          <span key={i} className={s === '→' ? 'text-emerald-500' : 'bg-white px-1.5 py-0.5 rounded border'}>{s}</span>
        ))}
      </div>
      <p className="text-muted-foreground">Two-phase OTP: pickup + delivery. Status: PICKUP_ASSIGNED → PICKED_UP → PROCESSING → READY → DELIVERED</p>
    </div>
  )},
  { id: 'super-admin', number: 11, title: 'Super Admin', icon: <Crown className="size-5" />, description: 'MANAGED platform, NOT self-service', badges: ['Managed'], content: (
    <div className="space-y-2">
      <InfoCard color="red" icon={<XCircle className="size-4" />} title="NOT Self-Service">Customers CANNOT create businesses, deploy, manage hosting, or configure DNS</InfoCard>
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        {[['Create Biz', 'Admin only'], ['Deploy', 'Admin only'], ['DNS/SSL', 'Admin only'], ['Pricing', 'Per-customer'], ['Sales Team', 'Assign leads'], ['Flags', 'Toggle features']].map(([l, d]) => (
          <div key={l} className="p-1.5 rounded-lg border bg-amber-50"><p className="font-semibold text-amber-700">{l}</p><p className="text-amber-600">{d}</p></div>
        ))}
      </div>
    </div>
  )},
  { id: 'deployment', number: 12, title: 'Deployment', icon: <Rocket className="size-5" />, description: 'Replit → Vercel → AWS', badges: ['CI/CD', 'Docker'], content: (
    <div className="space-y-2 text-[10px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="bg-emerald-100 px-2 py-0.5 rounded border font-medium">Replit (Current)</span><span className="text-emerald-500">→</span>
        <span className="bg-slate-100 px-2 py-0.5 rounded border">Vercel</span><span className="text-slate-400">→</span>
        <span className="bg-slate-100 px-2 py-0.5 rounded border">AWS / DO</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[['Docker', 'Containerized'], ['CI/CD', 'GitHub Actions'], ['SSL', 'Auto per domain'], ['Health', 'Auto-restart']].map(([l, d]) => (
          <div key={l} className="p-1.5 rounded-lg border bg-muted/30"><p className="font-semibold">{l}</p><p className="text-muted-foreground">{d}</p></div>
        ))}
      </div>
    </div>
  )},
  { id: 'domain-mapping', number: 13, title: 'Domain Mapping', icon: <MapPin className="size-5" />, description: 'DNS → SSL → Verify → Active', badges: ['SSL', 'DNS'], content: (
    <div className="space-y-2 text-[10px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {['Client domain', '→', 'Quantix DNS', '→', 'Propagation', '→', 'SSL', '→', 'Live ✅'].map((s, i) => (
          <span key={i} className={s === '→' ? 'text-emerald-500' : 'bg-white px-1.5 py-0.5 rounded border'}>{s}</span>
        ))}
      </div>
      <InfoCard color="amber" icon={<XCircle className="size-4" />} title="DNS by Quantix Only">Clients CANNOT manage hosting or DNS</InfoCard>
    </div>
  )},
  { id: 'roadmap', number: 14, title: 'Development Roadmap', icon: <Calendar className="size-5" />, description: '12-month, 7-phase delivery', badges: ['7 Phases', '12 Months'], content: (
    <div className="space-y-1.5">
      {[['P1', 'M1-2', 'Core: Auth, multi-tenant, DB, API'], ['P2', 'M3-4', 'Business & Store: Products, orders, POS'], ['P3', 'M5-6', 'Delivery: GPS, partner app, Haversine'], ['P4', 'M7-8', 'Subscriptions & Billing, payment gateway'], ['P5', 'M9-10', 'Customer apps, order tracking'], ['P6', 'M11', 'Advanced: Analytics, notifications, white-label'], ['P7', 'M12', 'Scale: Load test, CDN, monitoring, go-live']].map(([p, m, d]) => (
        <div key={p} className="flex items-center gap-2 p-1.5 rounded-lg border text-[10px]">
          <Badge variant="outline" className="text-[8px] shrink-0 border-emerald-200 text-emerald-700">{p}</Badge>
          <span className="text-muted-foreground w-10 shrink-0">{m}</span>
          <span>{d}</span>
        </div>
      ))}
    </div>
  )},
  { id: 'mvp-scope', number: 15, title: 'MVP Scope', icon: <Zap className="size-5" />, description: 'What ships first', badges: ['MVP', 'Post-MVP'], content: (
    <div className="grid grid-cols-2 gap-2 text-[10px]">
      <div className="p-2 rounded-lg border-2 border-emerald-300 bg-emerald-50">
        <p className="font-semibold text-emerald-700 mb-1">✅ MVP (P1-3)</p>
        <div className="space-y-0.5">{['Multi-tenant auth', 'Business & store CRUD', 'Product catalog + GST', 'Order management', 'Basic POS + thermal', 'Delivery + Haversine + OTP', 'Razorpay integration', 'Super Admin dashboard'].map(i => <div key={i} className="flex items-center gap-1"><CheckCircle2 className="size-2.5 text-emerald-500" />{i}</div>)}</div>
      </div>
      <div className="p-2 rounded-lg border-2 border-slate-200 bg-slate-50">
        <p className="font-semibold text-slate-600 mb-1">⏳ Post-MVP (P4-7)</p>
        <div className="space-y-0.5 text-muted-foreground">{['Credit subscriptions', 'Customer mobile app', 'Delivery partner app', 'Advanced analytics', 'WhatsApp notifications', 'White-label theming', 'Auto-scaling infra', 'Multi-language'].map(i => <div key={i} className="flex items-center gap-1"><Clock className="size-2.5 text-slate-400" />{i}</div>)}</div>
      </div>
    </div>
  )},
  { id: 'production-architecture', number: 16, title: 'Production Architecture', icon: <Server className="size-5" />, description: 'CDN, Load Balancer, Redis, Queue', badges: ['99.9% SLA', 'Auto-Scale'], content: (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        {[['CDN', 'CloudFlare'], ['LB', 'Nginx proxy'], ['Redis', 'Cache + queue'], ['Workers', 'Background jobs'], ['DB Replica', 'Read replicas'], ['Monitor', 'Prometheus'], ['Auto-Scale', 'K8s HPA'], ['SSL', 'Auto-renew']].map(([l, d]) => (
          <div key={l} className="p-1.5 rounded-lg border bg-muted/30"><p className="font-semibold">{l}</p><p className="text-muted-foreground">{d}</p></div>
        ))}
      </div>
      <InfoCard color="emerald" icon={<Server className="size-4" />} title="99.9% SLA">K8s horizontal scaling, health checks, auto-restart, multi-region</InfoCard>
    </div>
  )},
]

export function ArchitectureView() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['database-schema']))
  const [searchQuery, setSearchQuery] = useState('')

  const toggleSection = (id: string) => setOpenSections(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const expandAll = () => setOpenSections(new Set(sections.map(s => s.id)))
  const collapseAll = () => setOpenSections(new Set())
  const filteredSections = sections.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-100 text-emerald-700"><CircuitBoard className="size-5" /></div>
            <div><h1 className="text-xl font-bold tracking-tight">Architecture Documentation</h1><p className="text-sm text-muted-foreground">Quantix Technology — Managed White-Label SaaS Platform</p></div>
          </div>
          <div className="mt-3 p-3 rounded-lg border bg-emerald-50/50 border-emerald-200">
            <div className="flex items-center gap-2 mb-2"><BookOpen className="size-4 text-emerald-600" /><span className="font-semibold text-sm text-emerald-700">Table of Contents</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
              {sections.map(s => (
                <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); if (!openSections.has(s.id)) toggleSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-emerald-100 transition-colors">
                  <span className="font-mono text-emerald-500">{String(s.number).padStart(2, '0')}</span>
                  <span className="truncate">{s.title}</span>
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type="text" placeholder="Search sections..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={expandAll} className="text-xs"><ChevronsUpDown className="size-3 mr-1" />Expand All</Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs"><List className="size-3 mr-1" />Collapse All</Button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {filteredSections.map(section => (
          <div key={section.id} id={section.id} className="transition-all duration-200">
            <Card className={cn('overflow-hidden border-l-4 transition-all duration-200', openSections.has(section.id) ? 'border-l-emerald-500 shadow-md' : 'border-l-transparent hover:border-l-emerald-300 hover:shadow-sm')}>
              <CardHeader className="cursor-pointer select-none" onClick={() => toggleSection(section.id)}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex items-center justify-center size-10 rounded-lg transition-colors duration-200', openSections.has(section.id) ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>{section.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-emerald-600">#{String(section.number).padStart(2, '0')}</span>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                      </div>
                      <CardDescription className="mt-1">{section.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {section.badges?.map((badge, i) => <Badge key={i} variant="outline" className="text-[10px] hidden sm:inline-flex border-emerald-200 text-emerald-700">{badge}</Badge>)}
                    <ChevronDown className={cn('size-5 text-muted-foreground transition-transform duration-200', openSections.has(section.id) && 'rotate-180')} />
                  </div>
                </div>
              </CardHeader>
              {openSections.has(section.id) && <CardContent className="pt-0"><Separator className="mb-4" />{section.content}</CardContent>}
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
