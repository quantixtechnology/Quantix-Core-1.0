// Shared invoice status helpers used across admin UI, customer UI, and API routes.

export type InvoicePaymentLabel = 'DRAFT' | 'PAYMENT DUE' | 'PARTIALLY PAID' | 'PAID'

/**
 * Derives the display payment label from DB status + paid/total amounts.
 * Uses a 1-cent tolerance to prevent "PARTIALLY PAID / Balance=0" edge case.
 */
export function resolveInvoiceStatus(
  dbStatus: string,
  totalAmount: number,
  paidAmount: number,
): InvoicePaymentLabel {
  if (dbStatus === 'DRAFT') return 'DRAFT'
  if (paidAmount >= totalAmount - 0.01) return 'PAID'
  if (paidAmount > 0.01) return 'PARTIALLY PAID'
  return 'PAYMENT DUE'
}

export function invoiceStatusLabel(s: InvoicePaymentLabel): string {
  return s
}

export function invoiceStatusColors(s: InvoicePaymentLabel): {
  bg: string; text: string; border: string
} {
  switch (s) {
    case 'PAID':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
    case 'PARTIALLY PAID':
      return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' }
    case 'PAYMENT DUE':
      return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' }
  }
}
