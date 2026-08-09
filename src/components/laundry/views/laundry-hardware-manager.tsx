"use client"

// Hardware Manager — the one place a technician can see and prove the hardware
// attached to this terminal.
//
// Everything here reads the shared Hardware layer (ScanEngine / PrintEngine /
// registry). It configures; it never owns. A workflow keeps working exactly the
// same whether or not anyone ever opens this screen.
//
// Two honest limits are stated on the page itself rather than hidden, because
// discovering them at 7am at a counter is worse than reading them here:
//   • Browsers cannot enumerate hardware. Only devices the operator has paired
//     through a picker are visible, and only in Chromium over HTTPS.
//   • Printing goes through the browser's print path. Selecting a default
//     records the choice and attributes diagnostics; it is not a driver.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Usb, Printer, ScanLine, Camera, RefreshCw, Wifi, WifiOff, CheckCircle2,
  AlertTriangle, Bluetooth, Plug, Loader2, Trash2,
} from "lucide-react"
import {
  ScanEngine, PrintEngine, diagnostics, probeCapabilities, capabilityLabel, isSecureContext,
  discoverDevices, deviceSummary, watchDeviceChanges,
  requestUsbDevice, requestHidDevice, requestSerialPort,
  loadProfile, setRole, PRINTER_ROLES, UNKNOWN_PRINTER_NAME, BROWSER_PRINT_ID,
  testLabelHtml, alignmentTestHtml, qrTestHtml, barcodeTestHtml, sampleInvoiceHtml, sampleReceiptHtml,
} from "@/lib/hardware"
import type { HardwareDevice, PrinterRole, DiagnosticsSnapshot, DeviceProfile, QueuedJob } from "@/lib/hardware"

const KIND_ICON: Record<string, typeof Usb> = {
  BARCODE_SCANNER: ScanLine, LABEL_PRINTER: Printer, DOCUMENT_PRINTER: Printer,
  RECEIPT_PRINTER: Printer, CAMERA: Camera, WEIGHT_SCALE: Plug, RFID_READER: Plug,
}

const CONNECTION_ICON: Record<string, typeof Usb> = {
  USB: Usb, BLUETOOTH: Bluetooth, NETWORK: Wifi, SERIAL: Plug, BROWSER: Printer, CAMERA: Camera, UNKNOWN: Plug,
}

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN") : "—")

export function LaundryHardwareManager() {
  const { currentBusinessId } = useAuthStore()
  const caps = useMemo(() => probeCapabilities(), [])
  const secure = useMemo(() => isSecureContext(), [])

  const [devices, setDevices] = useState<HardwareDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [diag, setDiag] = useState<DiagnosticsSnapshot>(() => diagnostics.snapshot())
  const [profile, setProfile] = useState<DeviceProfile>(() => loadProfile(currentBusinessId ?? null))
  const [queue, setQueue] = useState<QueuedJob[]>([])
  const [printerOnline, setPrinterOnline] = useState(true)
  const [scanStatus, setScanStatus] = useState(ScanEngine.status())
  const [testingScan, setTestingScan] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setDevices(await discoverDevices()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => watchDeviceChanges(() => { refresh() }), [refresh])
  useEffect(() => diagnostics.subscribe(setDiag), [])
  useEffect(() => { ScanEngine.start(); setScanStatus(ScanEngine.status()); return ScanEngine.subscribe(setScanStatus) }, [])
  useEffect(() => {
    PrintEngine.setStore(currentBusinessId ?? null)
    const sync = () => { setQueue(PrintEngine.pending()); setPrinterOnline(PrintEngine.status() === "ONLINE") }
    sync()
    return PrintEngine.subscribe(sync)
  }, [currentBusinessId])

  // A paired Bluetooth scanner is the only way to know a wedge is Bluetooth —
  // keystrokes alone cannot tell the two apart.
  useEffect(() => {
    const bt = devices.find((d) => d.kind === "BARCODE_SCANNER" && d.connection === "BLUETOOTH")
    const usb = devices.find((d) => d.kind === "BARCODE_SCANNER")
    ScanEngine.setKnownScannerConnection(bt ? "BLUETOOTH" : usb ? "USB" : null)
  }, [devices])

  const printers = devices.filter((d) => d.kind.endsWith("PRINTER"))
  const scanners = devices.filter((d) => d.kind === "BARCODE_SCANNER")
  const cameras = devices.filter((d) => d.kind === "CAMERA")

  const bindRole = (role: PrinterRole, deviceId: string) => {
    setProfile(setRole(currentBusinessId ?? null, role, deviceId || null))
    toast.success("Default printer saved for this terminal")
  }

  const runPrint = async (label: string, html: string | Promise<string>, role: PrinterRole, isLabel: boolean) => {
    setBusy(label)
    try {
      const ok = await PrintEngine.print({ role, html: await html, title: label, isLabel })
      toast[ok ? "success" : "warning"](ok ? `${label} sent to the printer` : `${label} queued — printer is offline`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed")
    } finally { setBusy(null) }
  }

  const testScanner = async () => {
    setTestingScan(true)
    toast.info("Scan anything now — waiting up to 30 seconds")
    const e = await ScanEngine.scanOnce(30000)
    setTestingScan(false)
    if (e) toast.success(`Read "${e.code}" via ${e.source.replace(/_/g, " ").toLowerCase()}`)
    else toast.error("No scan detected. Check the scanner, or use the camera.")
  }

  const pair = async (fn: () => Promise<HardwareDevice | null>, what: string) => {
    const d = await fn()
    if (!d) { toast.info(`No ${what} was selected`); return }
    toast.success(`Paired ${d.name}`)
    refresh()
  }

  const statusChip = scanStatus === "SCANNER_READY"
    ? { dot: "bg-emerald-500", text: "Scanner Ready", cls: "border-emerald-300 text-emerald-700 bg-emerald-50" }
    : scanStatus === "CAMERA_READY"
      ? { dot: "bg-amber-400", text: "Camera Ready", cls: "border-amber-300 text-amber-700 bg-amber-50" }
      : { dot: "bg-rose-500", text: "Manual Entry", cls: "border-rose-300 text-rose-700 bg-rose-50" }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Usb className="h-5 w-5 text-blue-600" /> Hardware Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Scanners and printers attached to this terminal · {capabilityLabel(caps)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusChip.cls}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${statusChip.dot}`} />{statusChip.text}
          </Badge>
          <Badge variant="outline" className={printerOnline ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}>
            {printerOnline ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
            Printer {printerOnline ? "Online" : "Offline"}
          </Badge>
          <Button size="sm" variant="outline" className="gap-1" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
        </div>
      </div>

      {!secure && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>This page is not on a secure origin, so the browser blocks every device API. Scanning and printing still work; device details will not appear until the site is served over HTTPS.</span>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        Browsers do not allow a page to list attached hardware. Only devices paired through the buttons below appear here, and the
        device APIs exist in Chromium-based browsers only. Printing always falls back to the browser&apos;s print dialog, so a device
        that cannot be identified still prints — it simply shows as &ldquo;{UNKNOWN_PRINTER_NAME}&rdquo;.
      </div>

      {/* ── Default printers ───────────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
            <Printer className="h-[18px] w-[18px] text-blue-600" /> Default Printers
            <span className="text-[11px] font-normal text-slate-400">saved for this terminal{profile.updatedAt ? ` · ${when(profile.updatedAt)}` : ""}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {PRINTER_ROLES.map(({ role, label }) => (
            <div key={role} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-44 shrink-0">{label}</span>
              <select
                value={profile.printers[role] || BROWSER_PRINT_ID}
                onChange={(e) => bindRole(role, e.target.value)}
                className="h-8 flex-1 text-xs rounded border border-slate-200 px-2 bg-white">
                {printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ))}
          <p className="sm:col-span-2 text-[11px] text-slate-400">
            Every print action uses these automatically. A one-time override is still available at the point of printing.
          </p>
        </CardContent>
      </Card>

      {/* ── Devices ────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
            <Plug className="h-[18px] w-[18px] text-indigo-600" /> Connected Devices
            <Badge variant="outline" className="border-slate-300 text-slate-600">{devices.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {caps.webUsb && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestUsbDevice, "USB device")}><Usb className="h-3 w-3" /> Pair USB</Button>}
            {caps.webHid && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestHidDevice, "HID device")}><ScanLine className="h-3 w-3" /> Pair HID</Button>}
            {caps.webSerial && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestSerialPort, "serial port")}><Plug className="h-3 w-3" /> Pair Serial</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {devices.map((d) => {
            const Icon = KIND_ICON[d.kind] || Plug
            const Conn = CONNECTION_ICON[d.connection] || Plug
            return (
              <div key={d.id} className="rounded-lg border border-slate-200 p-3 flex items-start gap-3">
                <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{deviceSummary(d)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Conn className="h-3 w-3" /> {d.connection} · {d.source} · {d.kind.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />{d.status === "ONLINE" ? "Connected · Ready" : d.status}
                </Badge>
              </div>
            )
          })}
          {!loading && devices.length <= 1 && (
            <p className="text-xs text-slate-400 py-2">Only browser printing is available. Pair a device above to see its details.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* ── Scanner diagnostics ─────────────────────────────────────── */}
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
              <ScanLine className="h-[18px] w-[18px] text-blue-600" /> Scanner Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Row k="Status" v={statusChip.text} />
            <Row k="Scanner connected" v={scanners.length ? `${scanners.length} paired` : scanStatus === "SCANNER_READY" ? "Yes — keyboard emulation" : "Not detected"} />
            <Row k="Input method" v={diag.scanner.lastSource ? diag.scanner.lastSource.replace(/_/g, " ").toLowerCase() : "—"} />
            <Row k="Camera available" v={cameras.length ? `${cameras.length} camera(s)` : caps.camera ? "Yes" : "No"} />
            <Row k="Last barcode" v={diag.scanner.lastBarcode || "—"} mono />
            <Row k="Last scan" v={when(diag.scanner.lastScanAt)} />
            <Row k="Average scan time" v={diag.scanner.averageScanMs != null ? `${diag.scanner.averageScanMs} ms` : "—"} />
            <Row k="Total scans today" v={String(diag.scanner.totalScansToday)} />
            <div className="pt-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={testScanner} disabled={testingScan}>
                {testingScan ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />} Test Scanner
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              A USB and a Bluetooth scanner both arrive as keystrokes, so the two are reported the same unless a Bluetooth scanner has been paired above.
            </p>
          </CardContent>
        </Card>

        {/* ── Printer diagnostics ─────────────────────────────────────── */}
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
              <Printer className="h-[18px] w-[18px] text-emerald-600" /> Printer Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Row k="Status" v={printerOnline ? "Online" : "Offline — jobs are being held"} />
            <Row k="Label size" v={profile.labelSize || "60 mm × 40 mm (garment label)"} />
            <Row k="Labels printed today" v={String(diag.printer.labelsPrintedToday)} />
            <Row k="Documents printed today" v={String(diag.printer.documentsPrintedToday)} />
            <Row k="Last print" v={when(diag.printer.lastPrintAt)} />
            <Row k="Last error" v={diag.printer.lastError ? `${diag.printer.lastError} (${when(diag.printer.lastErrorAt)})` : "None"} />
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Test Label", testLabelHtml(), "BARCODE", true)}>Print Test Label</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Alignment Test", alignmentTestHtml(), "BARCODE", true)}>Alignment Test</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("QR Test", qrTestHtml(), "QR", true)}>QR Test</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Barcode Test", barcodeTestHtml(), "BARCODE", true)}>Barcode Test</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Sample Invoice", sampleInvoiceHtml(), "INVOICE", false)}>Sample Invoice</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Sample Receipt", sampleReceiptHtml(), "RECEIPT", false)}>Sample Receipt</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Queue / auto recovery ──────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
            {printerOnline ? <Wifi className="h-[18px] w-[18px] text-emerald-600" /> : <WifiOff className="h-[18px] w-[18px] text-rose-600" />}
            Print Queue
            <Badge variant="outline" className="border-slate-300 text-slate-600">{queue.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-slate-500">
            A job submitted while the printer is offline is held rather than dropped — a lost label is a garment nobody can find later.
            Bringing the printer back online resumes them oldest first.
          </p>
          {queue.map((j) => (
            <div key={j.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs">
              <span className="font-medium text-slate-700">{j.title || j.role}</span>
              <span className="text-slate-400">{when(j.queuedAt)}</span>
              <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-slate-400" onClick={() => PrintEngine.discard(j.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {printerOnline
              ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => PrintEngine.setOffline("Marked offline by administrator")}>Simulate Printer Offline</Button>
              : <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { const n = await PrintEngine.setOnline(); toast.success(n ? `Printer online — resumed ${n} job(s)` : "Printer online") }}>Printer Online · Resume Pending</Button>}
            {queue.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-[11px] text-slate-500" onClick={() => PrintEngine.clearQueue()}>Clear queue</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-400 w-44 shrink-0">{k}</span>
      <span className={`text-slate-700 truncate ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  )
}
