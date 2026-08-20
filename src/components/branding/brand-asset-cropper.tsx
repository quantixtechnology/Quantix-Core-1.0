"use client"

// ============================================================================
// BrandAssetCropper — ONE crop editor for every brand asset.
//
// A logo arrives with whatever margin the designer left around it. Dropped
// straight into a square app icon that margin becomes most of the icon, and the
// mark shrinks to nothing. The fix is not a cleverer automatic fit — it is
// letting a person say which part of their own logo matters.
//
//   Original upload → crop editor → processed asset → destination
//
// The original file is never touched. This produces a NEW file; what the
// business uploaded stays exactly as it was.
//
// Configured per destination, so one component serves the website logo, all
// four app icons and the favicon rather than six near-identical editors:
//
//   aspect   3 for a website lockup, 1 for an icon
//   output   the pixel size the destination actually needs
//   preview  how the result will be seen (square tile, or wide strip)
//
// Zoom and drag are the crop: the frame is fixed and the artwork moves beneath
// it, which cannot distort the logo. There is no handle that changes width
// without height, because that is precisely how logos get squashed.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, RotateCcw, ZoomIn, Check, X, Move } from "lucide-react"

export interface CropConfig {
  /** width / height of the crop frame. 1 = square icon, 3 = website lockup. */
  aspect: number
  /** Pixel size of the produced file. */
  outputWidth: number
  outputHeight: number
  /** What the result is for — shown in the dialog title. */
  label: string
  /** Square destinations preview as a rounded tile, wide ones as a strip. */
  previewShape: "square" | "wide"
}

const FRAME_W = 320 // on-screen crop frame width; height follows the aspect

export function BrandAssetCropper({
  file,
  config,
  onCancel,
  onApply,
}: {
  file: File | null
  config: CropConfig
  onCancel: () => void
  onApply: (cropped: File) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const frameH = Math.round(FRAME_W / config.aspect)

  // Load the chosen file into an image we can draw.
  useEffect(() => {
    if (!file) { setImg(null); return }
    setError(null)
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { setImg(image); setZoom(1); setOffset({ x: 0, y: 0 }) }
    image.onerror = () => setError("That file could not be read as an image.")
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  /** Scale at which the artwork exactly fits inside the frame — the zoom floor. */
  const baseScale = img ? Math.min(FRAME_W / img.width, frameH / img.height) : 1

  // Draw the live preview: artwork positioned under a fixed frame.
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = FRAME_W
    canvas.height = frameH
    ctx.clearRect(0, 0, FRAME_W, frameH)
    const s = baseScale * zoom
    const w = img.width * s
    const h = img.height * s
    ctx.drawImage(img, (FRAME_W - w) / 2 + offset.x, (frameH - h) / 2 + offset.y, w, h)
  }, [img, zoom, offset, baseScale, frameH])

  useEffect(() => { draw() }, [draw])

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }

  /** Render the crop at the destination's real pixel size. */
  const apply = async () => {
    if (!img || !file) return
    setBusy(true)
    try {
      const out = document.createElement("canvas")
      out.width = config.outputWidth
      out.height = config.outputHeight
      const ctx = out.getContext("2d")
      if (!ctx) throw new Error("Could not prepare the image.")

      // The frame maps 1:1 onto the output, so what is seen is what is saved.
      const k = config.outputWidth / FRAME_W
      const s = baseScale * zoom * k
      const w = img.width * s
      const h = img.height * s
      ctx.drawImage(
        img,
        (config.outputWidth - w) / 2 + offset.x * k,
        (config.outputHeight - h) / 2 + offset.y * k,
        w, h,
      )

      const blob: Blob | null = await new Promise((r) => out.toBlob(r, "image/png"))
      if (!blob) throw new Error("Could not produce the image.")
      // A NEW file — the upload the business made is left untouched.
      onApply(new File([blob], file.name.replace(/\.[^.]+$/, "") + "-cropped.png", { type: "image/png" }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not crop that image.")
    } finally {
      setBusy(false)
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
  }
  const onPointerUp = () => { drag.current = null }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader><DialogTitle className="text-base">Adjust {config.label}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Move className="h-3.5 w-3.5 shrink-0" /> Drag to move, zoom to trim the empty space around your logo.
          </p>

          {/* Crop frame — fixed aspect, artwork moves beneath it. */}
          <div
            className="relative mx-auto overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px] touch-none cursor-grab active:cursor-grabbing"
            style={{ width: FRAME_W, height: frameH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} className="pointer-events-none block" />
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="range" min={0.5} max={4} step={0.01} value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
              aria-label="Zoom"
            />
            <button onClick={reset} className="text-slate-400 hover:text-slate-600 shrink-0" title="Reset">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={onCancel} disabled={busy}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button className="flex-1 gap-1.5" onClick={apply} disabled={busy || !img}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The destinations a brand asset can be cropped for. */
export const CROP_PRESETS = {
  appIcon: (label: string): CropConfig => ({
    aspect: 1, outputWidth: 512, outputHeight: 512, label, previewShape: "square",
  }),
  websiteLogo: (): CropConfig => ({
    aspect: 3, outputWidth: 900, outputHeight: 300, label: "website logo", previewShape: "wide",
  }),
  favicon: (): CropConfig => ({
    aspect: 1, outputWidth: 256, outputHeight: 256, label: "favicon", previewShape: "square",
  }),
} as const
