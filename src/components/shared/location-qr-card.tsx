"use client"

// Location QR — a scannable pointer to one physical place.
//
// Reusable for a Store or a Processing Center: every location gets its own QR,
// because a business with three addresses that shares one QR is worse than a
// business with none.
//
// The destination comes from the SAVED COORDINATES through locationMapsUrl(),
// the same helper module the delivery app navigates with — not a second Maps
// implementation, and never the typed address. Address text is what somebody
// keyed in; the coordinates are what was pinned on the map. Printing a QR from
// the former puts the wrong door on a visiting card.
//
// No coordinates means NO QR. Refusing is the correct behaviour: a plausible
// but wrong QR on printed material is far more expensive than a missing one.

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { QrCode, Download, Share2, Link as LinkIcon, AlertTriangle, Check, Loader2, Printer, MapPin } from "lucide-react"
import { toast } from "sonner"
import { locationMapsUrl } from "@/lib/delivery-actions"
import { qrPreviewDataUrl, downloadQrPng, downloadQrSvg, shareQr, canShareQr, qrSlug, QR_PNG_SIZE, printQrImage } from "@/lib/qr-export"

/** Print resolution. 1000px keeps a QR crisp on a business card at any size. */

export interface LocationQrCardProps {
  /** Business identity — the brand the location belongs to. */
  businessName: string
  /** This location's own name, e.g. "Thanisandra Store". */
  locationName: string
  /** Human address, shown for confirmation. Never used to build the QR. */
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  /**
   * True when the coordinates shown are edited but not yet saved. The QR is
   * still previewed, but labelled, so nobody prints one the record does not
   * yet agree with.
   */
  unsaved?: boolean
  /** "panel" renders a larger, customer-facing presentation. Presentation
   *  only — the payload, exports and share behaviour are identical. */
  variant?: "compact" | "panel"
  className?: string
}

export function LocationQrCard({
  businessName, locationName, address, latitude, longitude, unsaved = false, variant = "compact", className = "",
}: LocationQrCardProps) {
  const panel = variant === "panel"
  const mapsUrl = locationMapsUrl(latitude, longitude)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const canShare = canShareQr()

  useEffect(() => {
    if (!mapsUrl) { setPreview(null); return }
    let alive = true
    // Deterministic: the same coordinates always produce the same payload, so
    // the QR needs no stored record and can never drift from the location.
    qrPreviewDataUrl(mapsUrl, panel ? 640 : 320)
      .then((d) => { if (alive) setPreview(d) })
      .catch(() => { if (alive) setPreview(null) })
    return () => { alive = false }
  }, [mapsUrl, panel])

  const fileBase = `${qrSlug(businessName)}-${qrSlug(locationName)}-location-qr`

  const downloadPng = useCallback(async () => {
    if (!mapsUrl) return
    setBusy("png")
    try { await downloadQrPng(mapsUrl, fileBase); toast.success(`Downloaded ${QR_PNG_SIZE} × ${QR_PNG_SIZE} PNG`) }
    catch { toast.error("Could not generate the PNG") } finally { setBusy(null) }
  }, [mapsUrl, fileBase])

  const downloadSvg = useCallback(async () => {
    if (!mapsUrl) return
    setBusy("svg")
    try { await downloadQrSvg(mapsUrl, fileBase); toast.success("Downloaded SVG") }
    catch { toast.error("Could not generate the SVG") } finally { setBusy(null) }
  }, [mapsUrl, fileBase])

  const share = useCallback(async () => {
    if (!mapsUrl) return
    setBusy("share")
    const ok = await shareQr(mapsUrl, fileBase, `${businessName} — ${locationName}`, `${locationName} location`)
    if (!ok) toast.error("Sharing is not available here")
    setBusy(null)
  }, [mapsUrl, fileBase, businessName, locationName])

  /** Print the QR itself, through the shared hidden-iframe printer. */
  const printQr = useCallback(() => {
    if (!preview || !mapsUrl) return
    printQrImage(preview, `${businessName} — ${locationName}`, address || mapsUrl)
  }, [preview, mapsUrl, businessName, locationName, address])

  const copyLink = useCallback(async () => {
    if (!mapsUrl) return
    try {
      await navigator.clipboard.writeText(mapsUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast.success("✓ Maps link copied")
    } catch { toast.error("Could not copy the link") }
  }, [mapsUrl])

  // ── No trustworthy coordinates → refuse, and say what to do. ──────────────
  if (!mapsUrl) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50/60 p-3 ${className}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Location not saved
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Search for the address or use your current location above to pin this place on the map. A Location QR is only
          generated from saved coordinates, never from the typed address.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5 text-blue-600" /> Location QR
        </p>
        {unsaved && (
          <span className="text-[10px] rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-amber-700">Unsaved — save to publish</span>
        )}
      </div>

      {/* Business above location, matching the branding hierarchy: the brand
          owns the place, the place is the branch. */}
      <div className={`mt-2 gap-3 ${panel ? "flex flex-col items-center text-center" : "flex items-start"}`}>
        <div className="rounded-lg border border-slate-200 bg-white p-2 shrink-0">
          {preview
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={preview} alt={`${locationName} location QR`} className={panel ? "h-[240px] w-[240px]" : "h-[104px] w-[104px]"} />
            : <div className={`${panel ? "h-[240px] w-[240px]" : "h-[104px] w-[104px]"} grid place-items-center text-slate-300`}><Loader2 className="h-4 w-4 animate-spin" /></div>}
        </div>
        <div className="min-w-0 w-full flex-1">
          <p className="text-xs font-semibold text-slate-800 truncate">{businessName}</p>
          <p className="text-xs text-slate-600 truncate">{locationName}</p>
          {address && <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{address}</p>}
          <p className="mt-1 text-[10px] font-mono text-emerald-700 flex items-center gap-1">
            <Check className="h-3 w-3" />{latitude}, {longitude}
          </p>
          <p className="text-[10px] text-slate-400">Scan to open this location in Google Maps</p>
        </div>
      </div>

      <div className={`mt-3 flex flex-wrap gap-1.5 ${panel ? "justify-center" : ""}`}>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy === "png"} onClick={downloadPng}>
          {busy === "png" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Download PNG
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy === "svg"} onClick={downloadSvg}>
          {busy === "svg" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} SVG
        </Button>
        {/* Hidden rather than shown-and-broken where the browser has no share. */}
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={printQr} disabled={!preview}>
          <Printer className="h-3 w-3" /> Print QR
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" asChild>
          <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPin className="h-3 w-3" /> Open Maps</a>
        </Button>
        {canShare && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy === "share"} onClick={share}>
            {busy === "share" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />} Share
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-slate-600" onClick={copyLink}>
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <LinkIcon className="h-3 w-3" />} {copied ? "Copied" : "Copy Maps Link"}
        </Button>
      </div>
    </div>
  )
}
