"use client"

// THE thermal label settings control — one button, one dialog, one saved
// configuration, shared by every screen that prints on the TE244.
//
// Barcode Generation and Bag Management are not two printers; they are two
// label types on the same machine. So they must not own two settings screens
// either: this component reads and writes the SAME LabelConfig through
// loadLabelConfig()/saveLabelConfig(), which is what makes a stock size changed
// on one screen take effect on the other. A bag-specific configuration would
// re-introduce exactly the split this replaces.
//
// The fields are the ones the barcode screen already exposed, unchanged: stock
// size and orientation (which must match the printer driver), the content box,
// DPI, and the Code 128 tuning that only garment labels read.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Printer, Eye, Check, Settings } from "lucide-react"
import { saveLabelConfig, resolveStockHeightMm, STOCK_HEIGHT_MM, DEFAULT_ORIENTATION, type LabelConfig } from "@/lib/laundry-label"

const WIDTHS = [40, 50, 60, 70, 80], HEIGHTS = [30, 40, 50], DPIS = [203, 300, 600]
// Must match how the TSC TE244 driver is set for the loaded stock. Disagreement
// is what makes the driver rotate the label 90° and clip the barcode.
const ORIENTATIONS = [
  { value: "landscape", label: "Landscape" },
  { value: "portrait", label: "Portrait" },
]
const PROFILES: { value: string; label: string }[] = [
  { value: "compact", label: "Compact (58mm)" },
  { value: "standard", label: "Standard (Current)" },
  { value: "wide-scan", label: "Wide Scan" },
  { value: "warehouse", label: "Warehouse" },
  { value: "custom", label: "Custom" },
]
const TEXT_POSITIONS = [{ value: "bottom", label: "Bottom" }, { value: "top", label: "Top" }, { value: "hidden", label: "Hidden" }]

/** What the button says, so staff can read the loaded stock without opening it. */
export function labelSummary(cfg: LabelConfig): string {
  const o = (cfg.orientation ?? DEFAULT_ORIENTATION) === "landscape" ? "Landscape" : "Portrait"
  return `${cfg.widthMm}×${resolveStockHeightMm(cfg)}mm ${o}`
}

export function LaundryLabelSettings({
  cfg, onChange, onSaved, onPreview, size = "sm",
}: {
  cfg: LabelConfig
  /** Live edit, exactly as before — the screen prints with what is on screen. */
  onChange: (c: LabelConfig) => void
  /** After the config is persisted, so each screen can raise its own toast. */
  onSaved?: (c: LabelConfig) => void
  /** Optional: preview this screen's own label type. Hidden when not supplied. */
  onPreview?: (c: LabelConfig) => void
  size?: "sm" | "default"
}) {
  const [open, setOpen] = useState(false)
  const setCfg = onChange

  return (
    <>
      <Button variant="outline" size={size} className="gap-1" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" /> Label Settings
        <span className="text-slate-400 font-normal">· {labelSummary(cfg)}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-blue-600" /> Thermal Label Settings</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* PAPER — what the printer is loaded with and how it is set. These
                three must match the TSC driver exactly; a mismatch is what makes
                the driver rotate the label and clip the barcode. */}
            <div className="grid grid-cols-3 gap-3">
              {/* Width is a floor — a longer code widens the label rather than
                  compressing the barcode. */}
              <div className="space-y-1"><Label className="text-xs">Stock Width (mm)</Label><Select value={String(cfg.widthMm)} onValueChange={(v) => setCfg({ ...cfg, widthMm: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WIDTHS.map((w) => <SelectItem key={w} value={String(w)}>{w} mm</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Stock Height (mm)</Label><Input type="number" min={10} max={200} step={0.1} value={cfg.stockHeightMm ?? STOCK_HEIGHT_MM} onChange={(e) => setCfg({ ...cfg, stockHeightMm: +e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Orientation</Label><Select value={cfg.orientation ?? DEFAULT_ORIENTATION} onValueChange={(v) => setCfg({ ...cfg, orientation: v as LabelConfig["orientation"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORIENTATIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug -mt-2">Stock size and orientation must match the printer driver (TSC TE244: 1.97 × 1.50 in, Landscape). Print at 100% / Actual Size — never “Fit to page”.</p>

            {/* CONTENT — the box the symbol and code are drawn in, centred on the
                stock. Changing this resizes the symbol; changing the stock does not. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Content Height (mm)</Label><Select value={String(cfg.heightMm)} onValueChange={(v) => setCfg({ ...cfg, heightMm: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{HEIGHTS.map((h) => <SelectItem key={h} value={String(h)}>{h} mm</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Printer DPI</Label><Select value={String(cfg.dpi)} onValueChange={(v) => setCfg({ ...cfg, dpi: +v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DPIS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div>
                <Label className="text-xs block mb-1.5">Barcode Profile</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PROFILES.map((p) => (
                    <button key={p.value} onClick={() => setCfg({ ...cfg, barcodeProfile: p.value as LabelConfig["barcodeProfile"] })} className={`rounded-md border px-3 py-2 text-xs font-medium text-left ${(cfg.barcodeProfile || "standard") === p.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{p.label}</button>
                  ))}
                </div>
              </div>

              {(cfg.barcodeProfile === "custom" || !cfg.barcodeProfile) && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="space-y-1"><Label className="text-xs">Module Width</Label><Input type="number" min={0.5} max={10} step={0.1} value={cfg.moduleWidth ?? 2} onChange={(e) => setCfg({ ...cfg, moduleWidth: +e.target.value, barcodeProfile: "custom" })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Barcode Height</Label><Input type="number" min={30} max={500} step={5} value={cfg.barcodeHeight ?? 150} onChange={(e) => setCfg({ ...cfg, barcodeHeight: +e.target.value, barcodeProfile: "custom" })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Quiet Zone</Label><Input type="number" min={0} max={50} step={1} value={cfg.quietZone ?? 10} onChange={(e) => setCfg({ ...cfg, quietZone: +e.target.value, barcodeProfile: "custom" })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Font Size</Label><Input type="number" min={4} max={24} step={1} value={cfg.fontSize ?? 10} onChange={(e) => setCfg({ ...cfg, fontSize: +e.target.value, barcodeProfile: "custom" })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Text Position</Label><Select value={cfg.textPosition || "bottom"} onValueChange={(v) => setCfg({ ...cfg, textPosition: v as LabelConfig["textPosition"], barcodeProfile: "custom" })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{TEXT_POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
                </div>
              )}

              <div className="border-t pt-3 space-y-3">
                <Label className="text-xs block mb-1.5 font-semibold text-slate-700">Margins & Scaling</Label>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="space-y-1"><Label className="text-xs">Left (mm)</Label><Input type="number" min={0} max={5} step={0.1} value={cfg.marginLeft ?? 0.4} onChange={(e) => setCfg({ ...cfg, marginLeft: +e.target.value })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Right (mm)</Label><Input type="number" min={0} max={5} step={0.1} value={cfg.marginRight ?? 0.4} onChange={(e) => setCfg({ ...cfg, marginRight: +e.target.value })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Top (mm)</Label><Input type="number" min={0} max={5} step={0.1} value={cfg.marginTop ?? 0.4} onChange={(e) => setCfg({ ...cfg, marginTop: +e.target.value })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Bottom (mm)</Label><Input type="number" min={0} max={5} step={0.1} value={cfg.marginBottom ?? 0.4} onChange={(e) => setCfg({ ...cfg, marginBottom: +e.target.value })} className="h-8 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Print Scaling</Label><Input type="number" min={0.5} max={3} step={0.1} value={cfg.scaling ?? 1} onChange={(e) => setCfg({ ...cfg, scaling: +e.target.value })} className="h-8 text-xs" /></div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">One saved configuration for the whole workspace — garment barcodes and bag QR labels both print with these settings.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {onPreview && <Button variant="outline" className="gap-1" onClick={() => onPreview(cfg)}><Eye className="h-4 w-4" /> Preview</Button>}
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => { saveLabelConfig(cfg); setOpen(false); onSaved?.(cfg) }}><Check className="h-4 w-4" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
