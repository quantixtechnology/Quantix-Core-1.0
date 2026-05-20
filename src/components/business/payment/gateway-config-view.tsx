"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CreditCard, Lock, Unlock, CheckCircle2, AlertCircle,
  Shield, Save, Eye, EyeOff, Zap, Settings2, Store,
  ChevronDown,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/toast-utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GatewayInfo {
  pluginId:        string
  gateway:         string
  displayName:     string
  description:     string | null
  supportedMethods: string[]
  webhookPath:     string | null
  docsUrl:         string | null
  accessId:        string
  canConfigure:    boolean
  isActive:        boolean
  assignedStoreIds: string[]
  storeConfigs: StoreConfig[]
}

interface StoreConfig {
  id:               string
  storeId:          string
  storeName:        string
  storeCode:        string | null
  isActive:         boolean
  environment:      string
  merchantId:       string | null
  hasApiKey:        boolean
  hasSecret:        boolean
  hasWebhookSecret: boolean
}

interface StoreInfo {
  id: string
  name: string
  storeCode: string | null
}

// Credential field definitions per gateway
const GATEWAY_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  razorpay:  [
    { key: "apiKey",     label: "Key ID",     placeholder: "rzp_live_xxxxxxxxxx" },
    { key: "secretKey",  label: "Key Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
    { key: "webhookSecret", label: "Webhook Secret", placeholder: "whsec_xxxxxxxxxx", secret: true },
  ],
  phonepe:   [
    { key: "merchantId",   label: "Merchant ID",   placeholder: "PGTESTPAYUAT" },
    { key: "apiKey",       label: "Salt Key",       placeholder: "099eb0cd-02cf-4dc2-a4d7", secret: true },
  ],
  paytm:     [
    { key: "merchantId",  label: "Merchant ID",  placeholder: "YourMID" },
    { key: "secretKey",   label: "Merchant Key", placeholder: "xxxxxxxxxxxxxxxx", secret: true },
  ],
  bharatpe:  [
    { key: "merchantId", label: "Merchant ID", placeholder: "BPxxxxxxxxxx" },
    { key: "apiKey",     label: "API Token",   placeholder: "Bearer xxxxxxxx", secret: true },
  ],
  pinelabs:  [
    { key: "merchantId",  label: "Merchant ID",  placeholder: "PLxxxxxxxx" },
    { key: "apiKey",      label: "Access Code",  placeholder: "xxxxxxxxxx", secret: true },
  ],
  cashfree:  [
    { key: "merchantId", label: "App ID",     placeholder: "CF_APP_xxxxxxxxxx" },
    { key: "secretKey",  label: "Secret Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
  ],
  payu:      [
    { key: "merchantId", label: "Merchant Key",  placeholder: "gtKFFx" },
    { key: "secretKey",  label: "Merchant Salt", placeholder: "eCwWELxi", secret: true },
  ],
  stripe:    [
    { key: "merchantId",  label: "Publishable Key", placeholder: "pk_live_xxxxxxxxxx" },
    { key: "apiKey",      label: "Secret Key",      placeholder: "sk_live_xxxxxxxxxx",  secret: true },
    { key: "webhookSecret", label: "Webhook Secret",placeholder: "whsec_xxxxxxxxxx",    secret: true },
  ],
  hdfc:      [
    { key: "merchantId",   label: "Merchant ID",   placeholder: "HDFC_MERCHxxxxxxxxxx" },
    { key: "apiKey",       label: "Access Code",   placeholder: "xxxxxxxxxx",           secret: true },
    { key: "secretKey",    label: "Encryption Key",placeholder: "xxxxxxxxxxxxxxxx",     secret: true },
  ],
  ccavenue:  [
    { key: "merchantId",  label: "Merchant ID",  placeholder: "CCA_xxxxxxx" },
    { key: "apiKey",      label: "Access Code",  placeholder: "xxxxxxxxxxxxxxxx" },
    { key: "secretKey",   label: "Working Key",  placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
  ],
}

const GATEWAY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  razorpay:  { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  phonepe:   { color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  paytm:     { color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200" },
  bharatpe:  { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  pinelabs:  { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  cashfree:  { color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  payu:      { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  stripe:    { color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  hdfc:      { color: "text-cyan-700",   bg: "bg-cyan-50",   border: "border-cyan-200" },
  ccavenue:  { color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
}

function gatewayStyle(gw: string) {
  return GATEWAY_STYLE[gw] || { color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function GatewayConfigView() {
  const { businessId, businessName } = useBusinessContext()
  const queryClient = useQueryClient()

  // Dialog state
  const [editGateway, setEditGateway]     = useState<GatewayInfo | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [configValues, setConfigValues]   = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets]     = useState<Record<string, boolean>>({})
  const [isLiveMode, setIsLiveMode]       = useState(false)

  // ── Fetch assigned gateways ───────────────────────────────────────────────
  const { data: gatewaysData, isLoading } = useQuery<GatewayInfo[]>({
    queryKey: ["business-gateways-v2", businessId],
    queryFn: async () => {
      if (!businessId) return []
      const res  = await fetch(`/api/core/businesses/${businessId}/payment-gateways`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return data.data as GatewayInfo[]
    },
    enabled: !!businessId,
    refetchInterval: 120_000,
  })

  // Fetch stores for the business (for the store selector)
  const { data: storesData = [] } = useQuery<StoreInfo[]>({
    queryKey: ["business-stores-list", businessId],
    queryFn: async () => {
      const res  = await fetch(`/api/core/stores?businessId=${businessId}&limit=50`, { headers: getAuthHeaders() })
      const json = await res.json()
      return (json.data ?? []) as StoreInfo[]
    },
    enabled: !!businessId && editDialogOpen,
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      storeId: string
      pluginId: string
      accessId: string
      merchantId?: string
      apiKey?: string
      secretKey?: string
      webhookSecret?: string
      isActive: boolean
      environment: string
    }) => {
      if (!businessId) throw new Error("No business context")
      const res = await fetch(
        `/api/core/businesses/${businessId}/stores/${payload.storeId}/payment-config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Save failed")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-gateways-v2", businessId] })
      showSuccess("Gateway configuration saved for store")
      setEditDialogOpen(false)
      setEditGateway(null)
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Failed to save configuration"),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────
  const gateways = gatewaysData ?? []

  const openEditDialog = (gw: GatewayInfo) => {
    setEditGateway(gw)
    // Default to first assigned store
    const first = gw.assignedStoreIds[0] ?? ""
    setSelectedStoreId(first)
    prefillStoreConfig(gw, first)
    setShowSecrets({})
    setEditDialogOpen(true)
  }

  const prefillStoreConfig = (gw: GatewayInfo, storeId: string) => {
    const existing = gw.storeConfigs.find((sc) => sc.storeId === storeId)
    const fields   = GATEWAY_FIELDS[gw.gateway] ?? []
    const initial: Record<string, string> = {}
    fields.forEach((f) => { initial[f.key] = "" }) // secrets are never returned from API
    if (existing?.merchantId) initial.merchantId = existing.merchantId
    setIsLiveMode(existing?.environment === "PRODUCTION")
    setConfigValues(initial)
  }

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId)
    if (editGateway) prefillStoreConfig(editGateway, storeId)
  }

  const handleSave = () => {
    if (!editGateway || !selectedStoreId) return
    saveMutation.mutate({
      storeId:      selectedStoreId,
      pluginId:     editGateway.pluginId,
      accessId:     editGateway.accessId,
      merchantId:   configValues.merchantId  || undefined,
      apiKey:       configValues.apiKey      || undefined,
      secretKey:    configValues.secretKey   || undefined,
      webhookSecret:configValues.webhookSecret || undefined,
      isActive:     true,
      environment:  isLiveMode ? "PRODUCTION" : "SANDBOX",
    })
  }

  // ── Loading / no context ──────────────────────────────────────────────────
  if (!businessId) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="p-6 text-sm text-rose-700">Unable to resolve business context.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Gateways
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {businessName ? `Payment gateway configuration for ${businessName}` : "Configure your payment gateways"}
        </p>
      </div>

      {/* Governance notice */}
      <div className="flex items-start gap-2.5 rounded-lg bg-blue-50 border border-blue-200 p-3">
        <Shield className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-0.5">
          <p className="font-semibold">Store-Level Configuration</p>
          <p>Gateways are assigned per-store by your account manager. Click <strong>Configure</strong> to add API credentials for each assigned store. Credentials are encrypted at rest.</p>
        </div>
      </div>

      {/* Gateway list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : gateways.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No payment gateways assigned</p>
            <p className="text-xs text-muted-foreground mt-1">Contact Quantix support to enable payment gateways for your business.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gateways.map((gw) => {
            const style      = gatewayStyle(gw.gateway)
            const fields     = GATEWAY_FIELDS[gw.gateway] ?? []
            const configuredStores = gw.storeConfigs.filter((sc) => sc.hasApiKey || sc.merchantId)
            const activeStores     = gw.storeConfigs.filter((sc) => sc.isActive)

            return (
              <Card key={gw.pluginId} className={`shadow-none border ${activeStores.length > 0 ? style.border : "border-border"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                      <CreditCard className={`h-4 w-4 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{gw.displayName}</p>
                        {activeStores.length > 0
                          ? <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-0 gap-1"><CheckCircle2 className="h-2.5 w-2.5" />{activeStores.length} store{activeStores.length !== 1 ? "s" : ""} active</Badge>
                          : <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 gap-1"><AlertCircle className="h-2.5 w-2.5" />Not configured</Badge>
                        }
                        {gw.canConfigure
                          ? <Badge variant="outline" className="text-[9px] gap-1"><Unlock className="h-2.5 w-2.5" />Configurable</Badge>
                          : <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground"><Lock className="h-2.5 w-2.5" />Admin managed</Badge>
                        }
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{gw.description}</p>

                      {/* Per-store config summary */}
                      {gw.assignedStoreIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {gw.assignedStoreIds.map((sid) => {
                            const sc = gw.storeConfigs.find((s) => s.storeId === sid)
                            const storeName = sc?.storeName ?? `Store ${sid.slice(-4)}`
                            return (
                              <div key={sid} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium border ${sc?.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                <Store className="h-2.5 w-2.5" />
                                {storeName}
                                {sc?.environment === "PRODUCTION" && <span className="text-rose-600 font-bold">·LIVE</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {gw.canConfigure ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-[11px]"
                          disabled={gw.assignedStoreIds.length === 0}
                          onClick={() => openEditDialog(gw)}
                        >
                          <Settings2 className="h-3 w-3" />Configure
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2">
                          <Lock className="h-3 w-3" /><span>Admin managed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Per-Store Config Dialog ───────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditGateway(null) }}>
        <DialogContent className="max-w-md">
          {editGateway && (() => {
            const style  = gatewayStyle(editGateway.gateway)
            const fields = GATEWAY_FIELDS[editGateway.gateway] ?? []
            const existingConfig = editGateway.storeConfigs.find((sc) => sc.storeId === selectedStoreId)
            // Assigned stores, fetched from business store list for name lookup
            const assignedStores = storesData.filter((s) => editGateway.assignedStoreIds.includes(s.id))

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-base">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                      <CreditCard className={`h-3.5 w-3.5 ${style.color}`} />
                    </div>
                    Configure {editGateway.displayName}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    API credentials are encrypted at rest. Set credentials per store.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-1">
                  {/* Store selector */}
                  <div className="space-y-1">
                    <Label className="text-[11px] flex items-center gap-1.5"><Store className="h-3 w-3" />Select Store</Label>
                    <div className="relative">
                      <select
                        value={selectedStoreId}
                        onChange={(e) => handleStoreChange(e.target.value)}
                        className="w-full h-8 pl-2 pr-8 text-xs rounded-md border bg-background appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {assignedStores.length === 0
                          ? <option value="">No stores assigned for this gateway</option>
                          : assignedStores.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}{s.storeCode ? ` (#${s.storeCode})` : ""}</option>
                          ))
                        }
                      </select>
                      <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                    {existingConfig && (
                      <p className={`text-[9px] flex items-center gap-1 ${existingConfig.isActive ? "text-emerald-600" : "text-amber-600"}`}>
                        {existingConfig.isActive ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                        {existingConfig.isActive ? "Active" : "Inactive"} · {existingConfig.environment}
                        {existingConfig.hasApiKey && " · API key saved"}
                        {existingConfig.hasSecret && " · Secret saved"}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Live/Test toggle */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{isLiveMode ? "Live Mode" : "Sandbox / Test"}</p>
                      <p className="text-[10px] text-muted-foreground">{isLiveMode ? "Real transactions — use production credentials" : "Test mode — no real charges"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLiveMode((v) => !v)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isLiveMode ? "bg-emerald-500" : "bg-input"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition duration-200 ${isLiveMode ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Credential fields */}
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-[11px] flex items-center gap-1.5">
                        {field.label}
                        {field.secret && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                        {field.secret && existingConfig && field.key === "apiKey"      && existingConfig.hasApiKey      && <span className="text-[9px] text-emerald-600">(saved)</span>}
                        {field.secret && existingConfig && field.key === "secretKey"   && existingConfig.hasSecret       && <span className="text-[9px] text-emerald-600">(saved)</span>}
                        {field.secret && existingConfig && field.key === "webhookSecret" && existingConfig.hasWebhookSecret && <span className="text-[9px] text-emerald-600">(saved)</span>}
                      </Label>
                      <div className="relative">
                        <Input
                          className="h-8 text-xs pr-8"
                          type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                          placeholder={field.secret && existingConfig?.hasApiKey && field.key === "apiKey" ? "••••• (unchanged)" : field.placeholder}
                          value={configValues[field.key] || ""}
                          onChange={(e) => setConfigValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        />
                        {field.secret && (
                          <button
                            type="button"
                            className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowSecrets((s) => ({ ...s, [field.key]: !s[field.key] }))}
                          >
                            {showSecrets[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Webhook URL */}
                  {editGateway.webhookPath && selectedStoreId && (
                    <div className="rounded-lg bg-muted/50 p-2.5 text-[10px] text-muted-foreground">
                      <p className="font-medium flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />Store Webhook URL</p>
                      <code className="mt-1 block break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/payment/webhook/${selectedStoreId}/${editGateway.gateway}`}</code>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={saveMutation.isPending || !selectedStoreId}
                    onClick={handleSave}
                  >
                    <Save className="h-3 w-3" />
                    {saveMutation.isPending ? "Saving…" : "Save for Store"}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
