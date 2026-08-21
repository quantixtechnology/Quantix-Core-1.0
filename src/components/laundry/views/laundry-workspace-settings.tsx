"use client"

import { useCallback, useEffect, useState } from "react"
import { useLaundryLicensing } from "@/hooks/use-laundry-licensing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Truck, Scan, Thermometer, Home, Shield, Loader2, Save } from "lucide-react"
import { LaundryStorageWidget } from "./laundry-storage-widget"
import { LaundryFinancialSettingsForm } from "./laundry-financial-settings-form"
import { LaundrySlotSettingsForm } from "./laundry-slot-settings-form"
import { LaundryAvailabilitySettingsForm } from "./laundry-availability-settings-form"
import { LaundryPaymentSettingsForm } from "./laundry-payment-settings-form"
import { LaundryPrinterSettingsForm } from "./laundry-printer-settings-form"
import { LaundryPaymentProvidersForm } from "./laundry-payment-providers-form"
import { LaundryVerificationSettingsForm } from "./laundry-verification-settings-form"
import { toast } from "sonner"
import { invalidateTransportModes } from "@/hooks/use-transport-modes"
import type { TransportMode } from "@/lib/laundry-transport"
import { LaundryBrandingSettings } from "@/components/laundry/views/laundry-branding-settings"
import { LaundryCustomerSourcesForm } from "@/components/laundry/views/laundry-customer-sources-form"

interface WorkspaceSettingsProps {
  businessId: string
}

type ScanMode = "GENERATE_NEW" | "REUSE_BAG" | "BOTH"

export function LaundryWorkspaceSettings({ businessId }: WorkspaceSettingsProps) {
  const { isEnabled, loading } = useLaundryLicensing(businessId)
  const [storeToProcessing, setStoreToProcessing] = useState<TransportMode>("PACKET")
  const [processingToStore, setProcessingToStore] = useState<TransportMode>("PACKET")
  const [scanMode, setScanMode] = useState<ScanMode>("GENERATE_NEW")
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanSaving, setScanSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const j = await fetch(`/api/laundry/transport-settings?businessId=${businessId}`).then((r) => r.json())
      if (j.success) {
        setStoreToProcessing(j.data.storeToProcessingTransportMode || "PACKET")
        setProcessingToStore(j.data.processingToStoreTransportMode || "PACKET")
      }
      const s = await fetch(`/api/laundry/pickup-settings?businessId=${businessId}`).then((r) => r.json())
      if (s.success) setScanMode(s.data.processingPackageQrMode || "GENERATE_NEW")
    } catch { /* noop */ } finally { setConfigLoading(false) }
  }, [businessId])

  useEffect(() => { if (!loading) loadConfig() }, [loading, loadConfig])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/transport-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, storeToProcessingTransportMode: storeToProcessing, processingToStoreTransportMode: processingToStore }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      // Every transport screen reads the cached modes — drop them so the new
      // setting takes effect immediately, without a reload.
      invalidateTransportModes(businessId)
      toast.success("Transport settings saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const MODES: { value: TransportMode; label: string }[] = [
    { value: "PACKET", label: "Packet QR Only" },
    { value: "BAG", label: "Scan Bag Only" },
    { value: "BOTH", label: "Both" },
  ]

  const SCAN_MODES: { value: ScanMode; label: string }[] = [
    { value: "GENERATE_NEW", label: "Processing Packet QR" },
    { value: "REUSE_BAG", label: "Laundry Bag QR" },
    { value: "BOTH", label: "Laundry Bag or Processing Packet QR" },
  ]

  const saveScanMode = async () => {
    setScanSaving(true)
    try {
      const res = await fetch("/api/laundry/pickup-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, processingPackageQrMode: scanMode }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Finishing scan mode saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setScanSaving(false) }
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-400">Loading settings...</div>
  }

  const sections = [
    {
      key: "transportEnabled",
      title: "Transport Setup",
      icon: Truck,
      description: "Configure routes, vehicles, drivers, and transit settings for item transportation between stores and processing centers.",
      visible: isEnabled("transportEnabled"),
    },
    {
      key: "barcodeEnabled",
      title: "Barcode Setup",
      icon: Scan,
      description: "Configure barcode format, tag printing, and scanner preferences for item tracking.",
      visible: isEnabled("barcodeEnabled"),
    },
    {
      key: "ironingEnabled",
      title: "Ironing Setup",
      icon: Thermometer,
      description: "Configure ironing workflow, capacity, and quality standards.",
      visible: isEnabled("ironingEnabled"),
    },
    {
      key: "homeDeliveryEnabled",
      title: "Delivery Setup",
      icon: Home,
      description: "Configure delivery zones, delivery staff, and service level agreements.",
      visible: isEnabled("homeDeliveryEnabled"),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure operational settings for your laundry business. Feature availability depends on your plan.
        </p>
      </div>

      <LaundryStorageWidget businessId={businessId} />

      <LaundryFinancialSettingsForm businessId={businessId} />

      {/* Business identity first — it is what every other surface renders. */}
      <LaundryBrandingSettings businessId={businessId} />

      <LaundryCustomerSourcesForm businessId={businessId} />

      <LaundryAvailabilitySettingsForm businessId={businessId} />

      <LaundrySlotSettingsForm businessId={businessId} />

      <ScanModeCard
        scanMode={scanMode}
        onScanModeChange={setScanMode}
        loading={configLoading}
        saving={scanSaving}
        onSave={saveScanMode}
        modes={SCAN_MODES}
      />

      <LaundryVerificationSettingsForm businessId={businessId} />

      <LaundryPaymentSettingsForm businessId={businessId} />

      <LaundryPaymentProvidersForm businessId={businessId} />

      <LaundryPrinterSettingsForm businessId={businessId} />

      <TransportModeCard
        storeToProcessing={storeToProcessing}
        processingToStore={processingToStore}
        onStoreToProcessingChange={setStoreToProcessing}
        onProcessingToStoreChange={setProcessingToStore}
        loading={configLoading}
        saving={saving}
        onSave={saveConfig}
        modes={MODES}
      />

      <div className="grid gap-4">
        {sections
          .filter(s => s.visible)
          .map(s => {
            const Icon = s.icon
            if (s.key === "transportEnabled") return null
            return (
              <Card key={s.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px]">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">
                    Configuration options will be available in a future update.
                  </p>
                </CardContent>
              </Card>
            )
          })}

        {sections.filter(s => !s.visible).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" />
                Additional Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sections.filter(s => !s.visible).map(s => {
                  const Icon = s.icon
                  return (
                    <div key={s.key} className="flex items-center gap-3 rounded-lg border p-3 opacity-50">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">Contact your platform administrator to enable this feature.</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function RadioGroup<T extends string>({ name, value, onChange, modes }: { name: string; value: T; onChange: (v: T) => void; modes: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-4">
      {modes.map((m) => (
        <label key={m.value} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${value === m.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          <input type="radio" name={name} value={m.value} checked={value === m.value} onChange={() => onChange(m.value)} className="accent-blue-600" />
          {m.label}
        </label>
      ))}
    </div>
  )
}

function ScanModeCard({
  scanMode, onScanModeChange, loading, saving, onSave, modes,
}: {
  scanMode: ScanMode; onScanModeChange: (v: ScanMode) => void
  loading: boolean; saving: boolean; onSave: () => void
  modes: { value: ScanMode; label: string }[]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Scan className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">Finishing Scan Mode</CardTitle>
            <p className="text-xs text-muted-foreground">Choose which QR the finishing stations (Ironing, Folding) scan after garments pass Quality Check.</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">Active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…</div>
        ) : (
          <div className="space-y-4">
            <RadioGroup name="finishing-scan-mode" value={scanMode} onChange={onScanModeChange} modes={modes} />
            <Button onClick={onSave} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Scan Mode
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TransportModeCard({
  storeToProcessing, processingToStore, onStoreToProcessingChange, onProcessingToStoreChange,
  loading, saving, onSave, modes,
}: {
  storeToProcessing: TransportMode; processingToStore: TransportMode
  onStoreToProcessingChange: (v: TransportMode) => void; onProcessingToStoreChange: (v: TransportMode) => void
  loading: boolean; saving: boolean; onSave: () => void
  modes: { value: TransportMode; label: string }[]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">Transport Setup</CardTitle>
            <p className="text-xs text-muted-foreground">Configure how items are identified during transit between stores and processing centers.</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">Active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…</div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Store → Processing Center Transport</p>
              <RadioGroup name="store-to-processing" value={storeToProcessing} onChange={onStoreToProcessingChange} modes={modes} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Processing Center → Store Transport</p>
              <RadioGroup name="processing-to-store" value={processingToStore} onChange={onProcessingToStoreChange} modes={modes} />
            </div>
            <Button onClick={onSave} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Transport Settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
