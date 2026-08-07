// Transport identity — THE single source of truth for how a package is
// identified between the Store and the Processing Center.
//
// Workspace Settings → Transport Setup stores one mode per direction:
//   PACKET → the generated Processing Packet QR (PKT-…) is the identifier
//   BAG    → the reusable Laundry Bag QR (BAG-…) is the identifier
//   BOTH   → either identifier resolves the order
//
// The mode governs GENERATION, RENDERING, SEARCH, SCANNING, HISTORY, AUDIT LOG
// NOTES and WORKFLOW GATES. Nothing in the transport flow may hardcode a
// preference for the packet — every screen and endpoint reads it from here.
//
// This module is client-safe (no prisma). Database resolution of the actual
// identifier for an order lives in `laundry-transport-server.ts`.

export type TransportMode = "PACKET" | "BAG" | "BOTH"

export const DEFAULT_TRANSPORT_MODE: TransportMode = "PACKET"

export interface TransportModes {
  storeToProcessing: TransportMode
  processingToStore: TransportMode
}

/** Which leg of the round trip a screen/endpoint is operating on. */
export type TransportDirection = "STORE_TO_PROCESSING" | "PROCESSING_TO_STORE"

export const DEFAULT_TRANSPORT_MODES: TransportModes = {
  storeToProcessing: DEFAULT_TRANSPORT_MODE,
  processingToStore: DEFAULT_TRANSPORT_MODE,
}

export function normalizeTransportMode(value: unknown): TransportMode {
  return value === "BAG" || value === "BOTH" || value === "PACKET" ? value : DEFAULT_TRANSPORT_MODE
}

export function normalizeTransportModes(value: unknown): TransportModes {
  const v = (value || {}) as Record<string, unknown>
  return {
    storeToProcessing: normalizeTransportMode(v.storeToProcessingTransportMode ?? v.storeToProcessing),
    processingToStore: normalizeTransportMode(v.processingToStoreTransportMode ?? v.processingToStore),
  }
}

/** A packet QR is generated / printed / scanned only when the mode allows it. */
export function usesPacket(mode: TransportMode): boolean {
  return mode !== "BAG"
}

/** A bag QR is assigned / scanned only when the mode allows it. */
export function usesBag(mode: TransportMode): boolean {
  return mode !== "PACKET"
}

/** Noun for labels, badges and toasts — "Bag" / "Packet" / "Package" (BOTH). */
export function transportNoun(mode: TransportMode): string {
  return mode === "BAG" ? "Bag" : mode === "PACKET" ? "Packet" : "Package"
}

export function transportNounPlural(mode: TransportMode): string {
  return `${transportNoun(mode)}s`
}

/** Placeholder for the scan / manual-entry field of a transport screen. */
export function transportScanPlaceholder(mode: TransportMode): string {
  if (mode === "BAG") return "Scan bag QR or enter bag / order code (BAG-… / ORD-…)"
  if (mode === "PACKET") return "Scan packet QR or enter packet / order code (PKT-… / ORD-…)"
  return "Scan packet or bag QR — or enter packet / bag / order code"
}

/** Which identifier a resolved reference actually carries. */
export type TransportRefKind = "PACKET" | "BAG" | "NONE"

export interface TransportRef {
  kind: TransportRefKind
  /** The identifier shown to operators and printed on the label. */
  code: string | null
  /** QR payload for `code` (equals `code` for both packets and bags). */
  qrValue: string | null
  packetNumber: string | null
  bagNumber: string | null
  /**
   * True when the mode says BAG but the order only carries a packet (created
   * before Transport Setup was switched). Such orders keep working with the
   * identifier they were dispatched with — new orders never produce one.
   */
  legacy: boolean
}

export const EMPTY_TRANSPORT_REF: TransportRef = {
  kind: "NONE", code: null, qrValue: null, packetNumber: null, bagNumber: null, legacy: false,
}

/** "Bag BAG-000123" / "Packet PKT-…" — for notes, toasts and audit entries. */
export function transportRefLabel(ref: TransportRef | null | undefined): string | null {
  if (!ref?.code) return null
  return `${ref.kind === "BAG" ? "Bag" : "Packet"} ${ref.code}`
}
