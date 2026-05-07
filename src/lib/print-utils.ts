// ============================================================================
// QUANTIX CORE — Print Utilities
// Browser print integration for thermal receipts
// Supports 58mm, 80mm, and A4 paper sizes
// Bluetooth printer compatible: monochrome, no images, pure CSS
// ============================================================================

import { generateThermalReceipt, numberToWords } from '@/lib/core/pos';

// ============================================================================
// Types
// ============================================================================

export interface PrintOrder {
  orderNumber: string;
  date: string;
  time: string;
  cashier?: string;
  items: Array<{
    name: string;
    qty: number;
    rate: number;
    amount: number;
    gstRate?: number;
    hsnCode?: string;
    discount?: number;
  }>;
  subtotal: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax: number;
  deliveryFee?: number;
  packagingFee?: number;
  convenienceFee?: number;
  totalAmount: number;
  roundOff?: number;
  paymentMethod?: string;
  amountInWords?: string;
  taxBreakdown?: Array<{
    rate: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGst?: string;
}

export interface PrintBusiness {
  name: string;
  address?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  fssaiLicense?: string;
  supportPhone?: string;
  tagline?: string;
  website?: string;
}

export interface PrintStore {
  name?: string;
  address?: string;
  phone?: string;
  code?: string;
}

// ============================================================================
// Print Receipt — Opens browser print dialog with receipt content
// ============================================================================

/**
 * Print a receipt element using the browser's native print dialog.
 * Creates a hidden iframe, renders the receipt content, and triggers print.
 *
 * @param elementId - The DOM element ID containing the receipt preview
 * @param paperSize - Paper size: '58mm', '80mm', or 'A4'
 */
export function printReceipt(
  elementId: string,
  paperSize: '58mm' | '80mm' | 'A4'
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[PrintUtils] Element #${elementId} not found`);
    return;
  }

  // Try to get raw text from data attribute first
  const rawText = element.getAttribute('data-receipt-raw') || '';

  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            ${getPrintStyles(paperSize)}
          </style>
        </head>
        <body>
          ${rawText ? `<pre>${escapeHtml(rawText)}</pre>` : element.innerHTML}
        </body>
      </html>
    `);
    doc.close();
  }

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback to window.print()
      window.print();
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
}

// ============================================================================
// Generate Print HTML — Returns full HTML string for a receipt
// ============================================================================

/**
 * Generate a complete HTML document for printing a receipt.
 * Useful for server-side rendering or downloading as HTML file.
 *
 * @param order - Order details
 * @param business - Business details
 * @param paperSize - Paper size
 * @returns Complete HTML string
 */
export function generatePrintHTML(
  order: PrintOrder,
  business: PrintBusiness,
  paperSize: string
): string {
  const receipt = generateThermalReceipt({
    orderNumber: order.orderNumber,
    date: `${order.date} ${order.time}`,
    items: order.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.rate,
      total: item.amount,
      gstRate: item.gstRate,
      hsnCode: item.hsnCode,
    })),
    subtotal: order.subtotal,
    totalTax: order.totalTax,
    totalAmount: order.totalAmount,
    cgst: order.cgst,
    sgst: order.sgst,
    igst: order.igst,
    discount: order.discount,
    deliveryFee: order.deliveryFee,
    packagingFee: order.packagingFee,
    convenienceFee: order.convenienceFee,
    roundOff: order.roundOff,
    businessName: business.name,
    businessAddress: business.address,
    businessGst: business.gstNumber,
    businessPhone: business.phone,
    businessEmail: business.email,
    businessFssai: business.fssaiLicense,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerGst: order.customerGst,
    paymentMethod: order.paymentMethod,
    paperSize: paperSize as '58mm' | '80mm' | 'A4',
    taxBreakdown: order.taxBreakdown,
    amountInWords:
      order.amountInWords || numberToWords(Math.round(order.totalAmount)),
    footerMessage: `Thank you for shopping at ${business.name}!`,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    ${getPrintStyles(paperSize)}
  </style>
</head>
<body>
  <pre>${escapeHtml(receipt.rawText)}</pre>
</body>
</html>`;
}

// ============================================================================
// Get Print Styles — CSS for @media print and screen
// ============================================================================

/**
 * Get CSS styles for printing receipts.
 * Handles @media print rules, page sizing for thermal/laser printers,
 * and monospace font formatting.
 *
 * @param paperSize - Paper size
 * @returns CSS string
 */
export function getPrintStyles(paperSize: string): string {
  const pageSizeRule =
    paperSize === '58mm'
      ? 'size: 58mm auto;'
      : paperSize === '80mm'
        ? 'size: 80mm auto;'
        : 'size: A4;';

  const pageMargin =
    paperSize === 'A4' ? 'margin: 10mm;' : 'margin: 0;';

  const bodyPadding =
    paperSize === '58mm'
      ? 'padding: 2mm 1mm;'
      : paperSize === '80mm'
        ? 'padding: 4mm 2mm;'
        : 'padding: 10mm 15mm;';

  const fontSize =
    paperSize === '58mm'
      ? 'font-size: 8pt;'
      : paperSize === '80mm'
        ? 'font-size: 9pt;'
        : 'font-size: 10pt;';

  return `
    /* ===== Reset ===== */
    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* ===== Page Setup ===== */
    @page {
      ${pageSizeRule}
      ${pageMargin}
    }

    @page :first {
      margin-top: 0;
    }

    /* ===== Body ===== */
    body {
      margin: 0;
      ${bodyPadding}
      font-family: 'Courier New', Courier, monospace;
      ${fontSize}
      line-height: 1.3;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ===== Pre-formatted Receipt ===== */
    pre {
      margin: 0;
      padding: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }

    /* ===== Print-specific Rules ===== */
    @media print {
      /* Remove any extra margins/padding */
      body {
        margin: 0 !important;
        ${bodyPadding.replace(';', ' !important;')}
      }

      /* Ensure no page break inside items */
      pre {
        page-break-inside: avoid;
      }

      /* Remove all non-essential elements */
      .no-print,
      .print-dialog-controls,
      button,
      nav,
      header,
      footer,
      aside {
        display: none !important;
      }

      /* Force monochrome for Bluetooth printer compatibility */
      * {
        color: #000 !important;
        background: #fff !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
    }

    /* ===== Screen Preview ===== */
    @media screen {
      body {
        max-width: ${paperSize === '58mm' ? '232px' : paperSize === '80mm' ? '320px' : '595px'};
        margin: 0 auto;
        border: 1px dashed #ccc;
      }
    }
  `;
}

// ============================================================================
// Internal Helpers
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
