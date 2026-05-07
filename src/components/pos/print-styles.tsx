"use client";

// ============================================================================
// Quantix Core — Thermal Print CSS-in-JSX Styles
// Production print rules for 58mm, 80mm thermal printers and A4 laser
// Browser print() API integration, Bluetooth printer compatibility
// ============================================================================

export function PrintStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      /* ===== @media print — global overrides ===== */
      @media print {
        /* Hide everything except the receipt */
        body > *:not(.thermal-print-area) {
          display: none !important;
        }

        /* Reset page margins for thermal printers */
        @page {
          margin: 0;
          size: auto;
        }

        /* 58mm paper: 58mm wide, auto height */
        @page :first {
          margin-top: 0;
        }

        /* Receipt container takes full width */
        .thermal-print-area {
          position: static !important;
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
          overflow: visible !important;
        }

        /* Receipt inner padding for thermal */
        .thermal-receipt-content {
          padding: 4mm 2mm !important;
          font-size: 10pt !important;
          line-height: 1.3 !important;
        }

        /* A4 specific page sizing */
        .thermal-print-area.paper-a4 {
          @page {
            size: A4;
            margin: 10mm;
          }
          width: 210mm !important;
          max-width: 210mm !important;
        }

        /* 80mm specific page sizing */
        .thermal-print-area.paper-80mm {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          width: 80mm !important;
          max-width: 80mm !important;
        }

        /* 58mm specific page sizing */
        .thermal-print-area.paper-58mm {
          @page {
            size: 58mm auto;
            margin: 0;
          }
          width: 58mm !important;
          max-width: 58mm !important;
        }

        /* Ensure monospace for receipts */
        .thermal-receipt-content {
          font-family: 'Courier New', Courier, monospace !important;
          color: #000 !important;
          background: #fff !important;
        }

        /* Page break handling for long receipts */
        .thermal-page-break {
          page-break-before: always;
        }

        /* Avoid breaking inside items */
        .thermal-item-row {
          page-break-inside: avoid;
        }

        /* Dashed line separators should not break */
        .thermal-divider {
          page-break-after: avoid;
          page-break-before: avoid;
        }

        /* Hide non-print elements */
        .no-print,
        .print-dialog-controls,
        button,
        [role="dialog"]:not(.thermal-print-area) {
          display: none !important;
        }

        /* Ensure QR placeholder prints */
        .thermal-qr-placeholder {
          border: 2px dashed #000 !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        /* Barcode placeholder prints */
        .thermal-barcode-placeholder {
          border: 2px dashed #000 !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        /* Remove shadows and rounded corners */
        .thermal-receipt-content * {
          box-shadow: none !important;
          border-radius: 0 !important;
        }

        /* Header centering */
        .thermal-header-line {
          text-align: center !important;
        }

        /* Right-align amounts */
        .thermal-amount {
          text-align: right !important;
        }
      }

      /* ===== Screen-only styles for receipt preview ===== */
      .thermal-print-area {
        display: none;
      }

      .thermal-print-area.is-preview {
        display: block;
        position: relative;
      }

      /* Thermal receipt font on screen */
      .thermal-receipt-content {
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        line-height: 1.4;
        color: #1a1a1a;
        background: #fff;
      }

      /* Dashed separator on screen */
      .thermal-divider {
        border: none;
        border-top: 1px dashed #999;
        margin: 4px 0;
      }

      /* Double line separator */
      .thermal-double-divider {
        border: none;
        border-top: 2px double #333;
        margin: 4px 0;
      }

      /* Center aligned text */
      .thermal-header-line {
        text-align: center;
        white-space: pre-wrap;
        word-break: break-all;
      }

      /* Right-aligned amount */
      .thermal-amount {
        text-align: right;
      }

      /* QR placeholder on screen */
      .thermal-qr-placeholder {
        width: 80px;
        height: 80px;
        border: 2px dashed #aaa;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 8px auto;
        font-size: 9px;
        color: #999;
      }

      /* Barcode placeholder on screen */
      .thermal-barcode-placeholder {
        height: 40px;
        border: 2px dashed #aaa;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 8px auto;
        font-size: 9px;
        color: #999;
        font-family: 'Courier New', Courier, monospace;
        letter-spacing: 2px;
      }

      /* Item row on screen */
      .thermal-item-row {
        display: flex;
        justify-content: space-between;
        gap: 4px;
        padding: 1px 0;
      }

      /* Total line bold */
      .thermal-total-line {
        font-weight: bold;
        font-size: 14px;
      }
    ` }} />
  );
}
