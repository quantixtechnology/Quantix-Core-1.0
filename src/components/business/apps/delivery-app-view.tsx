"use client"

// Delivery App — Business Admin page
//
// Gives the business owner everything needed to onboard delivery agents:
//   - the tenant-aware Delivery PWA URL  https://{slug}.{base}/delivery
//   - Copy Link / Share Link buttons
//   - a dynamically generated QR code agents can scan from a poster/screen
//
// White-label compatible: the URL is built from the business slug and the
// configured storefront domain — no Quantix branding is hardcoded.

import { useState, useEffect, useMemo } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/admin/shared/page-header"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import {
  Truck, Copy, Check, Share2, QrCode, Smartphone,
  ExternalLink, ShieldCheck, MapPin, Bell, IndianRupee,
} from "lucide-react"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

export function DeliveryAppView() {
  const { currentBusinessId, currentBusinessSlug, currentBusinessName } = useAdminStore()
  const { businesses } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Slug: admin store first (set on impersonation / owner login), then the
  // user's own BusinessUser record as fallback.
  const slug = currentBusinessSlug
    || businesses.find(b => b.businessId === currentBusinessId)?.businessSlug
    || ""

  const deliveryUrl = useMemo(
    () => (slug ? `https://${slug}.${SF_BASE}/delivery` : ""),
    [slug],
  )

  // Generate the QR client-side — no external service, works offline in dev
  useEffect(() => {
    if (!deliveryUrl) { setQrDataUrl(null); return }
    QRCode.toDataURL(deliveryUrl, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [deliveryUrl])

  const handleCopy = async () => {
    if (!deliveryUrl) return
    try {
      await navigator.clipboard.writeText(deliveryUrl)
      setCopied(true)
      toast.success("Delivery app link copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy — copy the link manually")
    }
  }

  const handleShare = async () => {
    if (!deliveryUrl) return
    const shareData = {
      title: `${currentBusinessName || "Delivery"} — Delivery App`,
      text: `Login to the ${currentBusinessName || ""} delivery app to receive and deliver orders.`,
      url: deliveryUrl,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* user cancelled */ }
    } else {
      handleCopy()
    }
  }

  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `${slug || "delivery"}-delivery-app-qr.png`
    a.click()
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Delivery App"
        description="Share the delivery workforce app with your delivery agents"
        icon={Truck}
      />

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
        {/* Link card */}
        <Card>
          <CardContent className="pt-5 pb-6 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">Delivery Login URL</h3>
              <Badge variant="secondary" className="text-[10px] ml-auto">Tenant-aware</Badge>
            </div>

            {deliveryUrl ? (
              <>
                <div className="rounded-xl border bg-muted/40 px-3 py-2.5 font-mono text-xs break-all select-all">
                  {deliveryUrl}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2 h-9 text-xs" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                  <Button variant="outline" className="gap-2 h-9 text-xs" onClick={handleShare}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share Link
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full gap-2 h-8 text-xs text-muted-foreground"
                  onClick={() => window.open(deliveryUrl, "_blank", "noopener")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Delivery App
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Business slug is not configured yet — the delivery URL will appear once the
                business storefront domain is set up.
              </p>
            )}

            <div className="pt-2 border-t space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">How agents log in</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open the link (or scan the QR code) on their phone</li>
                <li>Login with their registered mobile number + OTP</li>
                <li>Install the app from the &quot;Install Delivery App&quot; banner</li>
                <li>Start receiving assigned orders</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* QR card */}
        <Card>
          <CardContent className="pt-5 pb-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold">Scan to Open</h3>
            </div>

            {qrDataUrl ? (
              <>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${deliveryUrl}`}
                    className="w-56 h-56 rounded-xl border bg-white p-2"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {currentBusinessName ? `${currentBusinessName} Delivery` : "Delivery App"}
                </p>
                <Button variant="outline" className="w-full gap-2 h-9 text-xs" onClick={handleDownloadQr}>
                  <QrCode className="h-3.5 w-3.5" />
                  Download QR (PNG)
                </Button>
              </>
            ) : (
              <div className="h-56 rounded-xl border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                QR code unavailable
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature summary */}
      <Card className="mt-5 max-w-4xl">
        <CardContent className="pt-5 pb-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">What agents get</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Bell,        label: "Assigned orders in real time" },
              { icon: MapPin,      label: "One-tap Google Maps navigation" },
              { icon: ShieldCheck, label: "OTP-verified delivery" },
              { icon: IndianRupee, label: "Earnings tracking" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
