"use client"

// Reusable "app distribution" card — shows a PWA URL with Copy, QR code and
// WhatsApp share. Used by the Executive App panel and the Mobile Apps hub so
// link-sharing/QR behaviour lives in one place (no duplication).
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, QrCode, Share2, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"

export function AppShareCard({ title, description, url, icon, note }: { title: string; description: string; url: string; icon?: React.ReactNode; note?: string }) {
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (showQr && url) QRCode.toDataURL(url, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(null))
  }, [showQr, url])

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error("Could not copy") }
  }
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, "_blank")

  return (
    <Card className="rounded-xl border-slate-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0">{icon || <ExternalLink className="h-5 w-5" />}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-600 font-mono truncate flex-1">{url}</span>
          <a href={url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600"><ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copy Link</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowQr((s) => !s)}><QrCode className="h-3.5 w-3.5" /> QR Code</Button>
          <Button size="sm" variant="outline" className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={whatsapp}><Share2 className="h-3.5 w-3.5" /> WhatsApp</Button>
        </div>
        {showQr && (
          <div className="flex flex-col items-center pt-1">
            {qr ? <img src={qr} alt="QR" className="h-40 w-40 rounded-lg border border-slate-100" /> : <div className="h-40 w-40 grid place-items-center text-slate-300 text-xs">Generating…</div>}
            <p className="text-[11px] text-slate-400 mt-1">Scan to open on a phone</p>
          </div>
        )}
        {note && <p className="text-[11px] text-slate-400">{note}</p>}
      </CardContent>
    </Card>
  )
}
