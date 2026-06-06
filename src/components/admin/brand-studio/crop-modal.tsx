"use client"

import { useState, useCallback, useEffect } from "react"
import Cropper from "react-easy-crop"
import type { Area, MediaSize, Point } from "react-easy-crop"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Loader2, ZoomIn, RotateCcw, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"

// Fixed aspect ratio per field — unlisted fields use the image's natural ratio
const FIELD_ASPECT: Record<string, number> = {
  compactLogoUrl:    1,
  faviconUrl:        1,
  watermarkUrl:      16 / 9,
  salesWatermarkUrl: 16 / 9,
  hrmsWatermarkUrl:  16 / 9,
  emailLogoUrl:      1983 / 793,
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

async function cropToBlob(src: string, px: Area): Promise<Blob> {
  const img    = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width  = Math.round(px.width)
  canvas.height = Math.round(px.height)
  const ctx = canvas.getContext("2d")!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(
    img,
    Math.round(px.x), Math.round(px.y), Math.round(px.width), Math.round(px.height),
    0, 0, canvas.width, canvas.height,
  )
  return new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error("Canvas is empty"))), "image/png"),
  )
}

// Scans alpha channel for the bounding box of non-transparent pixels.
async function transparentBounds(src: string, pad = 8): Promise<Area | null> {
  try {
    const img = await loadImage(src)
    const { naturalWidth: w, naturalHeight: h } = img
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, w, h)
    let top = h, bot = 0, left = w, right = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 10) {
          if (y < top)   top   = y
          if (y > bot)   bot   = y
          if (x < left)  left  = x
          if (x > right) right = x
        }
      }
    }
    if (top > bot) return null
    return {
      x:      Math.max(0, left  - pad),
      y:      Math.max(0, top   - pad),
      width:  Math.min(w, right  - left + 1 + pad * 2),
      height: Math.min(h, bot   - top  + 1 + pad * 2),
    }
  } catch { return null }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CropModalProps {
  open:       boolean
  imageUrl:   string
  assetField: string
  label:      string
  onSave:     (url: string) => void
  onClose:    () => void
}

export function CropModal({ open, imageUrl, assetField, label, onSave, onClose }: CropModalProps) {
  const fixedAspect = FIELD_ASPECT[assetField]

  const [crop,      setCrop]      = useState<Point>({ x: 0, y: 0 })
  const [zoom,      setZoom]      = useState(1)
  const [pixels,    setPixels]    = useState<Area | null>(null)
  const [natW,      setNatW]      = useState(1)
  const [natH,      setNatH]      = useState(1)
  const [natAspect, setNatAspect] = useState(4 / 3)
  const [saving,    setSaving]    = useState(false)
  const [trimming,  setTrimming]  = useState(false)

  // For fields without a fixed ratio, use the image's own aspect ratio so the
  // crop box initially contains the whole image.
  const aspect = fixedAspect ?? natAspect

  useEffect(() => {
    if (!open || !imageUrl) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setPixels(null)
  }, [open, imageUrl])

  const onCropComplete  = useCallback((_: Area, px: Area) => setPixels(px), [])
  const onMediaLoaded   = useCallback((m: MediaSize) => {
    setNatW(m.naturalWidth)
    setNatH(m.naturalHeight)
    if (fixedAspect === undefined) setNatAspect(m.naturalWidth / m.naturalHeight)
  }, [fixedAspect])

  const reset = () => { setCrop({ x: 0, y: 0 }); setZoom(1) }

  const handleAutoTrim = async () => {
    setTrimming(true)
    try {
      const bounds = await transparentBounds(imageUrl)
      if (!bounds) { toast.info("No transparent margins detected"); return }
      const blob = await cropToBlob(imageUrl, bounds)
      const form = new FormData()
      form.append("file", blob, `${assetField}-trimmed.png`)
      form.append("assetField", assetField)
      const res  = await authFetch("/api/admin/platform-settings/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Upload failed")
      onSave(json.url)
      toast.success("Transparent margins removed")
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto Trim failed")
    } finally { setTrimming(false) }
  }

  const handleSave = async () => {
    if (!pixels) return
    setSaving(true)
    try {
      const blob = await cropToBlob(imageUrl, pixels)
      const form = new FormData()
      form.append("file", blob, `${assetField}-cropped.png`)
      form.append("assetField", assetField)
      const res  = await authFetch("/api/admin/platform-settings/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Upload failed")
      onSave(json.url)
      toast.success(`${label} saved`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Crop failed")
    } finally { setSaving(false) }
  }

  // Live preview: CSS positioning maps the crop region onto a fixed container
  const PW = 178
  const PH = 100
  const previewStyle = pixels && natW > 1 ? (() => {
    const scale = PW / pixels.width
    return {
      position: "absolute" as const,
      left:   -pixels.x * scale,
      top:    -pixels.y * scale,
      width:   natW * scale,
      height:  natH * scale,
    }
  })() : null

  const aspectLabel =
    fixedAspect === undefined  ? "Auto (original ratio)"
    : fixedAspect === 1        ? "1 : 1"
    : fixedAspect === 16 / 9   ? "16 : 9"
    : fixedAspect === 1983/793 ? "Email (1983 × 793)"
    : `${fixedAspect.toFixed(2)} : 1`

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[840px] p-0 gap-0 overflow-hidden">

        <DialogHeader className="px-5 py-3.5 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold">
            Crop — {label}
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">{aspectLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex">
          {/* Cropper */}
          <div className="relative flex-1 bg-[#0a0a0a]" style={{ height: 380 }}>
            {imageUrl && (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={0}
                aspect={aspect}
                minZoom={1}
                maxZoom={10}
                cropShape="rect"
                objectFit="contain"
                showGrid
                restrictPosition
                zoomWithScroll
                style={{}}
                classes={{}}
                mediaProps={{}}
                cropperProps={{}}
                zoomSpeed={0.3}
                keyboardStep={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onMediaLoaded={onMediaLoaded}
              />
            )}
          </div>

          {/* Right panel */}
          <div className="w-[210px] shrink-0 border-l bg-background flex flex-col p-4 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Preview</p>
              <div
                className="relative overflow-hidden rounded-lg border"
                style={{
                  width: PW,
                  height: PH,
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23d1d5db'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23d1d5db'/%3E%3Crect x='8' width='8' height='8' fill='%23f9fafb'/%3E%3Crect y='8' width='8' height='8' fill='%23f9fafb'/%3E%3C/svg%3E\")",
                }}
              >
                {previewStyle
                  ? <img src={imageUrl} style={previewStyle} alt="" draggable={false} />
                  : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground">Adjust crop area</span>
                    </div>
                  )
                }
              </div>
              {pixels && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {Math.round(pixels.width)} × {Math.round(pixels.height)} px
                </p>
              )}
            </div>

            <div className="mt-auto text-[10px] text-muted-foreground space-y-1 leading-relaxed">
              <p className="font-semibold text-foreground/60 text-[11px]">Tips</p>
              <p>Scroll to zoom in / out</p>
              <p>Drag to reposition</p>
              <p>Pinch to zoom on touch</p>
            </div>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t flex items-center gap-3">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            min={1} max={10} step={0.05}
            value={[zoom]}
            onValueChange={([v]) => setZoom(v)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
            {zoom.toFixed(1)}×
          </span>
        </div>

        <DialogFooter className="px-5 py-3 border-t flex flex-row items-center justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={handleAutoTrim} disabled={trimming || saving}
              className="gap-1.5 text-xs"
            >
              {trimming
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Wand2 className="h-3.5 w-3.5" />}
              Auto Trim
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={reset} disabled={saving || trimming}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving || trimming}>
              Cancel
            </Button>
            <Button
              size="sm" onClick={handleSave}
              disabled={saving || trimming || !pixels}
              className="gap-1.5 min-w-[90px] text-xs"
            >
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : "Save Crop"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
