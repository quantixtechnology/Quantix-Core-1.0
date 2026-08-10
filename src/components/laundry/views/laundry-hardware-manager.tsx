"use client"

// Hardware Manager — the single place an owner or technician can see, prove and
// configure the hardware attached to a terminal.
//
// Everything here reads the shared Hardware layer (ScanEngine / PrintEngine /
// registry / event log). It configures; it never owns. Workflows keep working
// identically whether or not anyone ever opens this screen.
//
// Two limits are stated on the page rather than buried, because discovering
// them at a counter at 7am is worse than reading them here:
//   • Browsers cannot enumerate hardware. Only devices paired through a picker
//     are visible, in Chromium, over HTTPS. An empty list is normal.
//   • Printing goes through the browser's print path. Choosing a default
//     records the choice and attributes diagnostics; it is not a driver.
// docs/HARDWARE_MANAGER.md carries the long-form version for support.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Usb, Printer, ScanLine, Camera, RefreshCw, Wifi, WifiOff, CheckCircle2, XCircle,
  AlertTriangle, Bluetooth, Plug, Loader2, Search, Download, Radar, ListChecks, Gauge, Settings,
} from "lucide-react"
import {
  ScanEngine, PrintEngine, diagnostics, eventLog, hardwareHealth,
  probeCapabilities, capabilityLabel, isSecureContext, CAPABILITY_NOTES,
  discoverDevices, deviceSummary, watchDeviceChanges,
  requestUsbDevice, requestHidDevice, requestSerialPort,
  loadProfile, setRole, setScannerPreferences, PRINTER_ROLES, UNKNOWN_PRINTER_NAME, BROWSER_PRINT_ID,
  probeCamera, testCamera, EMPTY_CAMERA,
  testLabelHtml, alignmentTestHtml, qrTestHtml, barcodeTestHtml, sampleInvoiceHtml, sampleReceiptHtml,
} from "@/lib/hardware"
import type {
  HardwareDevice, PrinterRole, DiagnosticsSnapshot, DeviceProfile, TrackedJob,
  HardwareEvent, HardwareEventLevel, CameraInfo, BrowserCapabilities,
} from "@/lib/hardware"

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "scanner", label: "Scanner", icon: ScanLine },
  { key: "printer", label: "Printer", icon: Printer },
  { key: "camera", label: "Camera", icon: Camera },
  { key: "discovery", label: "Discovery", icon: Radar },
  { key: "preferences", label: "Preferences", icon: Settings },
  { key: "queue", label: "Print Queue", icon: ListChecks },
  { key: "log", label: "Event Log", icon: ListChecks },
] as const
type TabKey = (typeof TABS)[number]["key"]

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN") : "—")
const time = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN") : "—")

export function LaundryHardwareManager() {
  const { currentBusinessId } = useAuthStore()
  const caps = useMemo<BrowserCapabilities>(() => probeCapabilities(), [])
  const secure = useMemo(() => isSecureContext(), [])

  const [tab, setTab] = useState<TabKey>("dashboard")
  const [devices, setDevices] = useState<HardwareDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [diag, setDiag] = useState<DiagnosticsSnapshot>(() => diagnostics.snapshot())
  const [profile, setProfile] = useState<DeviceProfile>(() => loadProfile(currentBusinessId ?? null))
  const [jobs, setJobs] = useState<TrackedJob[]>([])
  const [printerOnline, setPrinterOnline] = useState(true)
  const [scanStatus, setScanStatus] = useState(ScanEngine.status())
  const [events, setEvents] = useState<HardwareEvent[]>([])
  const [camera, setCamera] = useState<CameraInfo>(EMPTY_CAMERA)
  const [testingScan, setTestingScan] = useState(false)
  const [testingCam, setTestingCam] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [logQuery, setLogQuery] = useState("")
  const [logLevel, setLogLevel] = useState<HardwareEventLevel | "ALL">("ALL")

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setDevices(await discoverDevices()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh(); probeCamera().then(setCamera) }, [refresh])
  useEffect(() => watchDeviceChanges(() => refresh()), [refresh])
  useEffect(() => { setDiag(diagnostics.snapshot()); return diagnostics.subscribe(setDiag) }, [])
  useEffect(() => { setEvents(eventLog.all()); return eventLog.subscribe(setEvents) }, [])
  useEffect(() => { ScanEngine.start(); setScanStatus(ScanEngine.status()); return ScanEngine.subscribe(setScanStatus) }, [])
  useEffect(() => {
    PrintEngine.setStore(currentBusinessId ?? null)
    const sync = () => { setJobs(PrintEngine.allJobs()); setPrinterOnline(PrintEngine.status() === "ONLINE") }
    sync()
    return PrintEngine.subscribe(sync)
  }, [currentBusinessId])

  // Preferences drive the ladder; push them into the engine whenever they change.
  useEffect(() => { ScanEngine.applyPreferences(profile.scanner) }, [profile.scanner])

  // A paired Bluetooth scanner is the only way to know a wedge is Bluetooth —
  // keystrokes alone cannot tell the two apart.
  useEffect(() => {
    const scanners = devices.filter((d) => d.kind === "BARCODE_SCANNER")
    const bt = scanners.find((d) => d.connection === "BLUETOOTH")
    ScanEngine.setKnownScannerConnection(bt ? "BLUETOOTH" : scanners.length ? "USB" : null)
  }, [devices])

  const health = useMemo(
    () => hardwareHealth(),
    // Recompute whenever anything it reads changes.
    [printerOnline, jobs, scanStatus, events],
  )

  const printers = devices.filter((d) => d.kind.endsWith("PRINTER"))
  const scanners = devices.filter((d) => d.kind === "BARCODE_SCANNER")
  const scanner = scanners[0] ?? null
  const barcodePrinter = printers.find((p) => p.id === profile.printers.BARCODE) ?? null

  const bindRole = (role: PrinterRole, deviceId: string) => {
    setProfile(setRole(currentBusinessId ?? null, role, deviceId || null))
    eventLog.record("PREFERENCE_CHANGED", `Default ${role.toLowerCase()} printer changed`)
    toast.success("Saved for this terminal")
  }

  const patchScanner = (patch: Parameters<typeof setScannerPreferences>[1]) => {
    setProfile(setScannerPreferences(currentBusinessId ?? null, patch))
    eventLog.record("PREFERENCE_CHANGED", "Scanner preferences changed", JSON.stringify(patch))
  }

  const runPrint = async (label: string, html: string | Promise<string>, role: PrinterRole, isLabel: boolean) => {
    setBusy(label)
    try {
      const ok = await PrintEngine.print({ role, html: await html, title: label, isLabel })
      toast[ok ? "success" : "warning"](ok ? `${label} sent` : `${label} queued — printer offline`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed")
    } finally { setBusy(null) }
  }

  const testScanner = async () => {
    setTestingScan(true)
    eventLog.record("TEST_RUN", "Scanner test started")
    toast.info("Scan anything now — waiting up to 30 seconds")
    const e = await ScanEngine.scanOnce(30000)
    setTestingScan(false)
    if (e) toast.success(`Read "${e.code}" via ${e.source.replace(/_/g, " ").toLowerCase()}`)
    else { eventLog.record("ERROR", "Scanner test timed out"); toast.error("No scan detected. Check the scanner, or use the camera.") }
  }

  const runCameraTest = async () => {
    setTestingCam(true)
    const info = await testCamera()
    setCamera(info)
    setTestingCam(false)
    toast[info.error ? "error" : "success"](info.error || `Camera OK${info.resolution ? ` — ${info.resolution}` : ""}`)
  }

  const bluetoothTest = async () => {
    const nav = navigator as Navigator & { bluetooth?: { requestDevice: (o: unknown) => Promise<{ name?: string }> } }
    if (!nav.bluetooth) { toast.error("This browser exposes no Bluetooth API"); return }
    try {
      const d = await nav.bluetooth.requestDevice({ acceptAllDevices: true })
      eventLog.record("DEVICE_PAIRED", `Bluetooth device selected: ${d?.name || "unnamed"}`)
      toast.success(`Bluetooth reachable — ${d?.name || "unnamed device"}`)
    } catch {
      toast.info("No Bluetooth device selected")
    }
  }

  /** Walks each transport in turn and narrates what it found. */
  const discover = async () => {
    setDiscovering(true)
    setDiscovery(["Searching…"])
    eventLog.record("DISCOVERY_RUN", "Hardware discovery started")
    const found = await discoverDevices()
    setDevices(found)
    const cam = await probeCamera()
    setCamera(cam)
    const lines: string[] = []
    const s = found.filter((d) => d.kind === "BARCODE_SCANNER")
    const p = found.filter((d) => d.kind.endsWith("PRINTER") && !d.isBrowserPrint)
    lines.push(s.length ? `Scanner found — ${s.map((d) => d.name).join(", ")}` : "No paired USB/HID scanner (a keyboard scanner still works without pairing)")
    lines.push(p.length ? `Printer found — ${p.map((d) => d.name).join(", ")}` : "No paired USB/serial printer — browser printing is available")
    lines.push(cam.count ? `Camera found — ${cam.count} device(s)` : "No camera detected")
    lines.push(caps.bluetooth ? "Bluetooth API available — use Bluetooth Test to pair" : "No Bluetooth devices (API unavailable in this browser)")
    lines.push("Browser print — always available")
    setDiscovery(lines)
    setDiscovering(false)
    eventLog.record("DEVICE_DISCOVERED", `Discovery complete — ${found.length} device(s)`)
  }

  const pair = async (fn: () => Promise<HardwareDevice | null>, what: string) => {
    const d = await fn()
    if (!d) { toast.info(`No ${what} was selected`); return }
    eventLog.record("DEVICE_PAIRED", `Paired ${d.name}`, deviceSummary(d))
    toast.success(`Paired ${d.name}`)
    refresh()
  }

  const exportLog = () => {
    const rows = eventLog.search(logQuery, logLevel)
    const blob = new Blob([eventLog.toCsv(rows)], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `quantix-hardware-events-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const healthChip = health.level === "VERIFIED"
    ? { dot: "bg-emerald-500", cls: "border-emerald-300 text-emerald-700 bg-emerald-50" }
    : health.level === "NOT_VERIFIED"
      ? { dot: "bg-slate-300", cls: "border-slate-200 text-slate-600 bg-slate-50" }
      : health.level === "ATTENTION"
        ? { dot: "bg-amber-400", cls: "border-amber-300 text-amber-700 bg-amber-50" }
        : { dot: "bg-rose-500", cls: "border-rose-300 text-rose-700 bg-rose-50" }

  const filteredEvents = eventLog.search(logQuery, logLevel)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Usb className="h-5 w-5 text-blue-600" /> Hardware Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">This terminal · {capabilityLabel(caps)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={healthChip.cls}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${healthChip.dot}`} />{health.label}
          </Badge>
          <Button size="sm" variant="outline" className="gap-1" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </Button>
        </div>
      </div>

      {!secure && (
        <Notice tone="warn">
          This page is not on a secure origin, so the browser blocks every device API. Scanning and printing still work; device
          details will not appear until the site is served over HTTPS.
        </Notice>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-8 text-xs font-medium rounded-t-md border-b-2 -mb-px flex items-center gap-1.5 ${tab === t.key ? "border-blue-600 text-blue-700 bg-blue-50/60" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {t.key === "queue" && health.queueLength > 0 && <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] border-amber-300 text-amber-700 bg-amber-50">{health.queueLength}</Badge>}
          </button>
        ))}
      </div>

      {/* ── Dashboard ─────────────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Proof, not capability. A keyboard-emulation scanner cannot be
                enumerated, so "verified" means it has actually typed. */}
            <Tile label="Barcode Scanner" ok={ScanEngine.everScanned()} warn={!ScanEngine.everScanned()}
              value={ScanEngine.everScanned() ? `Active · last ${time(diag.scanner.lastScanAt)}` : "Presence not verified"} icon={ScanLine} />
            <Tile label="Printer" ok={diag.printer.lastPrintAt !== null} warn={diag.printer.lastPrintAt === null}
              value={diag.printer.lastPrintAt ? `Printed ${time(diag.printer.lastPrintAt)}` : "Browser print available · physical printer not verified"} icon={Printer} />
            <Tile label="Camera" ok={camera.count > 0} warn={camera.permission !== "granted"}
              value={camera.count ? (camera.permission === "granted" ? "Ready" : "Needs permission") : "None"} icon={Camera} />
            <Tile label="Bluetooth" ok={devices.some((d) => d.connection === "BLUETOOTH")} warn={caps.bluetooth}
              value={devices.some((d) => d.connection === "BLUETOOTH") ? "Device paired" : caps.bluetooth ? "API supported · no device paired" : "API unavailable"} icon={Bluetooth} />
            <Tile label="USB" ok={devices.some((d) => d.connection === "USB")} warn={caps.webUsb}
              value={`${devices.filter((d) => d.connection === "USB").length} device(s) visible${caps.webUsb ? "" : " · API unavailable"}`} icon={Usb} />
            <Tile label="Network" ok={typeof navigator !== "undefined" ? navigator.onLine : true}
              value={typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"} icon={Wifi} />
            <Tile label="Print Queue" ok={health.queueLength === 0} value={`${health.queueLength} Pending`} icon={ListChecks} />
            <Tile label="Hardware Errors" ok={health.errorsToday === 0} value={String(health.errorsToday)} icon={AlertTriangle} />
          </div>

          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800">Last Hardware Event</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {events[0]
                ? <div><span className="font-medium text-slate-800">{events[0].message}</span><span className="text-slate-400 ml-2">{when(events[0].at)}</span></div>
                : <span className="text-slate-400">Nothing recorded yet on this terminal.</span>}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800">Browser Hardware Support</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {(Object.keys(CAPABILITY_NOTES) as (keyof BrowserCapabilities)[]).map((k) => (
                <div key={k} className="flex items-start gap-2 text-xs">
                  {caps[k] ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />}
                  <span className="w-32 shrink-0 font-medium text-slate-700">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
                  <span className="text-slate-500">{caps[k] ? "Supported" : "Not supported"} — {CAPABILITY_NOTES[k]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Scanner ───────────────────────────────────────────────────── */}
      {tab === "scanner" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><ScanLine className="h-[18px] w-[18px] text-blue-600" /> Scanner Status</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Row k="Status" v={scanStatus === "SCANNER_READY" ? "Connected" : scanStatus === "CAMERA_READY" ? "Camera fallback" : "Not detected"} />
            <Row k="Connection" v={scanner ? `${scanner.connection} ${scanner.source === "WEBHID" ? "HID" : ""}`.trim() : "Keyboard emulation (no pairing needed)"} />
            <Row k="Type" v="Keyboard Emulation" />
            <Row k="Manufacturer" v={scanner?.manufacturer || "Unknown"} />
            <Row k="Model" v={scanner?.model || "Unknown"} />
            <Row k="Vendor ID" v={scanner?.vendorId != null ? `0x${scanner.vendorId.toString(16).padStart(4, "0")}` : "Unknown"} mono />
            <Row k="Product ID" v={scanner?.productId != null ? `0x${scanner.productId.toString(16).padStart(4, "0")}` : "Unknown"} mono />
            <Row k="Input mode" v={profile.scanner.autoDetect ? "Automatic" : "Manual preference"} />
            <Row k="Last scan" v={when(diag.scanner.lastScanAt)} />
            <Row k="Last barcode" v={diag.scanner.lastBarcode || "—"} mono />
            <Row k="Average scan speed" v={diag.scanner.averageScanMs != null ? `${diag.scanner.averageScanMs} ms` : "—"} />
            <Row k="Today's scans" v={String(diag.scanner.totalScansToday)} />
            <div className="pt-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={testScanner} disabled={testingScan}>
                {testingScan ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />} Test Scanner
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => runPrint("Barcode Test", barcodeTestHtml(), "BARCODE", true)} disabled={!!busy}>Scan Test Barcode</Button>
            </div>
            <Notice tone="info">
              A USB and a Bluetooth scanner are indistinguishable to a browser — both simply type. The connection above reads
              &ldquo;Bluetooth&rdquo; only when a Bluetooth scanner has actually been paired; otherwise it reports keyboard emulation
              rather than guessing. Manufacturer and model appear only for a device paired through WebUSB or WebHID.
            </Notice>
          </CardContent>
        </Card>
      )}

      {/* ── Printer ───────────────────────────────────────────────────── */}
      {tab === "printer" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Printer className="h-[18px] w-[18px] text-emerald-600" /> Barcode Printer</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Row k="Status" v={printerOnline ? "Connected" : "Offline — jobs are being held"} />
            <Row k="Manufacturer" v={barcodePrinter?.manufacturer || "Unknown"} />
            <Row k="Model" v={barcodePrinter?.model || "Unknown"} />
            <Row k="Vendor ID" v={barcodePrinter?.vendorId != null ? `0x${barcodePrinter.vendorId.toString(16).padStart(4, "0")}` : "Unknown"} mono />
            <Row k="Product ID" v={barcodePrinter?.productId != null ? `0x${barcodePrinter.productId.toString(16).padStart(4, "0")}` : "Unknown"} mono />
            <Row k="Resolution" v={profile.printerDpi || "203 DPI (declared, not detected)"} />
            <Row k="Label width" v={profile.labelSize || "60 mm × 40 mm (garment label)"} />
            <Row k="Connection" v={barcodePrinter?.connection || "Browser"} />
            <Row k="Driver" v="Browser" />
            <Row k="Last print" v={when(diag.printer.lastPrintAt)} />
            <Row k="Average print time" v={diag.printer.averagePrintMs != null ? `${diag.printer.averagePrintMs} ms` : "—"} />
            <Row k="Labels printed today" v={String(diag.printer.labelsPrintedToday)} />
            <Row k="Documents printed today" v={String(diag.printer.documentsPrintedToday)} />
            <Row k="Last error" v={diag.printer.lastError ? `${diag.printer.lastError} (${when(diag.printer.lastErrorAt)})` : "None"} />
            <Row k="Last disconnect" v={when(diag.printer.lastDisconnectAt)} />
            <Row k="Default" v={profile.printers.BARCODE ? "Yes" : "Browser print"} />
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Test Label", testLabelHtml(), "BARCODE", true)}>Print Test Label</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Alignment Test", alignmentTestHtml(), "BARCODE", true)}>Alignment Test</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("QR Test", qrTestHtml(), "QR", true)}>Print QR</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Sample Invoice", sampleInvoiceHtml(), "INVOICE", false)}>Print Invoice</Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!!busy} onClick={() => runPrint("Sample Receipt", sampleReceiptHtml(), "RECEIPT", false)}>Print Receipt</Button>
            </div>
            <Notice tone="info">
              Printing uses the browser&apos;s print path, which produces exactly the output it always has. Resolution and label size
              are values you record here, not readings — a browser is never told a printer&apos;s DPI. Driving a TSC or Epson directly
              would need raw TSPL/ESC-POS byte streams, which this build does not do.
            </Notice>
          </CardContent>
        </Card>
      )}

      {/* ── Camera ────────────────────────────────────────────────────── */}
      {tab === "camera" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Camera className="h-[18px] w-[18px] text-indigo-600" /> Camera</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <Row k="Status" v={camera.count ? (camera.permission === "granted" ? "Ready" : "Detected — permission needed") : "None detected"} />
            <Row k="Permission" v={camera.permission} />
            <Row k="Cameras" v={String(camera.count)} />
            <Row k="Rear camera" v={camera.rearCameraDetected === null ? "Unknown until permission is granted" : camera.rearCameraDetected ? "Detected" : "Not detected"} />
            <Row k="Resolution" v={camera.resolution || "Unknown until the camera is opened"} />
            {camera.error && <Row k="Error" v={camera.error} />}
            <div className="pt-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={runCameraTest} disabled={testingCam}>
                {testingCam ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Test Camera
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={bluetoothTest}><Bluetooth className="h-3 w-3" /> Bluetooth Test</Button>
            </div>
            <Notice tone="info">
              Camera labels, facing mode and resolution are hidden until the operator grants access — that is a deliberate
              anti-fingerprinting rule in every browser, not a fault. Test Camera opens the stream briefly to read them, then stops it.
            </Notice>
          </CardContent>
        </Card>
      )}

      {/* ── Discovery ─────────────────────────────────────────────────── */}
      {tab === "discovery" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Radar className="h-[18px] w-[18px] text-indigo-600" /> Device Discovery</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={discover} disabled={discovering}>
                {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Discover Hardware
              </Button>
              {caps.webUsb && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestUsbDevice, "USB device")}><Usb className="h-3 w-3" /> Pair USB</Button>}
              {caps.webHid && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestHidDevice, "HID device")}><ScanLine className="h-3 w-3" /> Pair HID</Button>}
              {caps.webSerial && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestSerialPort, "serial port")}><Plug className="h-3 w-3" /> Pair Serial</Button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {discovery.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                {discovery.map((l, i) => <p key={i} className="text-xs text-slate-600">{l}</p>)}
              </div>
            )}
            {devices.map((d) => {
              const Icon = d.kind === "CAMERA" ? Camera : d.kind === "BARCODE_SCANNER" ? ScanLine : d.kind.endsWith("PRINTER") ? Printer : Plug
              return (
                <div key={d.id} className="rounded-lg border border-slate-200 p-3 flex items-start gap-3">
                  <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{deviceSummary(d)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.connection} · {d.source} · {d.kind.replace(/_/g, " ").toLowerCase()}</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] shrink-0">Connected · Ready</Badge>
                </div>
              )
            })}
            <Notice tone="info">
              Browsers do not allow a page to list attached hardware. Discovery reports devices already paired through a picker plus
              the browser print target; the pairing buttons are how new devices are added, and they exist in Chromium over HTTPS only.
              A device that cannot be identified still prints, as &ldquo;{UNKNOWN_PRINTER_NAME}&rdquo;.
            </Notice>
          </CardContent>
        </Card>
      )}

      {/* ── Preferences ───────────────────────────────────────────────── */}
      {tab === "preferences" && (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800">Scanner Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-blue-600" checked={profile.scanner.autoDetect} onChange={(e) => patchScanner({ autoDetect: e.target.checked })} />
                Auto detect scanner from typing speed
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-36 shrink-0">Preferred scanner</span>
                <select value={profile.scanner.preferredScannerId || ""} onChange={(e) => patchScanner({ preferredScannerId: e.target.value || null })}
                  className="h-8 flex-1 rounded border border-slate-200 px-2 bg-white">
                  <option value="">Auto</option>
                  {scanners.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-36 shrink-0">Fallback</span>
                <select value={profile.scanner.fallback} onChange={(e) => patchScanner({ fallback: e.target.value as "CAMERA" | "MANUAL" })}
                  className="h-8 flex-1 rounded border border-slate-200 px-2 bg-white">
                  <option value="CAMERA">Camera</option>
                  <option value="MANUAL">Manual entry</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-blue-600" checked={profile.scanner.manualEntryEnabled} onChange={(e) => patchScanner({ manualEntryEnabled: e.target.checked })} />
                Manual entry enabled
              </label>
              <p className="text-[10px] text-slate-400">Ladder: USB scanner → Bluetooth scanner → camera → manual entry. No screen ever asks the operator to choose.</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-[15px] font-semibold text-slate-800">Default Printers</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {PRINTER_ROLES.map(({ role, label }) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="text-slate-500 w-36 shrink-0">{label}</span>
                  <select value={profile.printers[role] || BROWSER_PRINT_ID} onChange={(e) => bindRole(role, e.target.value)}
                    className="h-8 flex-1 rounded border border-slate-200 px-2 bg-white">
                    {printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-36 shrink-0">Label size</span>
                <Input value={profile.labelSize || ""} placeholder="60 mm × 40 mm" className="h-8 text-xs"
                  onChange={(e) => setProfile({ ...profile, labelSize: e.target.value })}
                  onBlur={() => { setProfile(loadProfile(currentBusinessId ?? null)); }} />
              </div>
              <p className="text-[10px] text-slate-400">
                Saved per store on this terminal — a printer belongs to a counter, so Store 1 and Store 2 keep separate settings.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Print queue ───────────────────────────────────────────────── */}
      {tab === "queue" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
              {printerOnline ? <Wifi className="h-[18px] w-[18px] text-emerald-600" /> : <WifiOff className="h-[18px] w-[18px] text-rose-600" />} Print Queue
            </CardTitle>
            <div className="flex gap-1.5">
              {printerOnline
                ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => PrintEngine.setOffline("Marked offline by administrator")}>Simulate Offline</Button>
                : <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => { const n = await PrintEngine.setOnline(); toast.success(n ? `Resumed ${n} job(s)` : "Printer online") }}>Printer Online · Resume</Button>}
              <Button size="sm" variant="ghost" className="h-7 text-[11px] text-slate-500" onClick={() => PrintEngine.clearFinished()}>Clear finished</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-[11px] text-slate-500">A job submitted while the printer is offline is held, not dropped — a lost label is a garment nobody can find later.</p>
            {jobs.length === 0 && <p className="text-xs text-slate-400 py-2">No print jobs on this terminal yet.</p>}
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs">
                <StatusPill status={j.status} />
                <span className="font-medium text-slate-700 truncate">{j.title || j.role}</span>
                <span className="text-slate-400 shrink-0">{time(j.queuedAt)}</span>
                {j.durationMs != null && <span className="text-slate-400 shrink-0">{j.durationMs} ms</span>}
                {j.attempts > 1 && <span className="text-slate-400 shrink-0">×{j.attempts}</span>}
                {j.error && <span className="text-rose-600 truncate">{j.error}</span>}
                <div className="ml-auto flex gap-1 shrink-0">
                  {(j.status === "FAILED" || j.status === "CANCELLED") && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => PrintEngine.retry(j.id)}>Retry</Button>}
                  {(j.status === "PENDING" || j.status === "FAILED") && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-slate-400" onClick={() => PrintEngine.cancel(j.id)}>Cancel</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Event log ─────────────────────────────────────────────────── */}
      {tab === "log" && (
        <Card className="rounded-xl border-slate-200">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
            <CardTitle className="text-[15px] font-semibold text-slate-800">Hardware Event Log</CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Input value={logQuery} onChange={(e) => setLogQuery(e.target.value)} placeholder="Search events…" className="h-7 text-xs w-44" />
              <select value={logLevel} onChange={(e) => setLogLevel(e.target.value as HardwareEventLevel | "ALL")} className="h-7 text-xs rounded border border-slate-200 px-1 bg-white">
                <option value="ALL">All levels</option><option value="INFO">Info</option><option value="WARN">Warn</option><option value="ERROR">Error</option>
              </select>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={exportLog}><Download className="h-3 w-3" /> Export CSV</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] text-slate-500" onClick={() => eventLog.clear()}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {filteredEvents.length === 0 && <p className="text-xs text-slate-400 py-2">No matching events.</p>}
            {filteredEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-xs border-b border-slate-100 py-1">
                <span className="text-slate-400 w-36 shrink-0">{when(e.at)}</span>
                <Badge variant="outline" className={`text-[9px] h-4 px-1 shrink-0 ${e.level === "ERROR" ? "border-rose-300 text-rose-700 bg-rose-50" : e.level === "WARN" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-200 text-slate-500"}`}>{e.level}</Badge>
                <span className="text-slate-700">{e.message}</span>
                {e.detail && <span className="text-slate-400 truncate">{e.detail}</span>}
              </div>
            ))}
            <p className="text-[10px] text-slate-400 pt-2">Kept on this terminal only, newest 500 events. Nothing is sent to the server.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Tile({ label, value, ok, warn, icon: Icon }: { label: string; value: string; ok: boolean; warn?: boolean; icon: typeof Usb }) {
  const dot = ok ? "bg-emerald-500" : warn ? "bg-amber-400" : "bg-rose-500"
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-slate-800">{value}</span>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: TrackedJob["status"] }) {
  const cls = status === "COMPLETED" ? "border-emerald-300 text-emerald-700 bg-emerald-50"
    : status === "FAILED" ? "border-rose-300 text-rose-700 bg-rose-50"
      : status === "PRINTING" ? "border-blue-300 text-blue-700 bg-blue-50"
        : status === "CANCELLED" ? "border-slate-200 text-slate-500"
          : "border-amber-300 text-amber-700 bg-amber-50"
  return <Badge variant="outline" className={`text-[9px] h-4 px-1 shrink-0 ${cls}`}>{status}</Badge>
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-400 w-44 shrink-0">{k}</span>
      <span className={`text-slate-700 truncate ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  )
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"
  return <div className={`rounded-lg border px-3 py-2 text-[11px] ${cls}`}>{children}</div>
}
