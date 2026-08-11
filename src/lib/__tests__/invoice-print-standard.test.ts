import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { billToBlock } from '@/lib/laundry-bill-to'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// Every surface that renders a printable invoice must carry the timestamp, and
// must get it from the ONE shared formatter rather than its own Date handling.
const SURFACES = [
  'src/components/laundry/invoice/laundry-invoice-document.tsx',   // Laundry A4
  'src/components/laundry/invoice/laundry-thermal-receipt.tsx',    // Laundry 58/80mm
  'src/lib/document-renderer.ts',                                  // Commerce
  'src/app/api/admin/billing/invoices/[invoiceId]/download/route.ts',
]

describe('Printed On appears on every printable invoice', () => {
  for (const f of SURFACES) {
    it(`${f} renders it`, () => {
      const src = read(f)
      expect(src).toMatch(/printedOnLine|formatPrintedAt/)
      expect(src).toContain('@/lib/print-timestamp')
    })
  }

  it('Commerce stamps BOTH of its invoice builders', () => {
    const src = read('src/lib/document-renderer.ts')
    expect(src.match(/printedOnLine\(\)/g)).toHaveLength(2)
  })

  // The whole point of the shared module: no second timezone or format.
  it('no surface hand-rolls its own print timestamp', () => {
    for (const f of SURFACES) {
      expect(read(f)).not.toMatch(/Printed On:\s*\$\{/)
    }
  })
})

describe('previously-fixed behaviour must not regress', () => {
  it('the invoice number cannot wrap', () => {
    const doc = read('src/components/laundry/invoice/laundry-invoice-document.tsx')
    // The number line itself, and the block that used to be squeezed.
    expect(doc).toMatch(/whitespace-nowrap font-mono[^>]*>\{invoice\?\.number/)
    expect(doc).toContain('shrink-0 pl-3 text-right')

    expect(read('src/components/laundry/invoice/laundry-thermal-receipt.tsx'))
      .toMatch(/whitespace-nowrap font-bold">\{invoice\?\.number/)

    expect(read('src/app/api/admin/billing/invoices/[invoiceId]/download/route.ts'))
      .toMatch(/\.inv-no \{[^}]*white-space: nowrap/)
  })

  it('the customer still appears exactly once', () => {
    const b = billToBlock(
      { name: 'Mukhtar Khan', phone: '+917350551170', email: 'mukhtarkhan143@gmail.com' },
      'Mukhtar Khan · +917350551170\nBengaluru\nBengaluru, Karnataka - 560064',
    )
    expect(b.addressLines).toEqual(['Bengaluru, Karnataka - 560064'])
  })

  it('both laundry templates build BILL TO through the deduplicating helper', () => {
    for (const f of SURFACES.slice(0, 2)) {
      expect(read(f)).toContain('billToBlock')
    }
  })

  // Invoice Date and Printed On are different facts and must both survive.
  it('keeps the issue date alongside the print time', () => {
    expect(read('src/components/laundry/invoice/laundry-invoice-document.tsx')).toContain('Invoice Date:')
    expect(read('src/components/laundry/invoice/laundry-thermal-receipt.tsx')).toContain('Date: {fmtDate(')
  })
})
