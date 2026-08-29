/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isEditableTarget, shouldReclaimFocus } from '@/components/laundry/laundry-barcode-scanner'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const SCANNER = 'src/components/laundry/laundry-barcode-scanner.tsx'

const el = (tag: string) => document.createElement(tag)

describe('THE BUG · clicking the garment search box lost focus 10ms later', () => {
  it('the scanner does NOT reclaim focus when focus moved to another input', () => {
    const scanner = el('input')
    const search = el('input')
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: search, self: scanner })).toBe(false)
  })

  it('…nor on the delayed re-check, when the search box now holds focus', () => {
    const scanner = el('input')
    const search = el('input')
    // relatedTarget is null on some paths — the timer checks activeElement too.
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: null, activeElement: search, self: scanner })).toBe(false)
  })

  it('textarea, select and contenteditable are protected the same way', () => {
    const scanner = el('input')
    for (const t of ['textarea', 'select']) {
      expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: el(t), self: scanner }), t).toBe(false)
    }
    const ce = el('div'); ce.setAttribute('contenteditable', 'true')
    Object.defineProperty(ce, 'isContentEditable', { value: true })
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: ce, self: scanner })).toBe(false)
  })
})

describe('the scanner keeps working hands-free', () => {
  it('reclaims focus when focus went nowhere — a click on empty page area', () => {
    const scanner = el('input')
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: null, activeElement: document.body, self: scanner })).toBe(true)
  })

  it('reclaims focus when focus went to a button, not a text field', () => {
    const scanner = el('input')
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: el('button'), self: scanner })).toBe(true)
  })

  it('losing focus to ITSELF is not a reason to stand aside', () => {
    const scanner = el('input')
    expect(isEditableTarget(scanner, scanner)).toBe(false)
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: scanner, self: scanner })).toBe(true)
  })

  it('stands aside while a dialog owns the scanner', () => {
    expect(shouldReclaimFocus({ busyElsewhere: true, relatedTarget: null })).toBe(false)
  })

  it('stands aside while the camera is open', () => {
    expect(shouldReclaimFocus({ busyElsewhere: false, cameraOpen: true, relatedTarget: null })).toBe(false)
  })
})

describe('the component actually uses the rule', () => {
  const src = code(SCANNER)

  it('focusout consults it, with the element focus is moving TO', () => {
    expect(src).toContain('const onFocusOut = (e: FocusEvent) => {')
    expect(src).toContain('relatedTarget: e.relatedTarget')
    expect(src).toContain('shouldReclaimFocus({ busyElsewhere: scannerBusyElsewhere()')
  })

  it('the delayed re-check consults it too, using activeElement', () => {
    const fo = src.slice(src.indexOf('const onFocusOut'), src.indexOf('const onKeyDoc'))
    expect(fo).toContain('activeElement: document.activeElement')
    // and no longer refocuses unconditionally
    expect(fo).not.toMatch(/if \(!scannerBusyElsewhere\(\)\) inputRef\.current\?\.focus\(\)/)
  })

  it('the keydown handler shares the one implementation', () => {
    expect(src).toContain('if (isEditableTarget(e.target, inputRef.current)) return')
  })

  it('the scanner input itself is untouched — still a scan sink, still autofocus', () => {
    // The sink props (including data-scan-sink) are spread from the hook.
    expect(src).toContain('useScanSink')
    expect(src).toContain('{...scanProps}')
    expect(src).toContain('autoFocus')
  })
})

describe('the search input is a plain, editable field', () => {
  it.each([
    'src/components/laundry/views/laundry-workstation.tsx',
    'src/components/laundry/views/laundry-drying-qc-workstation.tsx',
  ])('%s renders it with no disabled/readOnly and no key', (f) => {
    const src = read(f)
    const at = src.indexOf('value={search}')
    expect(at).toBeGreaterThan(-1)
    const input = src.slice(Math.max(0, at - 200), at + 500)
    expect(input).not.toContain('disabled')
    expect(input).not.toContain('readOnly')
    expect(input).not.toContain('key=')
    expect(input).toContain('onChange={(e) => setSearch(e.target.value)}')
  })

  it('it is NOT a scan sink — the scanner owns its own field only', () => {
    for (const f of ['src/components/laundry/views/laundry-workstation.tsx', 'src/components/laundry/views/laundry-drying-qc-workstation.tsx']) {
      const src = read(f)
      const at = src.indexOf('value={search}')
      expect(src.slice(at - 200, at + 500)).not.toContain('data-scan-sink')
    }
  })

  it('paste is not intercepted anywhere near it', () => {
    for (const f of [SCANNER, 'src/components/laundry/views/laundry-workstation.tsx']) {
      expect(code(f)).not.toContain('onPaste')
      expect(code(f)).not.toContain('preventDefault()')
    }
  })
})
