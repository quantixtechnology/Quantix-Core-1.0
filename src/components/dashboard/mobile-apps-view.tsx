'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Smartphone, Copy, CheckCheck, Globe, Key, Package,
  Zap, Search, ChevronDown, ChevronRight, ExternalLink,
  AlertCircle, ShoppingBag, MapPin, User, ShoppingCart,
  ClipboardList, Layers,
} from 'lucide-react'
import { useBusinesses } from '@/hooks/use-api'

// ─── Helpers ────────────────────────────────────────────────────────────────

function useBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://your-domain.com'
  return window.location.origin
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return { copy, copied }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copy, copied } = useCopy()
  const isCopied = copied === label
  return (
    <button
      onClick={() => copy(text, label)}
      className="ml-2 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {isCopied
        ? <CheckCheck className="size-3.5 text-emerald-500" />
        : <Copy className="size-3.5" />}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-3 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} label={label} />
      </div>
    </div>
  )
}

// ─── Endpoint reference data ─────────────────────────────────────────────────

const ENDPOINTS = [
  {
    group: 'App Bootstrap',
    icon: Zap,
    color: 'text-amber-600 bg-amber-50',
    items: [
      {
        method: 'GET',
        path: '/api/core/storefront/store-context',
        params: '?slug={tenant-slug}',
        desc: 'Call this on app launch. Returns business branding (name, logo, primary color, theme), active store info (delivery fee, min order, hours), and available payment gateways.',
      },
      {
        method: 'GET',
        path: '/api/core/storefront/nearest-store',
        params: '?businessId={id}&lat={lat}&lng={lng}',
        desc: 'Resolve nearest store by GPS. Returns store ID, delivery fee, and serviceability. Call after getting location permission.',
      },
      {
        method: 'POST',
        path: '/api/core/storefront/nearest-store',
        params: '',
        desc: 'Body: { businessId, lat?, lng? }. Lists all active stores with distance for a store picker UI.',
      },
    ],
  },
  {
    group: 'Catalog',
    icon: Package,
    color: 'text-blue-600 bg-blue-50',
    items: [
      {
        method: 'GET',
        path: '/api/core/storefront/products',
        params: '?businessId={id}&storeId={id}&limit=20&page=1',
        desc: 'Paginated product list with variants, price, MRP, GST, stock, and category. Supports search and category filters.',
      },
      {
        method: 'GET',
        path: '/api/core/storefront/products/{productId}',
        params: '',
        desc: 'Full product detail including all variants, inventory, and related category.',
      },
      {
        method: 'GET',
        path: '/api/core/storefront/categories',
        params: '?businessId={id}',
        desc: 'Active category list with product counts. Use to build your category nav.',
      },
    ],
  },
  {
    group: 'Orders',
    icon: ShoppingBag,
    color: 'text-emerald-600 bg-emerald-50',
    items: [
      {
        method: 'POST',
        path: '/api/core/storefront/orders',
        params: '',
        desc: 'Place an order. Body: { storeId, customerId, orderType, paymentMethod, items: [{ productId, variantId, quantity }], deliveryAddress }.',
      },
      {
        method: 'GET',
        path: '/api/core/storefront/orders',
        params: '?customerId={id}',
        desc: 'List orders for the logged-in customer. Add Authorization: Bearer {token} header.',
      },
      {
        method: 'GET',
        path: '/api/core/storefront/orders/{orderId}/track',
        params: '',
        desc: 'Real-time order status and delivery tracking. Poll every 30s or use WebSocket.',
      },
    ],
  },
  {
    group: 'Customer Auth',
    icon: User,
    color: 'text-purple-600 bg-purple-50',
    items: [
      {
        method: 'POST',
        path: '/api/core/auth/login',
        params: '',
        desc: 'Body: { email, password }. Returns { accessToken, refreshToken, user }. Store tokens in Flutter SecureStorage.',
      },
      {
        method: 'POST',
        path: '/api/core/auth/refresh',
        params: '',
        desc: 'Body: { refreshToken }. Returns a new accessToken when the old one expires (every 20 minutes).',
      },
      {
        method: 'POST',
        path: '/api/core/auth/register',
        params: '',
        desc: 'Body: { name, email, password, phone, businessId }. Register a new customer account.',
      },
    ],
  },
]

const METHOD_COLOR: Record<string, string> = {
  GET:  'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT:  'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

// ─── Flutter init snippet ────────────────────────────────────────────────────

function flutterSnippet(baseUrl: string, slug: string) {
  return `// api_service.dart

const String baseUrl = '${baseUrl}';
const String tenantSlug = '${slug}';

Future<Map<String, dynamic>> bootstrapApp() async {
  final res = await http.get(
    Uri.parse('\$baseUrl/api/core/storefront/store-context?slug=\$tenantSlug'),
  );
  return jsonDecode(res.body)['data'];
}

// store returned businessId + primaryColor + store.deliveryFee
// into your app's state / provider`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MobileAppsView() {
  const baseUrl = useBaseUrl()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>('App Bootstrap')

  const { data: bizData, isLoading } = useBusinesses(
    { status: 'ACTIVE', limit: 100 },
    { staleTime: 60_000 }
  )

  const businesses = useMemo(() => {
    const list = (bizData?.data ?? []) as { id: string; name: string; slug: string; primaryColor: string; businessType: string }[]
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q))
  }, [bizData, search])

  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-50">
          <Smartphone className="size-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-bold">Flutter Integration Guide</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your white-label Flutter apps to Quantix Core. Each business tenant gets its own slug — use it to bootstrap branding, store config, and catalog.
          </p>
        </div>
      </div>

      {/* Base URL banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="size-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-800">API Base URL</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-blue-900 flex-1">{baseUrl}</code>
            <CopyButton text={baseUrl} label="baseurl" />
          </div>
          <p className="text-[10px] text-blue-600 mt-1">All endpoints below are relative to this URL.</p>
        </CardContent>
      </Card>

      {/* Tenant list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Active Tenants</CardTitle>
              <CardDescription className="text-xs">Click a tenant to see its Flutter init snippet</CardDescription>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tenants..."
                className="h-7 pl-6 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : businesses.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
              <AlertCircle className="size-5" />
              <p className="text-xs">{search ? 'No tenants match your search' : 'No active businesses found'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {businesses.map(biz => {
                const isOpen = expanded === biz.id
                const storeContextUrl = `${baseUrl}/api/core/storefront/store-context?slug=${biz.slug}`
                return (
                  <div key={biz.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpanded(isOpen ? null : biz.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div
                        className="size-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: biz.primaryColor || '#10B981' }}
                      >
                        {biz.name[0]}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{biz.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
                            {biz.slug}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{storeContextUrl}</p>
                      </div>
                      <CopyButton text={storeContextUrl} label={`url-${biz.id}`} />
                      {isOpen
                        ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="border-t bg-muted/30 px-3 py-3 space-y-3">
                        {/* Key values */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Business ID', value: biz.id },
                            { label: 'Slug', value: biz.slug },
                            { label: 'Type', value: biz.businessType },
                            { label: 'Theme', value: biz.primaryColor || '#10B981' },
                          ].map(r => (
                            <div key={r.label} className="bg-background rounded-md p-2 border">
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{r.label}</p>
                              <div className="flex items-center gap-1">
                                <code className="text-[11px] font-mono truncate">{r.value}</code>
                                <CopyButton text={r.value} label={`${r.label}-${biz.id}`} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Flutter snippet */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                            <Layers className="size-3" /> Flutter init snippet
                          </p>
                          <CodeBlock
                            code={flutterSnippet(baseUrl, biz.slug)}
                            label={`snippet-${biz.id}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auth header reminder */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2">
            <Key className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Authenticated Requests</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                After customer login, attach the token to every request:
              </p>
              <code className="text-[11px] font-mono text-amber-900 mt-1 block">
                Authorization: Bearer {'<accessToken>'}
              </code>
              <p className="text-[10px] text-amber-600 mt-1">
                Tokens expire in 20 min — use <code className="font-mono">/api/core/auth/refresh</code> with your refreshToken.
                Store both tokens in Flutter <code className="font-mono">flutter_secure_storage</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoint reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Endpoint Reference</CardTitle>
          <CardDescription className="text-xs">All endpoints your Flutter app needs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ENDPOINTS.map(group => {
            const Icon = group.icon
            const isOpen = openGroup === group.group
            return (
              <div key={group.group} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenGroup(isOpen ? null : group.group)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`p-1.5 rounded-md ${group.color}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-sm font-semibold flex-1">{group.group}</span>
                  <Badge variant="outline" className="text-[10px] h-4">{group.items.length}</Badge>
                  {isOpen
                    ? <ChevronDown className="size-3.5 text-muted-foreground" />
                    : <ChevronRight className="size-3.5 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t divide-y">
                    {group.items.map((ep, i) => (
                      <div key={i} className="px-3 py-2.5 bg-muted/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-[9px] px-1.5 py-0 h-4 font-mono ${METHOD_COLOR[ep.method] || ''}`}>
                            {ep.method}
                          </Badge>
                          <code className="text-[11px] font-mono text-foreground">{ep.path}</code>
                          {ep.params && (
                            <code className="text-[10px] font-mono text-muted-foreground">{ep.params}</code>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{ep.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* WebSocket note */}
      <Card className="border-muted">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-2">
            <Zap className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Real-time Order Updates (WebSocket)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Connect to the Socket.IO server at <code className="font-mono text-[10px]">{baseUrl}</code> and join room:
              </p>
              <code className="text-[11px] font-mono block mt-1 bg-muted rounded px-2 py-1">
                business:{'{businessId}'}
              </code>
              <p className="text-[10px] text-muted-foreground mt-1">
                Listen for <code className="font-mono">order:new</code>, <code className="font-mono">order:status_changed</code>, and <code className="font-mono">order:assigned</code> events.
                Use <code className="font-mono">socket_io_client</code> package in Flutter.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
