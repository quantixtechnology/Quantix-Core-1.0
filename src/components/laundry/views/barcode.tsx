"use client"

// Code128 barcode (jsbarcode → SVG). The value is the garment's GAR code
// (garmentScanCode); the human-readable text shows below the bars.
import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

export function Barcode({ value, height = 38, width = 1.3, fontSize = 10 }: { value: string; height?: number; width?: number; fontSize?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: "CODE128", height, width, fontSize, margin: 4, displayValue: true, background: "#ffffff" }) } catch { /* invalid value */ }
    }
  }, [value, height, width, fontSize])
  return <svg ref={ref} className="max-w-full" />
}
