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
  AlertTriangle, Bluetooth, Plug, Loader2, Search, Download, Radar, ListChecks, Gauge, Settings, MonitorCheck,
} from "lucide-react"
import {
  ScanEngine, PrintEngine, diagnostics, eventLog, hardwareHealth,
  scannerStatus, physicalConnection, scannerInputMode, NOT_EXPOSED, PHYSICAL_CONNECTION_NOTE,
  readTerminalFacts, deviceApiResult, scannerResult, RESULT_LABEL, RESULT_TONE,
  probeCapabilities, capabilityLabel, isSecureContext, CAPABILITY_NOTES,
  discoverDevices, deviceSummary, watchDeviceChanges,
  requestUsbDevice, requestHidDevice, requestSerialPort,
  loadProfile, setRole, setScannerPreferences, PRINTER_ROLES, UNKNOWN_PRINTER_NAME, BROWSER_PRINT_ID,
  probeCamera, testCamera, EMPTY_CAMERA,
  testLabelHtml, alignmentTestHtml, qrTestHtml, barcodeTestHtml, sampleInvoiceHtml, sampleReceiptHtml,
} from "@/lib/hardware"
import type {
  HardwareDevice, PrinterRole, DiagnosticsSnapshot, DeviceProfile, TrackedJob,
  TerminalFacts, HardwareResult, ScanEvent,
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
  const [lastTest, setLastTest] = useState<ScanEvent | null>(null)
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

  // Everything the log called an error today, including diagnostics and faults
  // a later success answered. Shown only as context under the active count.
  const historicalErrors = useMemo(() => eventLog.historicalErrorCount(), [events])

  const printers = devices.filter((d) => d.kind.endsWith("PRINTER"))
  const scanners = devices.filter((d) => d.kind === "BARCODE_SCANNER")
  const scanner = scanners[0] ?? null

  // ONE reading of the scanner's state, shared by the tile and the Scanner
  // page so the two can never disagree. `recentlyScanned` is the engine's own
  // window — no second timer, and no inference about the physical device.
  const scan = scannerStatus(
    { lastScanAt: diag.scanner.lastScanAt, recentlyScanned: ScanEngine.scannerPresent() },
    time,
  )
  // Devices the operator has actually granted, through any device API. This is
  // never "everything plugged into the computer" — the browser does not offer
  // that, and the UI says so where it is listed.
  const permitted = devices.filter((d) => d.source === "WEBHID" || d.source === "WEBUSB" || d.source === "WEBSERIAL" || d.source === "BLUETOOTH")
  const physical = physicalConnection(scanner, { apiSupported: caps.webHid || caps.webUsb, anyGranted: permitted.length > 0 })
  const inputMode = scannerInputMode(scanner, ScanEngine.everScanned())
  // Facts the browser reports about itself. Read on mount so the server render
  // and the first client render agree.
  const [terminal, setTerminal] = useState<TerminalFacts>({ standalone: false, displayMode: "browser", browser: "Browser", secure: false, serviceWorker: false })
  useEffect(() => {
    const sync = () => setTerminal(readTerminalFacts())
    sync()
    const mq = window.matchMedia("(display-mode: standalone)")
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  // Pairing is a browser capability, never a permission. Every role sees the
  // same buttons in the same browser, and none of them in a browser without
  // the APIs — which is why this has to be stated rather than left blank.
  const canPair = caps.webUsb || caps.webHid || caps.webSerial
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
    setLastTest(null)
    eventLog.record("TEST_RUN", "Scanner test started")
    toast.info("Scan anything now — waiting up to 30 seconds")
    const e = await ScanEngine.scanOnce(30000)
    setTestingScan(false)
    setLastTest(e)
    if (e) toast.success(`Read "${e.code}" via ${e.source.replace(/_/g, " ").toLowerCase()}`)
    // TEST_FAILED, not ERROR: the operator declining to scan within the test
    // window is not a hardware fault, and must not count against health.
    else { eventLog.record("TEST_FAILED", "Scanner test timed out", "Diagnostic only — no scan presented during the test window"); toast.error("No scan detected. Check the scanner, or use the camera.") }
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
            {/* Proof, not capability, and proof of the PAST — a scan shows a
                scanner was here, never that one is plugged in now. This tile
                said "Active" off that evidence and went on saying it with the
                scanner unplugged. */}
            <Tile label="Barcode Scanner" ok={scan.verified} warn={!scan.verified}
              value={scan.tile} note={scan.tileNote} icon={ScanLine} />
            <Tile label="Printer" ok={diag.printer.lastPrintAt !== null} warn={diag.printer.lastPrintAt === null}
              value={diag.printer.lastPrintAt ? `Printed ${time(diag.printer.lastPrintAt)}` : "Browser print available · physical printer not verified"} icon={Printer} />
            <Tile label="Camera" ok={camera.count > 0} warn={camera.permission !== "granted"}
              value={camera.count ? (camera.permission === "granted" ? "Ready" : "Needs permission") : "None"} icon={Camera} />
            <Tile label="Bluetooth" ok={devices.some((d) => d.connection === "BLUETOOTH")} warn={caps.bluetooth}
              value={devices.some((d) => d.connection === "BLUETOOTH") ? "Device paired" : caps.bluetooth ? "API supported · no device paired" : "API unavailable"} icon={Bluetooth} />
            {/* WebUSB cannot see a keyboard-emulation scanner — the OS claims
                it as a keyboard, so zero here is normal and expected even with
                a scanner plugged in and working. Report the real count, then
                say plainly what it does not mean. */}
            <Tile label="USB" ok={devices.some((d) => d.connection === "USB") || ScanEngine.everScanned()} warn={caps.webUsb}
              value={`${devices.filter((d) => d.connection === "USB").length} browser-visible device${devices.filter((d) => d.connection === "USB").length === 1 ? "" : "s"}${caps.webUsb ? "" : " · API unavailable"}`}
              note={ScanEngine.everScanned()
                ? "Keyboard/HID scanner verified — not enumerable via WebUSB"
                : "Keyboard/HID scanners are never listed here"}
              icon={Usb} />
            <Tile label="Network" ok={typeof navigator !== "undefined" ? navigator.onLine : true}
              value={typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"} icon={Wifi} />
            <Tile label="Print Queue" ok={health.queueLength === 0} value={`${health.queueLength} Pending`} icon={ListChecks} />
            {/* Active faults only. Diagnostics the operator ran by hand, and
                complaints a later success already answered, belong in the log
                rather than in a red tile over working hardware. */}
            <Tile label="Hardware Errors" ok={health.errorsToday === 0} value={String(health.errorsToday)}
              note={historicalErrors > health.errorsToday
                ? `${historicalErrors - health.errorsToday} earlier/diagnostic event${historicalErrors - health.errorsToday === 1 ? "" : "s"} today — see Event Log`
                : undefined}
              icon={AlertTriangle} />
          </div>


          {/* ── This terminal ──────────────────────────────────────────
              Before anything about hardware: is this the right application,
              in its own window, over HTTPS? Facts the browser reports about
              itself — no token, no session, no tenant, no server call. */}
          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><MonitorCheck className="h-[18px] w-[18px] text-blue-600" /> Laundry OS Terminal</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <Row k="Application" v="Laundry OS" />
              <Row k="Installation" v={terminal.standalone ? "Installed — running as an app" : "Running in a browser tab"} />
              <Row k="Display mode" v={terminal.displayMode} />
              <Row k="Browser" v={terminal.browser} />
              <Row k="Secure (HTTPS)" v={terminal.secure ? "Secure" : "Not secure — device APIs stay unavailable"} />
              <Row k="Service worker" v={terminal.serviceWorker ? "Active" : "Not controlling this page"} />
            </CardContent>
          </Card>

          {/* ── Connected hardware ─────────────────────────────────────
              Only what the browser can actually name. A browser cannot list
              arbitrary USB devices — that is a security boundary, not a
              fault — so this is "what Laundry OS has been granted", never
              "what is plugged into this computer". The scanner sits at the
              top because it is the one device proved by USE rather than by
              enumeration. */}
          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[15px] font-semibold text-slate-800">Connected Hardware</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setTab("discovery")}>
                <Radar className="h-3 w-3" /> Scan for Hardware
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {["Device", "Type", "Connection", "Status", "Manufacturer", "Model", "Product ID", "Last used", ""].map((h) => (
                        <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* The barcode scanner, on its own terms. */}
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">Barcode Scanner</td>
                      <td className="px-3 py-2 text-slate-500">Keyboard Emulation</td>
                      <td className="px-3 py-2 text-slate-500">Keyboard</td>
                      <td className="px-3 py-2"><ResultChip r={scannerResult(ScanEngine.everScanned())} labelOverride={scan.verified ? "Verified" : "Not verified"} /></td>
                      <td className="px-3 py-2 text-slate-400">—</td>
                      <td className="px-3 py-2 text-slate-400">—</td>
                      <td className="px-3 py-2 text-slate-400">—</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{diag.scanner.lastScanAt ? time(diag.scanner.lastScanAt) : "—"}</td>
                      <td className="px-3 py-2"><button onClick={() => setTab("scanner")} className="text-blue-600 hover:underline">View Scanner</button></td>
                    </tr>
                    {devices.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium text-slate-800">{d.name}</td>
                        <td className="px-3 py-2 text-slate-500">{d.kind.replace(/_/g, " ").toLowerCase()}</td>
                        <td className="px-3 py-2 text-slate-500">{d.connection}</td>
                        <td className="px-3 py-2"><ResultChip r={d.status === "ONLINE" ? "PASS" : "NOT_DETECTABLE"} labelOverride={d.status === "ONLINE" ? "Connected" : "Not reporting"} /></td>
                        <td className="px-3 py-2 text-slate-500">{d.manufacturer || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{d.model || d.product || "—"}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{d.productId != null ? `0x${d.productId.toString(16).padStart(4, "0")}` : "—"}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{d.lastSeenAt ? time(d.lastSeenAt) : "—"}</td>
                        <td className="px-3 py-2"><button onClick={() => setTab(d.kind === "CAMERA" ? "camera" : "printer")} className="text-blue-600 hover:underline">Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-3 py-2 text-[11px] leading-snug text-slate-400 border-t border-slate-100">
                This lists hardware the browser can name: the print target, and any USB, HID or serial device you have granted
                through its chooser. A browser is not allowed to enumerate everything plugged into the computer, so an absent
                device is not a disconnected one. A keyboard-emulation barcode scanner never appears in those lists at all — its
                row above is proved by a real scan reaching Laundry OS.
              </p>
            </CardContent>
          </Card>

          {/* ── Hardware test ──────────────────────────────────────────
              Five answers, because "failed" and "cannot be seen from here"
              are not the same thing and collapsing them reports working
              hardware as broken. */}
          <Card className="rounded-xl border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800">Hardware Test</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <TestRow name="Barcode scanner" r={scannerResult(ScanEngine.everScanned())}
                detail={ScanEngine.everScanned() ? `Last barcode ${diag.scanner.lastBarcode || "—"} at ${time(diag.scanner.lastScanAt)}` : "Scan any barcode on this terminal to prove it"}
                action={<Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={testScanner} disabled={testingScan}>{testingScan ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />} Test</Button>} />
              <TestRow name="Printer" r={diag.printer.lastPrintAt ? "PASS" : "NOT_DETECTABLE"}
                detail={diag.printer.lastPrintAt ? `Last print ${time(diag.printer.lastPrintAt)}` : "Browser printing is always available; a physical printer is proved by printing"}
                action={<Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => runPrint("Hardware Test", barcodeTestHtml(), "BARCODE", true)} disabled={!!busy}>Test</Button>} />
              <TestRow name="Camera" r={!caps.camera ? "NOT_AVAILABLE" : camera.permission === "granted" ? "PASS" : camera.count ? "PERMISSION_REQUIRED" : "NOT_DETECTABLE"}
                detail={camera.count ? `${camera.count} camera${camera.count === 1 ? "" : "s"} visible` : "No camera reported by this browser"}
                action={<Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setTab("camera")}>Open</Button>} />
              <TestRow name="WebUSB" r={deviceApiResult(caps.webUsb, devices.filter((d) => d.source === "WEBUSB").length)}
                detail={caps.webUsb ? "Only devices you have granted appear" : "This browser does not implement WebUSB"}
                action={caps.webUsb ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => pair(requestUsbDevice, "USB device")}>Connect</Button> : undefined} />
              <TestRow name="WebHID" r={deviceApiResult(caps.webHid, devices.filter((d) => d.source === "WEBHID").length)}
                detail={caps.webHid ? "Only devices you have granted appear" : "This browser does not implement WebHID"}
                action={caps.webHid ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => pair(requestHidDevice, "HID device")}>Connect</Button> : undefined} />
              <TestRow name="Web Serial" r={deviceApiResult(caps.webSerial, devices.filter((d) => d.source === "WEBSERIAL").length)}
                detail={caps.webSerial ? "Only ports you have granted appear" : "This browser does not implement Web Serial"}
                action={caps.webSerial ? <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => pair(requestSerialPort, "serial port")}>Connect</Button> : undefined} />
              <TestRow name="Bluetooth" r={devices.some((d) => d.connection === "BLUETOOTH") ? "PASS" : caps.bluetooth ? "PERMISSION_REQUIRED" : "NOT_AVAILABLE"}
                detail={devices.some((d) => d.connection === "BLUETOOTH") ? "A Bluetooth device is paired" : caps.bluetooth ? "Supported — no browser-visible device paired" : "This browser does not implement Web Bluetooth"} />
            </CardContent>
          </Card>

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
            {/* Two different questions, previously answered by one row.
                "Has a scanner proven itself here?" is settled by a real read
                and stays settled. "Where would input come from this second?"
                decays to the camera after five idle minutes — which is a
                routing fact, not a demotion of verified hardware. Showing the
                second answer alone made a working scanner read as
                "Camera fallback". */}
            <Row k="Status" v={
              scan.verified ? scan.status
                : scanStatus === "CAMERA_READY" ? "Scanner Not Verified · camera fallback available"
                  : "Scanner Not Verified · manual entry"
            } />
            {scan.state === "AWAITING_SCAN" && (
              <Row k="Input routing" v="Camera offered while no scan has come in — scanning still works" />
            )}
            {/* The row this page was missing. Everything above is scan
                evidence; this is the question it cannot answer. */}
            <Row k="Physical connection" v={physical.label} />
            {/* How the barcode arrives, which is not the same as whether a
                cable is plugged in. A wedge delivers keystrokes; a paired
                device names its own transport. */}
            <Row k="Input" v={inputMode} />
            <Row k="Manufacturer" v={scanner?.manufacturer || NOT_EXPOSED} />
            <Row k="Model" v={scanner?.model || NOT_EXPOSED} />
            <Row k="Vendor ID" v={scanner?.vendorId != null ? `0x${scanner.vendorId.toString(16).padStart(4, "0")}` : NOT_EXPOSED} mono />
            <Row k="Product ID" v={scanner?.productId != null ? `0x${scanner.productId.toString(16).padStart(4, "0")}` : NOT_EXPOSED} mono />
            <Row k="Serial number" v={scanner?.serialNumber || NOT_EXPOSED} mono />
            <Row k="Input mode" v={profile.scanner.autoDetect ? "Automatic" : "Manual preference"} />
            <Row k="Last scan" v={when(diag.scanner.lastScanAt)} />
            <Row k="Last barcode" v={diag.scanner.lastBarcode || "—"} mono />
            <Row k="Average scan speed" v={diag.scanner.averageScanMs != null ? `${diag.scanner.averageScanMs} ms` : "—"} />
            <Row k="Today's scans" v={String(diag.scanner.totalScansToday)} />
            {/* ── Test Scanner ─────────────────────────────────────────
                A diagnostic, not a second scanner: it attaches to the SAME
                engine every workstation uses, so what it proves is exactly
                what the workflow will do. */}
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[12px] font-semibold text-slate-700">Test barcode scanner</p>
              {testingScan ? (
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-blue-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for scan… scan any barcode now.
                </p>
              ) : lastTest ? (
                <div className="mt-1.5 space-y-1">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Scanner detected — working</p>
                  <Row k="Barcode" v={lastTest.code} mono />
                  <Row k="Input" v={lastTest.source.replace(/_/g, " ").toLowerCase() === "usb scanner" ? "Keyboard Emulation" : lastTest.source.replace(/_/g, " ").toLowerCase()} />
                  <Row k="Received" v={new Date(lastTest.at).toLocaleTimeString("en-IN")} />
                </div>
              ) : (
                <p className="mt-1 text-[12px] text-slate-500">Press Test Scanner, then scan any barcode. The test listens through the same engine the workstations use.</p>
              )}
            </div>

            <div className="pt-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={testScanner} disabled={testingScan}>
                {testingScan ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />} Test Scanner
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => runPrint("Barcode Test", barcodeTestHtml(), "BARCODE", true)} disabled={!!busy}>Scan Test Barcode</Button>
            </div>
            {inputMode === "Keyboard Emulation" && (
              <Notice tone="info">
                <span className="font-semibold">Keyboard-emulation scanner.</span> This scanner sends barcode data to Windows as
                keyboard input, so Windows may list it under keyboards rather than Printers &amp; scanners, and browser security
                stops Laundry OS determining whether the USB cable is currently connected. The definitive verification is a
                successful barcode scan — which is what the status above reports.
              </Notice>
            )}
            {!physical.detectable && inputMode !== "Keyboard Emulation" && <Notice tone="info">{PHYSICAL_CONNECTION_NOTE}</Notice>}

            {/* ── USB / HID device discovery ───────────────────────────
                Separate from scan verification on purpose: pairing a device
                proves a device, scanning proves the scanner. */}
            <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[12px] font-semibold text-slate-700">USB / HID Device Discovery</p>
              {canPair ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {caps.webHid && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestHidDevice, "HID device")}><ScanLine className="h-3 w-3" /> Connect HID Device</Button>}
                    {caps.webUsb && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestUsbDevice, "USB device")}><Usb className="h-3 w-3" /> Connect USB Device</Button>}
                    {caps.webSerial && <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => pair(requestSerialPort, "serial port")}><Plug className="h-3 w-3" /> Connect Serial Device</Button>}
                  </div>
                  <p className="text-[11px] text-slate-500">Devices available to Laundry OS through this browser</p>
                  {permitted.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No permitted devices. Nothing is enumerated without your permission — this is never a complete list of what is plugged into the computer.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {permitted.map((d, i) => (
                        <div key={d.id} className="rounded-lg border border-slate-100 bg-white p-2.5">
                          <p className="text-[12px] font-medium text-slate-800">{i + 1}. {d.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {SOURCE_LABEL[d.source] ?? d.source}
                            {" · Vendor ID: "}{d.vendorId != null ? `0x${d.vendorId.toString(16).padStart(4, "0")}` : NOT_EXPOSED}
                            {" · Product ID: "}{d.productId != null ? `0x${d.productId.toString(16).padStart(4, "0")}` : NOT_EXPOSED}
                            {" · Serial: "}{d.serialNumber || NOT_EXPOSED}
                          </p>
                          <p className="text-[11px] text-slate-500">Permission granted · {d.status === "ONLINE" ? "Connected" : "Not reporting"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Notice tone="info">
                  <span className="font-semibold">Hardware access is limited in this browser.</span> It cannot give Laundry OS
                  device-level USB/HID information. Your keyboard-emulation barcode scanner still works normally — plug it in and
                  scan, and Laundry OS verifies it when the scan arrives. For device-level information, use Chrome or Edge over HTTPS.
                </Notice>
              )}
            </div>
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
            {/* The pairing buttons above are Chromium-only APIs, so on Safari
                and Firefox they simply were not there — and a screen that
                offers no way to add hardware, with no reason given, reads as
                "my account is not allowed to do this". It is nothing to do
                with the account: nobody gets these buttons in this browser,
                and nobody needs them for the hardware a counter actually uses.
                Say so, rather than leaving a gap. */}
            {!canPair && (
              <Notice tone="info">
                <span className="font-semibold">Pairing is not available in this browser.</span> Direct USB, HID and serial
                pairing exist only in Chromium browsers (Chrome, Edge) over HTTPS — this is a browser limit, not a
                permission: no role can pair a device here.
                <br />
                <span className="font-semibold">Your hardware still works.</span> A USB or Bluetooth barcode scanner types
                like a keyboard and needs no pairing at all — plug it in and scan; the Scanner tab confirms it the moment a
                barcode arrives. Printing uses the system print dialog and works everywhere. Pairing is only for reading a
                device&rsquo;s make and model, or for driving a label printer directly. Open this page in Chrome or Edge if
                you want that.
              </Notice>
            )}
            {/* Why the list can be short. "Nothing here" is a statement about
                what has been GRANTED, not about what is plugged in. */}
            {canPair && (
              <Notice tone="info">
                Your browser only lets Laundry OS see hardware after you grant it. Nothing is scanned silently: choose Pair USB,
                Pair HID or Pair Serial, pick the device in the browser&rsquo;s own chooser, and it appears below. A device you
                have not granted shows as <span className="font-semibold">permission required</span>, which is not the same as
                disconnected — and a keyboard-emulation barcode scanner never appears in these lists at all, however well it works.
              </Notice>
            )}
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

function Tile({ label, value, note, ok, warn, icon: Icon }: { label: string; value: string; note?: string; ok: boolean; warn?: boolean; icon: typeof Usb }) {
  const dot = ok ? "bg-emerald-500" : warn ? "bg-amber-400" : "bg-rose-500"
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-slate-800">{value}</span>
      </div>
      {note && <div className="mt-1 text-[11px] leading-snug text-slate-500">{note}</div>}
    </div>
  )
}

/** How a granted device reached us, in the operator's words. */
const SOURCE_LABEL: Record<string, string> = {
  WEBHID: "HID", WEBUSB: "USB", WEBSERIAL: "Serial", BLUETOOTH: "Bluetooth",
  MEDIA_DEVICES: "Camera", BROWSER_PRINT: "Browser print", KEYBOARD_WEDGE: "Keyboard",
}

/** A hardware result, with only a true failure shown in red. */
function ResultChip({ r, labelOverride }: { r: HardwareResult; labelOverride?: string }) {
  const tone = RESULT_TONE[r]
  const cls = tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "bad" ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-50 text-slate-500"
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls}`}>{labelOverride ?? RESULT_LABEL[r]}</span>
}

function TestRow({ name, r, detail, action }: { name: string; r: HardwareResult; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 shrink-0 font-medium text-slate-700">{name}</span>
      <ResultChip r={r} />
      <span className="flex-1 text-slate-500">{detail}</span>
      {action}
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
