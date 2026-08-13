"use client"

// Bind an input to the shared ScanEngine — the ONE way a Laundry OS screen
// receives a barcode.
//
// Every station had grown its own copy of the same three lines: an auto-focused
// input, `onKeyDown === "Enter"`, and a call straight into the screen's action.
// Written out that way each one inherited the same three faults:
//
//   • the engine stands aside for a focused editable element, so the burst was
//     never dispatched and never recorded — Hardware Manager could not see a
//     scanner that was working perfectly;
//   • Enter was the only terminator, so a Tab-suffix or no-suffix scanner did
//     nothing at all, silently;
//   • each screen re-implemented deduplication, with a different window.
//
// This hook is not a second scanner. It holds no timing, no classification and
// no deduplication of its own: it marks the field as a scan sink, hands the
// keystrokes to ScanEngine.submit(), and calls the screen back from the
// engine's own dispatch. Enter, Tab and no-suffix all arrive the same way, and
// every station shares one diagnostic trail.

import { useCallback, useEffect, useRef, useState } from "react"
import { ScanEngine } from "./scan-engine"

export interface ScanSinkProps {
  ref: React.RefObject<HTMLInputElement | null>
  "data-scan-sink": true
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
}

export interface UseScanSinkOptions {
  /** Screens that scan only in a particular mode can gate the attachment. */
  enabled?: boolean
  /** Barcodes are compared upper-case everywhere in Laundry OS. */
  upperCase?: boolean
  /** Supply a ref when the screen needs the element before this hook runs. */
  inputRef?: React.RefObject<HTMLInputElement | null>
}

/**
 * @param onScan runs once per physical scan, with the code the engine dispatched.
 * @returns props to spread onto the input that receives the scanner.
 */
export function useScanSink(
  onScan: (code: string) => void | Promise<void>,
  opts: UseScanSinkOptions = {},
): ScanSinkProps {
  const { enabled = true, upperCase = true } = opts
  const ownRef = useRef<HTMLInputElement | null>(null)
  const ref = opts.inputRef ?? ownRef
  // The latest callback, without re-attaching on every render.
  const onScanRef = useRef(onScan)
  useEffect(() => { onScanRef.current = onScan })

  // A screen may render more than one sink — Console & Receive has one for
  // receiving and one for dispatching. The engine gives the scanner to the most
  // recent attachment, so focusing a sink re-attaches it and makes it the one
  // that answers. Nothing detaches on blur: when focus drifts to the page, the
  // sink the operator last used keeps the scanner, which is the POS behaviour
  // these screens were built for.
  const [focusSeq, setFocusSeq] = useState(0)
  const takeScanner = useCallback(() => setFocusSeq((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) return
    ScanEngine.start()
    return ScanEngine.attach((e) => {
      const code = upperCase ? e.code.trim().toUpperCase() : e.code.trim()
      if (!code) return
      // The sink has served its purpose; empty it so the next garment can be
      // scanned without touching the keyboard.
      if (ref.current) ref.current.value = ""
      void onScanRef.current(code)
    })
  }, [enabled, upperCase, focusSeq])

  /**
   * A code TYPED into the sink.
   *
   * A physical scan never reaches here: the engine recognises the burst in the
   * capture phase, consumes the key and dispatches it, so this stands down on
   * `defaultPrevented` and one scan stays one action. Slow human typing is
   * below the engine's wedge threshold by design — and it still goes through
   * submit(), never straight into the screen's action.
   */
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== "Tab") return
    if (e.defaultPrevented) return
    e.preventDefault()
    const raw = e.currentTarget.value.trim()
    if (!raw) return
    e.currentTarget.value = ""
    ScanEngine.submit(upperCase ? raw.toUpperCase() : raw, "MANUAL")
  }, [upperCase])

  return { ref, "data-scan-sink": true, onKeyDown, onFocus: takeScanner }
}
