"use client"

import { useEffect, useRef, useState } from "react"

interface QrCodeProps {
  data: string
  size?: number
  className?: string
}

export function QrCode({ data, size = 200, className = "" }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import("qrcode").then((mod) => {
      if (cancelled) return
      mod.default.toDataURL(data, { width: size, margin: 1 }, (err, url) => {
        if (err || cancelled) return
        setDataUrl(url)
      })
    })
    return () => { cancelled = true }
  }, [data, size])

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/10 rounded-lg border ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-muted-foreground">Generating QR...</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="QR Code"
      className={`rounded-lg border bg-white ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
