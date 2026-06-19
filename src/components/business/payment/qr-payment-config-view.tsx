"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, QrCode, Save, CheckCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { buildUpiUri } from "@/lib/upi-qr"
import { showSuccess, showError } from "@/lib/toast-utils"

interface QRPaymentConfigData {
  id?: string
  upiId: string
  merchantName: string
  qrCode: string
  dynamicQREnabled: boolean
  codEnabled: boolean
  outstandingQR: string
}

export function QrPaymentConfigView() {
  const { currentBusinessId } = useAdminStore()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [config, setConfig] = useState<QRPaymentConfigData>({
    upiId: "",
    merchantName: "",
    qrCode: "",
    dynamicQREnabled: false,
    codEnabled: true,
    outstandingQR: "",
  })

  const businessId = currentBusinessId || ""

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/business/${businessId}/qr-payment`, {
        headers: { ...getAuthHeaders(), "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success && json.data) {
        setConfig({
          upiId: json.data.upiId || "",
          merchantName: json.data.merchantName || "",
          qrCode: json.data.qrCode || "",
          dynamicQREnabled: json.data.dynamicQREnabled ?? false,
          codEnabled: json.data.codEnabled ?? true,
          outstandingQR: json.data.outstandingQR || "",
        })
      }
    } catch {
      showError("Failed to load QR payment config")
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    if (!businessId) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/business/${businessId}/qr-payment`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (json.success) {
        showSuccess("QR payment config saved")
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        showError(json.error || "Failed to save")
      }
    } catch {
      showError("Failed to save QR payment config")
    } finally {
      setSaving(false)
    }
  }

  const upiUri = config.upiId ? buildUpiUri({ pa: config.upiId, pn: config.merchantName || undefined }) : ""

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR Payment Configuration</h1>
          <p className="text-sm text-muted-foreground">Configure UPI QR payments for your business</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving..." : saved ? "Saved" : "Save Settings"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>UPI Details</CardTitle>
            <CardDescription>Enter your UPI payment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upiId">UPI ID (VPA)</Label>
              <Input
                id="upiId"
                placeholder="example@paytm"
                value={config.upiId}
                onChange={(e) => setConfig((p) => ({ ...p, upiId: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchantName">Merchant Name</Label>
              <Input
                id="merchantName"
                placeholder="Your Business Name"
                value={config.merchantName}
                onChange={(e) => setConfig((p) => ({ ...p, merchantName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qrCode">Primary QR Code (Base64 or URL)</Label>
              <Input
                id="qrCode"
                placeholder="data:image/png;base64,... or https://..."
                value={config.qrCode}
                onChange={(e) => setConfig((p) => ({ ...p, qrCode: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outstandingQR">Outstanding Payment QR (Base64 or URL)</Label>
              <Input
                id="outstandingQR"
                placeholder="data:image/png;base64,... or https://..."
                value={config.outstandingQR}
                onChange={(e) => setConfig((p) => ({ ...p, outstandingQR: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Options</CardTitle>
              <CardDescription>Configure payment behaviour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="codEnabled">Cash on Delivery</Label>
                  <p className="text-xs text-muted-foreground">Allow customers to pay on delivery</p>
                </div>
                <Switch
                  id="codEnabled"
                  checked={config.codEnabled}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, codEnabled: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dynamicQREnabled">Dynamic QR</Label>
                  <p className="text-xs text-muted-foreground">Generate QR with dynamic amount per order</p>
                </div>
                <Switch
                  id="dynamicQREnabled"
                  checked={config.dynamicQREnabled}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, dynamicQREnabled: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Preview</CardTitle>
              <CardDescription>Preview your UPI payment QR</CardDescription>
            </CardHeader>
            <CardContent>
              {config.qrCode ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.qrCode}
                    alt="Primary QR"
                    className="w-48 h-48 rounded-xl border object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder-logo.svg" }}
                  />
                  <p className="text-xs text-muted-foreground text-center break-all max-w-xs">{config.upiId}</p>
                </div>
              ) : upiUri ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-48 h-48 rounded-xl border flex items-center justify-center bg-muted">
                    <QrCode className="w-16 h-16 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Enter a UPI ID to generate QR</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-48 h-48 rounded-xl border flex items-center justify-center bg-muted">
                    <QrCode className="w-16 h-16 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">No QR configured yet</p>
                </div>
              )}

              {upiUri && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-mono break-all text-muted-foreground">{upiUri}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
