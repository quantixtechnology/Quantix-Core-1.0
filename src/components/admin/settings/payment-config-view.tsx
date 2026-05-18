"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, RefreshCw, Save, CheckCircle2, Eye, EyeOff, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

interface PaymentConfig {
  accountName:   string
  bankName:      string
  accountNumber: string
  ifsc:          string
  upiId:         string
  branch:        string
  qrUrl:         string
  active:        boolean
}

const EMPTY: PaymentConfig = {
  accountName: "", bankName: "", accountNumber: "",
  ifsc: "", upiId: "", branch: "", qrUrl: "", active: true,
}

export function PaymentConfigView() {
  const { permissions } = useAuthStore()
  const canEdit = (permissions as string[]).includes("payment_config:edit")

  const [config, setConfig]   = useState<PaymentConfig>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [qrDragging, setQrDragging]   = useState(false)
  const qrInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    authFetch("/api/admin/payment-config")
      .then(r => r.json())
      .then(json => { if (json.success) setConfig({ ...EMPTY, ...json.data }) })
      .catch(() => toast.error("Failed to load payment configuration"))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res  = await authFetch("/api/admin/payment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (json.success) {
        setSaved(true)
        toast.success("Payment configuration saved")
      } else {
        toast.error(json.error ?? "Failed to save")
      }
    } catch {
      toast.error("Failed to save payment configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleQrFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are accepted (PNG, JPG, WEBP)")
      return
    }
    if (file.size > 1024 * 1024) {
      toast.error("QR image must be under 1 MB")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      set("qrUrl", dataUrl)
      setSaved(false)
    }
    reader.readAsDataURL(file)
  }

  const field = (
    label: string,
    key: keyof PaymentConfig,
    placeholder: string,
    opts?: { type?: string; secret?: boolean },
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="relative">
        <Input
          type={opts?.secret && !showAccount ? "password" : (opts?.type ?? "text")}
          placeholder={placeholder}
          className="h-9 text-sm"
          value={config[key] as string}
          onChange={e => set(key, e.target.value as PaymentConfig[typeof key])}
          disabled={!canEdit || loading}
        />
        {opts?.secret && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowAccount(v => !v)}
          >
            {showAccount ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Payment Configuration"
        description="Bank account details and payment QR code shown on client proposals"
        icon={CreditCard}
        action={
          canEdit ? (
            <Button className="gap-2" onClick={handleSave} disabled={saving || loading}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : saved ? "Saved" : "Save Configuration"}
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* Bank Details */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">Bank Account Details</p>
            <p className="text-xs text-muted-foreground">Appears in the Payment Terms section of every proposal PDF.</p>
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                <div className="h-9 bg-muted animate-pulse rounded" />
              </div>
            ))
          ) : (
            <>
              {field("Account Holder Name", "accountName", "e.g. Quantix Technology")}
              {field("Bank Name",           "bankName",    "e.g. HDFC Bank")}
              {field("Account Number",      "accountNumber", "e.g. 50200012345678", { secret: true })}
              {field("IFSC Code",           "ifsc",        "e.g. HDFC0001234")}
              {field("UPI ID",              "upiId",       "e.g. quantix@hdfcbank")}
              {field("Branch",              "branch",      "e.g. Andheri West, Mumbai")}
            </>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <p className="text-xs font-semibold">Show in Proposals</p>
              <p className="text-[10px] text-muted-foreground">When off, bank details are hidden from all PDFs</p>
            </div>
            <button
              type="button"
              onClick={() => canEdit && set("active", !config.active)}
              disabled={!canEdit || loading}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none ${
                config.active ? "bg-blue-600" : "bg-muted-foreground/30"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config.active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        {/* QR Configuration */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">Payment QR Code</p>
            <p className="text-xs text-muted-foreground">Upload your payment QR image. It appears bottom-right on every proposal PDF.</p>
          </div>

          {loading ? (
            <div className="h-36 bg-muted animate-pulse rounded-lg" />
          ) : config.qrUrl ? (
            /* ── QR uploaded — show preview + replace/remove controls ── */
            <div className="flex flex-col items-center gap-3 rounded-lg border p-6 bg-muted/10">
              <img
                src={config.qrUrl}
                alt="Payment QR"
                className="w-32 h-32 rounded-lg border object-contain bg-white"
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <p className="text-[10px] text-muted-foreground text-center">Payment QR — shown on every proposal PDF</p>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                    onClick={() => qrInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { set("qrUrl", ""); setSaved(false) }}
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ── No QR — upload drop zone ── */
            <div
              className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                qrDragging ? "border-blue-400 bg-blue-50" : "border-muted-foreground/20 hover:border-blue-300 bg-muted/10"
              } ${!canEdit ? "pointer-events-none opacity-60" : ""}`}
              onClick={() => canEdit && qrInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setQrDragging(true) }}
              onDragLeave={() => setQrDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setQrDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleQrFile(file)
              }}
            >
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Upload QR Image</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP · Max 1 MB</p>
                <p className="text-xs text-muted-foreground">Click or drag & drop</p>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={qrInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleQrFile(file)
              e.target.value = ""
            }}
          />

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              The uploaded QR is embedded directly — no external URL required. It renders immediately in the live proposal preview.
            </p>
          </div>
        </div>

      </div>

      {/* Info card */}
      <div className="mt-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold text-amber-800 mb-1">How this appears in proposals</p>
        <p className="text-xs text-amber-700 leading-relaxed">
          When "Show in Proposals" is enabled, bank details appear in the Payment Terms section on Page 2 of every proposal PDF.
          The uploaded QR image appears bottom-right on Page 2. Because the QR is embedded in the configuration (not an external URL),
          it renders immediately in the live preview — no save required. Changes take effect on all new and re-downloaded proposals.
        </p>
      </div>
    </div>
  )
}
