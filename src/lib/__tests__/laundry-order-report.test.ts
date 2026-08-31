import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { REPORT_COLUMNS, buildReportRow, garmentsSummary, totalPieces, type ReportOrder } from '@/lib/laundry-order-report'

// ============================================================================
// ONE ROW PER ORDER — which is the whole point.
//
// Exploding garments into rows would repeat the order's money on every line and
// a three-garment order would report three times its value. Garments are
// summarised into one readable cell instead, and every money column is the
// ORDER's own stored figure, never a sum over the item lines.
//
// Pickup is LaundryOrder.pickupDate / pickupTimeSlot and nothing else.
// ============================================================================

const item = (garmentName: string, serviceName: string, quantity: number, unitPrice: number, total: number) =>
  ({ garmentName, serviceName, quantity, unitPrice, total })

const base: ReportOrder = {
  orderNumber: 'ORD-STR-000054', storeName: 'Main Store', status: 'IN_PROCESSING', orderType: 'HOME_PICKUP',
  createdAt: new Date('2026-08-29T10:30:00'),
  pickupDate: new Date('2026-08-31T00:00:00'), pickupTimeSlot: '16:00 - 18:00',
  deliveryDate: new Date('2026-09-02T00:00:00'), deliveryTimeSlot: '14:00 - 15:00',
  customerName: 'Raju', customerPhone: '+919999999999', customerEmail: 'raju@example.com', customerCode: 'CUS-1',
  address: '12 Lawgate, Jalandhar, Punjab - 144411',
  items: [item('Shirt', 'Wash & Fold', 2, 35, 70), item('Jeans', 'Dry Clean', 1, 120, 120)],
  services: ['Wash & Fold', 'Dry Clean'],
  subtotal: 190, discount: 10, gstTotal: 9, grandTotal: 189,
  amountPaid: 100, balanceDue: 89, paymentStatus: 'PARTIAL', paymentMethods: ['CASH'],
  bagNumbers: ['VBBAG086'], auditedAt: new Date('2026-08-31T18:05:00'), deliveredAt: null,
}

const col = (row: (string | number)[], name: string) => row[REPORT_COLUMNS.indexOf(name as never)]

describe('the row lines up with the header, always', () => {
  it('one value per column', () => {
    expect(buildReportRow(base)).toHaveLength(REPORT_COLUMNS.length)
  })

  it('an order with nothing on it still fills every column', () => {
    const empty: ReportOrder = {
      ...base, orderNumber: null, storeName: null, status: null, orderType: null, createdAt: null,
      pickupDate: null, pickupTimeSlot: null, deliveryDate: null, deliveryTimeSlot: null,
      customerName: null, customerPhone: null, customerEmail: null, customerCode: null, address: null,
      items: [], services: [], subtotal: null, discount: null, gstTotal: null, grandTotal: null,
      amountPaid: null, balanceDue: null, paymentStatus: null, paymentMethods: [], bagNumbers: [],
      auditedAt: null, deliveredAt: null,
    }
    const row = buildReportRow(empty)
    expect(row).toHaveLength(REPORT_COLUMNS.length)
    expect(row.every((v) => v !== undefined && v !== null)).toBe(true)
  })
})

describe('PICKUP comes from the order, and is blank when unscheduled', () => {
  it('prints the booked date and slot', () => {
    const row = buildReportRow(base)
    expect(col(row, 'Pickup Date')).toBe('31 Aug 2026')
    expect(col(row, 'Pickup Time Slot')).toBe('16:00 - 18:00')
  })

  it('an order with no pickup leaves both blank — nothing is derived', () => {
    const row = buildReportRow({ ...base, pickupDate: null, pickupTimeSlot: null })
    expect(col(row, 'Pickup Date')).toBe('')
    expect(col(row, 'Pickup Time Slot')).toBe('')
    // and specifically does NOT fall back to delivery or creation
    expect(col(row, 'Pickup Date')).not.toBe(col(row, 'Delivery Date'))
    expect(col(row, 'Pickup Date')).not.toBe(col(row, 'Created'))
  })

  it('a pickup date with no slot still reports the date', () => {
    const row = buildReportRow({ ...base, pickupTimeSlot: null })
    expect(col(row, 'Pickup Date')).toBe('31 Aug 2026')
    expect(col(row, 'Pickup Time Slot')).toBe('')
  })
})

describe('money is the ORDER’s figure — never multiplied by the garments', () => {
  it('a two-garment order reports the order total once', () => {
    const row = buildReportRow(base)
    expect(col(row, 'Subtotal')).toBe(190)
    expect(col(row, 'Discount')).toBe(10)
    expect(col(row, 'Tax')).toBe(9)
    expect(col(row, 'Total')).toBe(189)
  })

  it('adding more garments does not change any money column', () => {
    const many = { ...base, items: [...base.items, item('Towel', 'Wash & Fold', 5, 20, 100)] }
    const a = buildReportRow(base)
    const b = buildReportRow(many)
    for (const c of ['Subtotal', 'Discount', 'Tax', 'Total', 'Amount Paid', 'Balance Due']) {
      expect(col(b, c), c).toBe(col(a, c))
    }
    // only the garment-derived columns move
    expect(col(b, 'Items')).toBe(8)
    expect(col(a, 'Items')).toBe(3)
  })

  it('an order with no payment reports blanks, not zeros pretending to be paid', () => {
    const row = buildReportRow({ ...base, paymentMethods: [], paymentStatus: 'UNPAID', amountPaid: 0 })
    expect(col(row, 'Payment Method')).toBe('')
    expect(col(row, 'Payment Status')).toBe('UNPAID')
    expect(col(row, 'Amount Paid')).toBe(0)
  })
})

describe('the garments summary is readable, not a dumped object', () => {
  it('one line per garment: qty × name (service) @ rate = total', () => {
    expect(garmentsSummary(base.items)).toBe('2 × Shirt (Wash & Fold) @ 35 = 70\n1 × Jeans (Dry Clean) @ 120 = 120')
  })

  it('it contains no braces, brackets or field names', () => {
    const s = garmentsSummary(base.items)
    for (const c of ['{', '}', '[', ']', 'garmentName', 'unitPrice', 'null', 'undefined']) {
      expect(s, c).not.toContain(c)
    }
  })

  it('a garment with no price still reads sensibly', () => {
    expect(garmentsSummary([item('Curtain', 'Curtain Wash', 1, 0, 0)])).toBe('1 × Curtain (Curtain Wash)')
  })

  it('pieces are counted, not lines', () => {
    expect(totalPieces(base.items)).toBe(3)
    expect(totalPieces([])).toBe(0)
  })
})

describe('customer and operational detail', () => {
  it('carries name, mobile, email, code and address', () => {
    const row = buildReportRow(base)
    expect(col(row, 'Customer Name')).toBe('Raju')
    expect(col(row, 'Mobile')).toBe('+919999999999')
    expect(col(row, 'Email')).toBe('raju@example.com')
    expect(col(row, 'Customer Code')).toBe('CUS-1')
    expect(col(row, 'Address')).toContain('144411')
  })

  it('lists services and bags, and leaves an unbagged order blank', () => {
    expect(col(buildReportRow(base), 'Services')).toBe('Wash & Fold, Dry Clean')
    expect(col(buildReportRow(base), 'Bag Numbers')).toBe('VBBAG086')
    expect(col(buildReportRow({ ...base, bagNumbers: [] }), 'Bag Numbers')).toBe('')
  })

  it('an undelivered order has no delivered timestamp', () => {
    expect(col(buildReportRow(base), 'Delivered At')).toBe('')
    expect(col(buildReportRow(base), 'Audited At')).not.toBe('')
  })

  it('exposes no internal ids', () => {
    for (const c of REPORT_COLUMNS) expect(c.toLowerCase()).not.toMatch(/\bid\b|uuid|cuid/)
  })
})

// ── wiring: one contract, one query, one permission path ───────────────────
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ROUTE = strip(readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/route.ts'), 'utf8'))
const VIEW = strip(readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-reports-view.tsx'), 'utf8'))

describe('the report reuses the Orders query, guard and filters', () => {
  it('it is a mode of the orders endpoint, not a new one', () => {
    expect(ROUTE).toContain(`searchParams.get("report") === "1"`)
    expect(VIEW).toContain('/api/laundry/orders?')
    expect(VIEW).toContain('report: "1"')
  })

  it('it runs AFTER the permission guard and reuses the same where', () => {
    const guardAt = ROUTE.indexOf('requireLaundryPermission(request, businessId, "laundry.orders.view")')
    const reportAt = ROUTE.indexOf(`searchParams.get("report") === "1"`)
    expect(guardAt).toBeGreaterThan(-1)
    expect(reportAt).toBeGreaterThan(guardAt)
    const branch = ROUTE.slice(reportAt, ROUTE.indexOf('const [orders, total] = await Promise.all(['))
    expect(branch).toContain('where: where as never')
    // no second tenant scope, no bypass
    expect(branch).not.toContain('requireLaundryPermission')
    expect(branch).not.toMatch(/businessId:\s*businessId/)
  })

  it('the screen sends the Orders filter names, not a second language', () => {
    for (const p of ['status', 'storeId', 'search', 'from', 'to']) expect(VIEW).toContain(`p.set("${p}"`)
  })

  it('header and values come from the one column array', () => {
    expect(VIEW).toContain('REPORT_COLUMNS')
    expect(ROUTE).toContain('buildReportRow(shaped)')
  })

  it('it is bounded, and says so rather than shortening the file silently', () => {
    expect(ROUTE).toContain('take: REPORT_MAX_ROWS')
    expect(ROUTE).toContain('truncated: rows.length === REPORT_MAX_ROWS')
    expect(VIEW).toContain('j.truncated')
  })

  it('the workbook uses the existing xlsx helpers', () => {
    expect(VIEW).toContain('XLSX.utils.aoa_to_sheet')
    expect(VIEW).toContain('XLSX.utils.book_append_sheet')
    expect(VIEW).toContain('XLSX.writeFile')
  })

  it('pickup in the report is the order’s own field', () => {
    const branch = ROUTE.slice(ROUTE.indexOf(`searchParams.get("report") === "1"`), ROUTE.indexOf('const [orders, total] = await Promise.all(['))
    expect(branch).toContain('pickupDate: o.pickupDate, pickupTimeSlot: o.pickupTimeSlot')
  })
})
