// Device discovery.
//
// Two rules shape everything here.
//
// 1. Browsers do not let a page enumerate hardware. WebUSB / WebHID / Web
//    Serial return only devices the user has already granted through a picker,
//    and that grant needs a user gesture — so discovery at startup lists what
//    was paired earlier, and `request*` is what a person clicks to add more.
//    An empty list is a normal state, not a failure.
//
// 2. We report what the device declares and nothing else. A USB interface
//    class of 7 means the device itself says "printer", so that is a fact. A
//    vendor id is NOT a model: no lookup table, no inference. Anything we
//    cannot name is "Unknown Printer", still connected and still usable.

import type { HardwareDevice, DeviceKind } from "./types"
import { BROWSER_PRINT_ID, UNKNOWN_PRINTER_NAME } from "./types"

const USB_CLASS_PRINTER = 7
const USB_CLASS_HID = 3

type UsbAlternate = { interfaceClass?: number }
type UsbInterface = { alternates?: UsbAlternate[] }
type UsbConfiguration = { interfaces?: UsbInterface[] }
type UsbDevice = {
  vendorId?: number; productId?: number
  manufacturerName?: string | null; productName?: string | null; serialNumber?: string | null
  configurations?: UsbConfiguration[]
}
type HidDevice = {
  vendorId?: number; productId?: number; productName?: string | null
  collections?: { usagePage?: number; usage?: number }[]
}
type SerialPort = { getInfo?: () => { usbVendorId?: number; usbProductId?: number } }

type Nav = Navigator & {
  usb?: { getDevices: () => Promise<UsbDevice[]>; requestDevice: (o: unknown) => Promise<UsbDevice> }
  hid?: { getDevices: () => Promise<HidDevice[]>; requestDevice: (o: unknown) => Promise<HidDevice[]> }
  serial?: { getPorts: () => Promise<SerialPort[]>; requestPort: () => Promise<SerialPort> }
}

const hex = (n?: number | null) => (typeof n === "number" ? `0x${n.toString(16).padStart(4, "0")}` : null)

/** The browser's own print dialog — always present, never removable. */
export function browserPrintDevice(): HardwareDevice {
  return {
    id: BROWSER_PRINT_ID,
    kind: "DOCUMENT_PRINTER",
    connection: "BROWSER",
    source: "BROWSER_PRINT",
    name: "Browser Print (system dialog)",
    manufacturer: null, product: null, model: null,
    vendorId: null, productId: null, serialNumber: null,
    status: "ONLINE",
    isBrowserPrint: true,
    lastSeenAt: new Date().toISOString(),
  }
}

function usbKind(d: UsbDevice): DeviceKind {
  const classes = (d.configurations || []).flatMap((c) => (c.interfaces || []).flatMap((i) => (i.alternates || []).map((a) => a.interfaceClass)))
  if (classes.includes(USB_CLASS_PRINTER)) return "LABEL_PRINTER"
  if (classes.includes(USB_CLASS_HID)) return "BARCODE_SCANNER"
  return "LABEL_PRINTER"
}

function fromUsb(d: UsbDevice): HardwareDevice {
  const name = d.productName || (d.manufacturerName ? `${d.manufacturerName} device` : UNKNOWN_PRINTER_NAME)
  return {
    id: `usb:${hex(d.vendorId)}:${hex(d.productId)}:${d.serialNumber || ""}`,
    kind: usbKind(d),
    connection: "USB",
    source: "WEBUSB",
    name,
    manufacturer: d.manufacturerName ?? null,
    product: d.productName ?? null,
    // The device never reports a marketing model name, so we do not invent one.
    model: d.productName ?? null,
    vendorId: d.vendorId ?? null,
    productId: d.productId ?? null,
    serialNumber: d.serialNumber ?? null,
    status: "ONLINE",
    lastSeenAt: new Date().toISOString(),
  }
}

function fromHid(d: HidDevice): HardwareDevice {
  // A keyboard-usage HID device is how nearly every barcode scanner presents.
  const isKeyboard = (d.collections || []).some((c) => c.usagePage === 1 && c.usage === 6)
  return {
    id: `hid:${hex(d.vendorId)}:${hex(d.productId)}`,
    kind: isKeyboard ? "BARCODE_SCANNER" : "LABEL_PRINTER",
    connection: "USB",
    source: "WEBHID",
    name: d.productName || (isKeyboard ? "Unknown Scanner" : UNKNOWN_PRINTER_NAME),
    manufacturer: null,
    product: d.productName ?? null,
    model: d.productName ?? null,
    vendorId: d.vendorId ?? null,
    productId: d.productId ?? null,
    serialNumber: null,
    status: "ONLINE",
    lastSeenAt: new Date().toISOString(),
  }
}

function fromSerial(p: SerialPort, idx: number): HardwareDevice {
  const info = p.getInfo?.() || {}
  return {
    id: `serial:${hex(info.usbVendorId) || idx}:${hex(info.usbProductId) || ""}`,
    kind: "LABEL_PRINTER",
    connection: "SERIAL",
    source: "WEBSERIAL",
    name: UNKNOWN_PRINTER_NAME,
    manufacturer: null, product: null, model: null,
    vendorId: info.usbVendorId ?? null,
    productId: info.usbProductId ?? null,
    serialNumber: null,
    status: "ONLINE",
    lastSeenAt: new Date().toISOString(),
  }
}

/** Everything already granted, plus the browser print target. Never throws. */
export async function discoverDevices(): Promise<HardwareDevice[]> {
  const found: HardwareDevice[] = [browserPrintDevice()]
  if (typeof navigator === "undefined") return found
  const n = navigator as Nav

  const [usb, hid, serial] = await Promise.all([
    n.usb?.getDevices().catch(() => [] as UsbDevice[]) ?? Promise.resolve([] as UsbDevice[]),
    n.hid?.getDevices().catch(() => [] as HidDevice[]) ?? Promise.resolve([] as HidDevice[]),
    n.serial?.getPorts().catch(() => [] as SerialPort[]) ?? Promise.resolve([] as SerialPort[]),
  ])

  found.push(...usb.map(fromUsb), ...hid.map(fromHid), ...serial.map(fromSerial))

  // Cameras: enumerateDevices always lists them, but labels stay blank until
  // camera permission has been granted — an unlabelled camera is still a valid
  // scan target, so it is listed either way.
  try {
    const media = await navigator.mediaDevices?.enumerateDevices()
    for (const d of media || []) {
      if (d.kind !== "videoinput") continue
      found.push({
        id: `camera:${d.deviceId || d.label || "default"}`,
        kind: "CAMERA",
        connection: "CAMERA",
        source: "MEDIA_DEVICES",
        name: d.label || "Camera (grant access to name it)",
        manufacturer: null, product: d.label || null, model: null,
        vendorId: null, productId: null, serialNumber: null,
        status: "ONLINE",
        lastSeenAt: new Date().toISOString(),
      })
    }
  } catch { /* enumeration blocked — cameras simply do not appear */ }

  // De-duplicate: the same physical unit can surface through more than one API.
  const seen = new Set<string>()
  return found.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
}

// ── Pairing (must be called from a click) ────────────────────────────────────

export async function requestUsbDevice(): Promise<HardwareDevice | null> {
  const n = navigator as Nav
  if (!n.usb) return null
  try {
    // Empty filters shows everything; the operator picks their printer. A
    // class-7 filter would hide printers that present as vendor-specific,
    // which is most thermal label printers.
    const d = await n.usb.requestDevice({ filters: [] })
    return d ? fromUsb(d) : null
  } catch { return null } // user cancelled the picker
}

export async function requestHidDevice(): Promise<HardwareDevice | null> {
  const n = navigator as Nav
  if (!n.hid) return null
  try {
    const list = await n.hid.requestDevice({ filters: [] })
    return list?.[0] ? fromHid(list[0]) : null
  } catch { return null }
}

export async function requestSerialPort(): Promise<HardwareDevice | null> {
  const n = navigator as Nav
  if (!n.serial) return null
  try {
    const p = await n.serial.requestPort()
    return p ? fromSerial(p, 0) : null
  } catch { return null }
}

/** Connect/disconnect notifications, where the browser offers them. */
export function watchDeviceChanges(onChange: () => void): () => void {
  if (typeof navigator === "undefined") return () => {}
  const n = navigator as Nav & { usb?: EventTarget; hid?: EventTarget }
  const targets: EventTarget[] = []
  if (n.usb instanceof EventTarget) targets.push(n.usb)
  if (n.hid instanceof EventTarget) targets.push(n.hid)
  const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined
  for (const t of targets) {
    t.addEventListener("connect", onChange)
    t.addEventListener("disconnect", onChange)
  }
  media?.addEventListener?.("devicechange", onChange)
  return () => {
    for (const t of targets) {
      t.removeEventListener("connect", onChange)
      t.removeEventListener("disconnect", onChange)
    }
    media?.removeEventListener?.("devicechange", onChange)
  }
}

export function deviceSummary(d: HardwareDevice): string {
  const bits = [
    d.manufacturer,
    d.model && d.model !== d.manufacturer ? d.model : null,
    d.vendorId != null ? `VID ${hex(d.vendorId)}` : null,
    d.productId != null ? `PID ${hex(d.productId)}` : null,
  ].filter(Boolean)
  return bits.length ? bits.join(" · ") : "Model unknown · using browser printing"
}
