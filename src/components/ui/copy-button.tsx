"use client"

// CopyButton — one copy affordance for the whole platform.
//
// Copying used to be silent: the value reached the clipboard but the button
// looked untouched, so people clicked it three or four times to be sure. The
// fix is feedback the eye catches without leaving the button — the icon turns
// into a green tick and the label reads "Copied" for two seconds, with a toast
// naming what was taken.
//
//   <CopyButton value={order.orderNumber} label="Order Number">Copy Order</CopyButton>
//
// Any copy action can use it: order and item numbers, customer id, GAR, bag QR,
// tracking number, payment reference, or anything added later. Nothing about it
// is laundry-specific.

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

const SUCCESS_MS = 2000

export interface CopyButtonProps {
  /** The exact text placed on the clipboard. */
  value: string
  /** What was copied, for the toast and for screen readers: "Order Number". */
  label: string
  /** Button text at rest. Defaults to `Copy {label}`. */
  children?: React.ReactNode
  size?: "sm" | "default" | "lg" | "icon"
  variant?: "default" | "outline" | "ghost" | "secondary"
  className?: string
  /** Suppress the toast when several of these sit together. */
  silent?: boolean
  onCopied?: (value: string) => void
}

/**
 * Clipboard write with a fallback.
 *
 * navigator.clipboard exists only in a secure context, so on plain http — a
 * counter machine on the LAN, say — it is simply undefined. The textarea
 * fallback is deprecated but still works there, and a copy that silently does
 * nothing is worse than a deprecated API.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function CopyButton({
  value, label, children, size = "sm", variant = "outline", className = "", silent = false, onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handle = useCallback(async () => {
    // Ignore repeat clicks while the tick is showing. Deliberately NOT the
    // `disabled` attribute: disabling a focused button moves focus to the body
    // in most browsers, so a keyboard user would lose their place mid-action.
    // aria-disabled announces the state without stealing focus.
    if (copied) return
    const ok = await writeClipboard(value)
    if (!ok) { toast.error(`Could not copy ${label}`); return }

    setCopied(true)
    if (!silent) toast.success(`✓ ${label} copied`, { description: value, duration: 2500 })
    onCopied?.(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), SUCCESS_MS)
  }, [copied, value, label, silent, onCopied])

  const idle = children ?? `Copy ${label}`

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handle}
      aria-disabled={copied}
      // Names the action for a screen reader even when the visible label is
      // just "Copy" next to an ambiguous value.
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={`gap-1.5 transition-colors duration-200 ${copied ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-50 hover:text-emerald-700" : ""} ${className}`}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-600 transition-transform duration-200 scale-110" />
        : <Copy className="h-3.5 w-3.5 transition-transform duration-200" />}
      {size !== "icon" && <span>{copied ? "Copied" : idle}</span>}
      {/* Announced once per copy; the visual swap alone is silent to a reader. */}
      <span className="sr-only" role="status" aria-live="polite">{copied ? `${label} copied` : ""}</span>
    </Button>
  )
}
