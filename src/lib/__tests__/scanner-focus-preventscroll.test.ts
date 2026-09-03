// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { LaundryBarcodeScanner } from '@/components/laundry/laundry-barcode-scanner'

// ============================================================================
// RECLAIMING SCANNER FOCUS MUST NOT MOVE THE PAGE.
//
// The barcode field sits at the top of every workstation and takes focus back
// whenever it loses it, so a keyboard-wedge scanner always types into it. That
// is correct and stays. What was not correct is that focus() scrolls its
// element into view by default: on a long Sorting queue, clicking any button —
// "Assign First Bag" on the fifteenth order, say — gave the button focus, this
// field reclaimed it 10ms later, and the browser dragged the viewport back to
// the top of the page to show a field that already had focus.
//
// Driven against the running app with a real mouse on a 60-order queue, the
// viewport went 1223 -> 0, 2757 -> 0, 4647 -> 0, 5997 -> 0 and 11397 -> 0, with
// the reclaim recorded each time as preventScroll:false. The bag panel had
// opened correctly inside the clicked order's card throughout; the page had
// simply scrolled away from it. With preventScroll the same clicks measure a
// delta of 0 and the panel is on screen at 336px.
//
// This mounts the REAL scanner and asserts on the options it focuses with.
// ============================================================================

const SRC = readFileSync(join(process.cwd(), 'src/components/laundry/laundry-barcode-scanner.tsx'), 'utf8')

let container: HTMLDivElement
let root: Root
/** Every focus() the component performs, with the options it passed. */
let focusCalls: Array<{ id: string; preventScroll: boolean }>
let restore: () => void

beforeEach(() => {
  focusCalls = []
  const original = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function (this: HTMLElement, opts?: FocusOptions) {
    focusCalls.push({ id: this.id || this.tagName, preventScroll: !!opts?.preventScroll })
    return original.call(this, opts)
  }
  restore = () => { HTMLElement.prototype.focus = original }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  restore()
  vi.useRealTimers()
})

async function mount() {
  await act(async () => {
    root.render(React.createElement(LaundryBarcodeScanner, { onDetect: () => {}, departmentLabel: 'Sorting' }))
  })
}

const scannerFocuses = () => focusCalls.filter((f) => f.id === 'laundry-barcode-scanner-input')

describe('1 · the scanner still takes focus', () => {
  it('focuses itself once mounted', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(scannerFocuses().length).toBeGreaterThan(0)
  })
})

describe('2 · but never by scrolling the page', () => {
  it('every focus it performs passes preventScroll', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => { vi.advanceTimersByTime(200) })

    // Mount-time focus comes from React's autoFocus attribute, which takes no
    // options. That one is harmless — the page is at the top when a workstation
    // mounts, so there is nothing to scroll — and it is deliberately left
    // alone. What matters is every RECLAIM after that.
    focusCalls.length = 0

    // Losing focus to a button — exactly what "Assign First Bag" does.
    const button = document.createElement('button')
    document.body.appendChild(button)
    const input = container.querySelector('#laundry-barcode-scanner-input') as HTMLInputElement
    expect(input, 'scanner input rendered').toBeTruthy()
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: button }))
    })
    await act(async () => { vi.advanceTimersByTime(100) })
    button.remove()

    const reclaims = scannerFocuses()
    expect(reclaims.length).toBeGreaterThan(0)
    for (const f of reclaims) {
      expect(f.preventScroll, 'a scanner focus scrolled the page').toBe(true)
    }
  })

  it('a stray keystroke also reclaims focus without scrolling', async () => {
    vi.useFakeTimers()
    await mount()
    await act(async () => { vi.advanceTimersByTime(200) })
    focusCalls.length = 0
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }))
    })
    await act(async () => { vi.advanceTimersByTime(50) })
    const reclaims = scannerFocuses()
    expect(reclaims.length).toBeGreaterThan(0)
    for (const f of reclaims) expect(f.preventScroll).toBe(true)
  })
})

describe('3 · no focus call in the scanner is left scrolling', () => {
  it('the source has no bare focus() on the field', () => {
    // A future call added without the option would reintroduce the jump.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const bare = [...code.matchAll(/inputRef\.current[?]?\.focus\(([^)]*)\)/g)].map((m) => m[1].trim())
    expect(bare.length).toBeGreaterThan(0)
    for (const arg of bare) expect(arg, 'bare focus() reintroduces the scroll').toBe('FOCUS_OPTS')
    expect(code).toContain('const FOCUS_OPTS: FocusOptions = { preventScroll: true }')
  })

  it('the reclaim rules themselves are unchanged', () => {
    // Only the scroll was removed; who may take focus back is untouched.
    expect(SRC).toContain('if (!shouldReclaimFocus({ busyElsewhere: scannerBusyElsewhere(), cameraOpen, relatedTarget: e.relatedTarget, self: inputRef.current })) return')
    expect(SRC).toContain('if (isEditableTarget(o.relatedTarget ?? null, o.self)) return false')
    expect(SRC).toContain('if (o.busyElsewhere || o.cameraOpen) return false')
  })
})
