import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// In the INSTALLED PWA the storefront renders a fixed bottom navigation (plus a
// floating cart bar). It is a fixed z-50 element rendered AFTER <main>, while
// the laundry checkout dialog is a fixed z-50 element rendered INSIDE <main>.
// Neither <main> nor any ancestor creates a stacking context, so the two
// resolved in the same one at equal z-index — and at equal z-index the later
// element in the DOM paints on top. The navigation therefore covered the
// bottom of the dialog and took the tap on "Confirm Order".
//
// Reproduced in a real browser engine before fixing: elementFromPoint() at the
// centre of the button returned the nav/cart bar on iPhone 14, iPhone SE and a
// no-inset profile alike (this is CSS paint order, not an iOS quirk — iOS only
// makes the covered strip taller via env(safe-area-inset-bottom)).
//
// The rule these tests pin is a RELATIVE one: the dialog must outrank the
// navigation, and must still rank BELOW the address/map pickers that open from
// inside it — otherwise the pin picker the pickup-location fix depends on
// would open behind the sheet that launched it.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HOME = read('src/components/storefront/web/storefront-laundry-home.tsx')
const ORDERS = read('src/components/storefront/web/storefront-laundry-orders.tsx')
const LAYOUT = read('src/components/storefront/web/storefront-layout.tsx')
const ROOT_LAYOUT = read('src/app/layout.tsx')

/** z-index of the first element whose class list matches every given token. */
function zIndexOf(src: string, ...tokens: string[]): number {
  for (const line of src.split('\n')) {
    if (!tokens.every((t) => line.includes(t))) continue
    const bracket = line.match(/z-\[(\d+)\]/)
    if (bracket) return Number(bracket[1])
    const plain = line.match(/\bz-(\d+)\b/)
    if (plain) return Number(plain[1])
  }
  throw new Error(`no z-index found for tokens: ${tokens.join(' + ')}`)
}

describe('B1 · the checkout dialog outranks the PWA bottom navigation', () => {
  const navZ = zIndexOf(LAYOUT, 'fixed bottom-0 inset-x-0')
  const dialogZ = zIndexOf(HOME, 'fixed inset-0', 'items-center justify-center bg-black/40')

  it('the navigation is the fixed z-50 element it has always been', () => {
    // Pinned so that raising the nav later re-breaks this test rather than
    // silently re-covering the dialog.
    expect(navZ).toBe(50)
  })

  it('THE REGRESSION: the dialog ranks ABOVE the navigation', () => {
    expect(dialogZ).toBeGreaterThan(navZ)
  })

  it('the invoice modal ranks above the navigation too', () => {
    const invoiceZ = zIndexOf(ORDERS, 'fixed inset-0', 'items-start justify-center')
    expect(invoiceZ).toBeGreaterThan(navZ)
  })
})

describe('B1 · the fix does not create a new obstruction', () => {
  const dialogZ = zIndexOf(HOME, 'fixed inset-0', 'items-center justify-center bg-black/40')

  it('stays BELOW the address sheet and the Google place picker', () => {
    // These open FROM the checkout dialog. If the dialog outranked them, the
    // map pin picker — which the deployed pickup-location fix depends on —
    // would open behind the sheet that launched it.
    const sheetZ = zIndexOf(read('src/components/storefront/web/delivery-address-sheet.tsx'), 'fixed inset-0')
    const pickerZ = zIndexOf(read('src/components/storefront/web/google/address-picker.tsx'), 'fixed inset-0')
    expect(dialogZ).toBeLessThan(sheetZ)
    expect(dialogZ).toBeLessThan(pickerZ)
  })

  it('stays below the nav drawer, install prompt and store picker', () => {
    expect(dialogZ).toBeLessThan(zIndexOf(LAYOUT, 'fixed inset-0 z-[100]'))
    expect(dialogZ).toBeLessThan(zIndexOf(read('src/components/storefront/install-app-button.tsx'), 'fixed inset-0'))
    expect(dialogZ).toBeLessThan(zIndexOf(read('src/components/storefront/web/storefront-store-picker.tsx'), 'fixed inset-0'))
  })

  it('does not outrank the sheets that open on top of it', () => {
    // SubscriptionCheckoutSheet / SubscriptionUsageSheet are siblings rendered
    // AFTER the ServiceSheet, so an equal rank still resolves in their favour.
    // What must never happen is the checkout dialog ranking strictly higher.
    const subSheetZ = zIndexOf(read('src/components/storefront/web/subscription-usage-sheet.tsx'), 'fixed inset-0')
    expect(dialogZ).toBeLessThanOrEqual(subSheetZ)
  })
})

describe('B4 · the toast clears the iOS status bar', () => {
  it('the mobile top offset respects the safe-area inset', () => {
    const line = ROOT_LAYOUT.split('\n').find((l) => l.includes('<Toaster'))!
    expect(line).toContain('mobileOffset')
    expect(line).toContain('env(safe-area-inset-top)')
  })

  it('keeps sonner\'s 16px default where there is no inset', () => {
    // max() means the value is UNCHANGED on every device without a top inset —
    // this is what makes the change safe off-iOS. Verified in a browser:
    // max(16px, env(safe-area-inset-top)) computes to 16px with no notch.
    const line = ROOT_LAYOUT.split('\n').find((l) => l.includes('<Toaster'))!
    expect(line).toMatch(/max\(\s*16px\s*,\s*env\(safe-area-inset-top\)\s*\)/)
  })

  it('still renders top-right, and only the top side is overridden', () => {
    const line = ROOT_LAYOUT.split('\n').find((l) => l.includes('<Toaster'))!
    expect(line).toContain('position="top-right"')
    expect(line).not.toMatch(/mobileOffset=\{\{[^}]*\b(bottom|left|right)\s*:/)
  })
})

describe('no regression to the deployed pickup-location fix (5bf5f583)', () => {
  it('the coordinate gate still runs before any request', () => {
    expect(HOME).toContain('resolvePickupLocation({ selectedAddressId: selAddr, addresses, form: addrForm })')
    expect(HOME).toContain('if (!pickupLocation.ok) { toast.error(pickupLocation.reason || ""); return }')
  })

  it('the inline payload still carries the coordinates', () => {
    expect(HOME).toContain('buildStructuredPickupAddress(addrForm, { fullName: name, phone })')
  })

  it('the unpinned badge is still rendered on saved addresses', () => {
    expect(HOME).toContain('isUnpinnedAddress(a)')
    expect(HOME).toContain('UNPINNED_ADDRESS_BADGE')
  })

  it('the dialog markup is otherwise untouched — only the z-index changed', () => {
    // The overlay keeps its safe-area padding and centring; the card keeps its
    // dvh cap. This change is a layering fix, not a layout change.
    expect(HOME).toContain('pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]')
    expect(HOME).toContain('max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh]')
  })
})
