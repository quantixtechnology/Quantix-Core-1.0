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
  Shield, Save, Eye, EyeOff, Info, Globe, Zap, Settings2,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/toast-utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GatewayPlugin {
  id: string
  gateway: string
  displayName: string
  description: string | null
  isGloballyEnabled: boolean
  supportedMethods: string
  webhookPath: string | null
  docsUrl: string | null
  businessAccess: BusinessAccess[]
}

interface BusinessAccess {
  id: string
  businessId: string
  pluginId: string
  isAssigned: boolean
  canConfigure: boolean
  isActive: boolean
  config: string
  notes: string | null
}

// Credential field definitions per gateway
const GATEWAY_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  razorpay:  [
    { key: "keyId",     label: "Key ID",     placeholder: "rzp_live_xxxxxxxxxx" },
    { key: "keySecret", label: "Key Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
  ],
  phonepe:   [
    { key: "merchantId",   label: "Merchant ID",  placeholder: "PGTESTPAYUAT" },
    { key: "saltKey",      label: "Salt Key",      placeholder: "099eb0cd-02cf-4dc2-a4d7", secret: true },
    { key: "saltIndex",    label: "Salt Key Index",placeholder: "1" },
  ],
  paytm:     [
    { key: "merchantId",  label: "Merchant ID",  placeholder: "YourMID" },
    { key: "merchantKey", label: "Merchant Key", placeholder: "xxxxxxxxxxxxxxxx", secret: true },
    { key: "websiteName", label: "Website Name", placeholder: "WEBSTAGING" },
  ],
  bharatpe:  [
    { key: "merchantId", label: "Merchant ID",  placeholder: "BPxxxxxxxxxx" },
    { key: "token",      label: "API Token",    placeholder: "Bearer xxxxxxxx", secret: true },
  ],
  pinelabs:  [
    { key: "merchantId",  label: "Merchant ID",   placeholder: "PLxxxxxxxx" },
    { key: "terminalId",  label: "Terminal ID",   placeholder: "TERMxxxxxxx" },
    { key: "accessCode",  label: "Access Code",   placeholder: "xxxxxxxxxx", secret: true },
  ],
  cashfree:  [
    { key: "appId",     label: "App ID",     placeholder: "CF_APP_xxxxxxxxxx" },
    { key: "secretKey", label: "Secret Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
  ],
  payu:      [
    { key: "merchantKey",  label: "Merchant Key",  placeholder: "gtKFFx" },
    { key: "merchantSalt", label: "Merchant Salt", placeholder: "eCwWELxi", secret: true },
  ],
  stripe:    [
    { key: "publishableKey", label: "Publishable Key", placeholder: "pk_live_xxxxxxxxxx" },
    { key: "secretKey",      label: "Secret Key",      placeholder: "sk_live_xxxxxxxxxx", secret: true },
    { key: "webhookSecret",  label: "Webhook Secret",  placeholder: "whsec_xxxxxxxxxx",   secret: true },
  ],
  hdfc:      [
    { key: "merchantId",   label: "Merchant ID",   placeholder: "HDFC_MERCHxxxxxxxxxx" },
    { key: "accessCode",   label: "Access Code",   placeholder: "xxxxxxxxxx",           secret: true },
    { key: "encryptionKey",label: "Encryption Key",placeholder: "xxxxxxxxxxxxxxxx",     secret: true },
  ],
  ccavenue:  [
    { key: "merchantId",  label: "Merchant ID",  placeholder: "CCA_xxxxxxx" },
    { key: "accessCode",  label: "Access Code",  placeholder: "xxxxxxxxxxxxxxxx" },
    { key: "workingKey",  label: "Working Key",  placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", secret: true },
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

function parseMethods(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function GatewayConfigView() {
  const { businessId, businessName } = useBusinessContext()
  const queryClient = useQueryClient()

  // Config edit dialog state
  const [editPlugin, setEditPlugin] = useState<GatewayPlugin | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [isTestMode, setIsTestMode] = useState(true)

  // ── Fetch assigned plugins for this business ──────────────────────────────
  const { data: pluginsData, isLoading } = useQuery<GatewayPlugin[]>({
    queryKey: ["business-gateways", businessId],
    queryFn: async () => {
      if (!businessId) return []
      const res  = await fetch(`/api/admin/payment-plugins?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return data.data as GatewayPlugin[]
    },
    enabled: !!businessId,
    refetchInterval: 120_000,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ pluginId, config }: { pluginId: string; config: Record<string, string> }) => {
      if (!businessId) throw new Error("No business context")
      const res  = await fetch("/api/admin/payment-plugins", {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ action: "save_config", pluginId, businessId, config: { ...config, isTestMode } }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-gateways", businessId] })
      showSuccess("Gateway configuration saved")
      setEditDialogOpen(false)
      setEditPlugin(null)
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Failed to save configuration"),
  })

  // Plugins assigned to this business (Super Admin assigned)
  const assignedPlugins = useMemo(() => {
    return (pluginsData || []).filter((p) => {
      const access = p.businessAccess?.[0]
      return p.isGloballyEnabled && access?.isAssigned
    })
  }, [pluginsData])

  const openEditDialog = (plugin: GatewayPlugin) => {
    const access  = plugin.businessAccess?.[0]
    let existing: Record<string, string> = {}
    try { existing = JSON.parse(access?.config || "{}") } catch { existing = {} }

    const fields  = GATEWAY_FIELDS[plugin.gateway] || []
    const initial: Record<string, string> = {}
    fields.forEach((f) => { initial[f.key] = (existing[f.key] as string) || "" })
    setIsTestMode(typeof existing.isTestMode === "boolean" ? existing.isTestMode : true)
    setConfigValues(initial)
    setShowSecrets({})
    setEditPlugin(plugin)
    setEditDialogOpen(true)
  }

  const handleSave = () => {
    if (!editPlugin) return
    saveMutation.mutate({ pluginId: editPlugin.id, config: configValues })
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
          <p className="font-semibold">Managed by Quantix Platform</p>
          <p>Payment gateways are enabled by your account manager. Gateways marked <strong>Read-only</strong> are configured centrally — contact support to make changes.</p>
        </div>
      </div>

      {/* Gateway list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : assignedPlugins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium">No payment gateways assigned</p>
            <p className="text-xs text-muted-foreground mt-1">Contact Quantix support to enable payment gateways for your business.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignedPlugins.map((plugin) => {
            const access      = plugin.businessAccess?.[0]
            const canConfig   = access?.canConfigure  || false
            const isActive    = access?.isActive      || false
            const methods     = parseMethods(plugin.supportedMethods)
            const style       = gatewayStyle(plugin.gateway)
            const fields      = GATEWAY_FIELDS[plugin.gateway] || []
            let cfg: Record<string, string> = {}
            try { cfg = JSON.parse(access?.config || "{}") } catch { cfg = {} }
            const hasConfig   = fields.some((f) => !!cfg[f.key])

            return (
              <Card key={plugin.id} className={`shadow-none border ${isActive && hasConfig ? style.border : "border-border"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                      <CreditCard className={`h-4 w-4 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{plugin.displayName}</p>
                        {isActive && hasConfig
                          ? <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-0 gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Active</Badge>
                          : <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 gap-1"><AlertCircle className="h-2.5 w-2.5" />Not Configured</Badge>
                        }
                        {canConfig
                          ? <Badge variant="outline" className="text-[9px] gap-1"><Unlock className="h-2.5 w-2.5" />Configurable</Badge>
                          : <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground"><Lock className="h-2.5 w-2.5" />Read-only</Badge>
                        }
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{plugin.description}</p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {methods.map((m) => (
                          <span key={m} className="inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium bg-slate-100 text-slate-600">{m}</span>
                        ))}
                      </div>

                      {/* Configured fields (masked) */}
                      {hasConfig && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {fields.map((f) => cfg[f.key] ? (
                            <div key={f.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                              <span>{f.label}</span>
                            </div>
                          ) : (
                            <div key={f.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <AlertCircle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                              <span>{f.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Edit or info button */}
                    <div className="shrink-0">
                      {canConfig ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => openEditDialog(plugin)}>
                          <Settings2 className="h-3 w-3" />Configure
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2">
                          <Lock className="h-3 w-3" />
                          <span>Admin managed</span>
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

      {/* ── Config Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditPlugin(null) }}>
        <DialogContent className="max-w-md">
          {editPlugin && (() => {
            const style  = gatewayStyle(editPlugin.gateway)
            const fields = GATEWAY_FIELDS[editPlugin.gateway] || []
            const allFilled = fields.filter((f) => !f.secret || f.secret).every((f) => !!configValues[f.key])

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2.5 text-base">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                      <CreditCard className={`h-3.5 w-3.5 ${style.color}`} />
                    </div>
                    Configure {editPlugin.displayName}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Enter your API credentials. Secret fields are encrypted at rest.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  {/* Test/Live mode toggle */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{isTestMode ? "Test Mode" : "Live Mode"}</p>
                      <p className="text-[10px] text-muted-foreground">{isTestMode ? "Use test credentials — no real charges" : "Live credentials — real transactions"}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!isTestMode}
                      onClick={() => setIsTestMode((v) => !v)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${!isTestMode ? "bg-emerald-500" : "bg-input"}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition duration-200 ${!isTestMode ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  <Separator />

                  {fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-[11px] flex items-center gap-1.5">
                        {field.label}
                        {field.secret && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                      </Label>
                      <div className="relative">
                        <Input
                          className="h-8 text-xs pr-8"
                          type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                          placeholder={field.placeholder}
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

                  {/* Webhook info */}
                  {editPlugin.webhookPath && (
                    <div className="rounded-lg bg-muted/50 p-2.5 text-[10px] text-muted-foreground">
                      <p className="font-medium flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />Webhook URL</p>
                      <code className="mt-1 block break-all">{`${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}${editPlugin.webhookPath}`}</code>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button size="sm" className="gap-1.5" disabled={saveMutation.isPending} onClick={handleSave}>
                    <Save className="h-3 w-3" />
                    {saveMutation.isPending ? "Saving…" : "Save Configuration"}
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
