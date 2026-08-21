"use client"

// Reusable "app distribution" card — shows a PWA URL with Copy, QR code and
// WhatsApp share. Used by the Executive App panel and the Mobile Apps hub so
// link-sharing/QR behaviour lives in one place (no duplication).
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCode, Share2, ExternalLink, Download, Loader2, Smartphone } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { toast } from "sonner"
import { downloadQrPng, QR_PNG_SIZE } from "@/lib/qr-export"
import { AppQrDialog } from "@/components/laundry/apps/app-qr-dialog"

export function AppShareCard({ title, description, url, icon, note, qrDialog, primaryAction, downloadFileBase, apk }: {
  title: string; description: string; url: string; icon?: React.ReactNode; note?: string
  /**
   * The Android build for THIS app, from the mobile-provision pipeline.
   *
   * `url` is null until a build is LIVE — a half-finished build has no
   * artifact to hand out, and a download button that 404s is worse than one
   * that says it is not ready.
   */
  apk?: { url: string | null; status?: string }
  /** Optional headline action for this app, e.g. Install. */
  primaryAction?: React.ReactNode
  /**
   * Supply a filename stem to put Download PNG directly in the action row.
   *
   * Opt-in: the QR dialog already offers a download, but a button that only
   * exists behind another button is a button nobody finds. Where printing the
   * QR is the actual job, the download belongs where the operator is already
   * looking.
   */
  downloadFileBase?: string
  /**
   * Opt-in. When supplied, QR Code opens the polished print-ready dialog
   * instead of the inline preview. Only the Customer App passes it — that is
   * the QR a business actually prints for the counter and the entrance; the
   * staff apps are shared by link, so their inline preview is left alone.
   */
  qrDialog?: { businessName: string; appName: string }
}) {
  const [showQr, setShowQr] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (showQr && url) QRCode.toDataURL(url, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(null))
  }, [showQr, url])

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, "_blank")
  // The APK gets its OWN share text. Folding it into the message above would
  // change what every existing share sends.
  const whatsappApk = () => apk?.url && window.open(
    `https://wa.me/?text=${encodeURIComponent(`${title} — Android app\n${apk.url}`)}`, "_blank")

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
        {/* Optional primary action, rendered ABOVE the share row so the main
            thing to do with the app comes before the ways to pass it on. Only
            Laundry OS supplies one; every other card is unchanged. */}
        {primaryAction}
        <div className="flex gap-2 flex-wrap">
          <CopyButton value={url} label="Link" size="sm" variant="outline">Copy Link</CopyButton>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => (qrDialog ? setQrOpen(true) : setShowQr((s) => !s))}><QrCode className="h-3.5 w-3.5" /> QR Code</Button>
          {downloadFileBase && (
            <Button size="sm" variant="outline" className="gap-1" disabled={downloading || !url}
              onClick={async () => {
                setDownloading(true)
                try { await downloadQrPng(url, downloadFileBase); toast.success(`Downloaded ${QR_PNG_SIZE} × ${QR_PNG_SIZE} PNG`) }
                catch { toast.error("Could not generate the QR") }
                finally { setDownloading(false) }
              }}>
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PNG
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={whatsapp}><Share2 className="h-3.5 w-3.5" /> WhatsApp</Button>

          {/* Android build. Only rendered for apps that have one, and only
              enabled once the build is LIVE — see the `apk` prop. */}
          {apk && (apk.url ? (
            <>
              <Button asChild size="sm" variant="outline" className="gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                {/* A real link, so the browser downloads the file itself —
                    never a route into the PWA. */}
                <a href={apk.url} target="_blank" rel="noreferrer" download>
                  <Smartphone className="h-3.5 w-3.5" /> Download APK
                </a>
              </Button>
              <CopyButton value={apk.url} label="APK link" size="sm" variant="outline">Copy APK Link</CopyButton>
              <Button size="sm" variant="outline" className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={whatsappApk}>
                <Share2 className="h-3.5 w-3.5" /> Share APK
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="gap-1 text-slate-400" disabled title={apk.status ? `Build status: ${apk.status}` : undefined}>
              <Smartphone className="h-3.5 w-3.5" /> APK Not Available
            </Button>
          ))}
        </div>
        {showQr && !qrDialog && (
          <div className="flex flex-col items-center pt-1">
            {qr ? <img src={qr} alt="QR" className="h-40 w-40 rounded-lg border border-slate-100" /> : <div className="h-40 w-40 grid place-items-center text-slate-300 text-xs">Generating…</div>}
            <p className="text-[11px] text-slate-400 mt-1">Scan to open on a phone</p>
          </div>
        )}
        {note && <p className="text-[11px] text-slate-400">{note}</p>}
        {qrDialog && (
          <AppQrDialog open={qrOpen} onOpenChange={setQrOpen} url={url}
            businessName={qrDialog.businessName} appName={qrDialog.appName} />
        )}
      </CardContent>
    </Card>
  )
}
