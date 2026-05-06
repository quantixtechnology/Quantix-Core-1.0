// ============================================================================
// Quantix Technology — POS (Point of Sale) Architecture
// Session management, thermal printing, GST invoices, daily settlement
// MANAGED PLATFORM: Printer config per store, GST per business
// ============================================================================

import { db } from './db';
import type { PaymentMethod, OrderType, POSSessionStatus } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface POSCartItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  discountPrice?: number;
  gstRate: number;
  isVeg?: boolean;
  sku?: string;
}

export interface POSCartSummary {
  items: POSCartItem[];
  subtotal: number;
  totalMrp: number;
  totalDiscount: number;
  totalTax: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  deliveryFee: number;
  packagingFee: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
}

export interface POSSessionInfo {
  id: string;
  sessionNumber: string;
  storeId: string;
  operatorId: string;
  status: POSSessionStatus;
  openingBalance: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalRefunds: number;
  totalOrders: number;
  openedAt: Date;
}

export interface PrinterConfig {
  type: 'thermal_bluetooth' | 'thermal_usb' | 'laser';
  paperSize: '58mm' | '80mm' | 'A4';
  autoPrint: boolean;
  copies: number;
  // Thermal-specific settings
  characterPerLine?: number; // 32 for 58mm, 48 for 80mm
  cutPaper?: boolean;
  openCashDrawer?: boolean;
}

export interface ThermalReceipt {
  header: string[];
  body: string[];
  footer: string[];
  totalLines: number;
  paperSize: '58mm' | '80mm' | 'A4';
}

// ============================================================================
// PRINTER CONFIGURATION — Per Store
// ============================================================================

/**
 * Get default printer config based on paper size.
 */
export function getDefaultPrinterConfig(paperSize: '58mm' | '80mm' | 'A4'): PrinterConfig {
  const characterPerLine = paperSize === '58mm' ? 32 : paperSize === '80mm' ? 48 : 80;
  return {
    type: paperSize === 'A4' ? 'laser' : 'thermal_usb',
    paperSize,
    autoPrint: true,
    copies: 1,
    characterPerLine,
    cutPaper: paperSize !== 'A4',
    openCashDrawer: paperSize !== 'A4',
  };
}

/**
 * Validate printer config for a store.
 */
export function validatePrinterConfig(config: Partial<PrinterConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.paperSize && !['58mm', '80mm', 'A4'].includes(config.paperSize)) {
    errors.push('Invalid paper size. Must be 58mm, 80mm, or A4');
  }

  if (config.type && !['thermal_bluetooth', 'thermal_usb', 'laser'].includes(config.type)) {
    errors.push('Invalid printer type');
  }

  if (config.copies && (config.copies < 1 || config.copies > 5)) {
    errors.push('Copies must be between 1 and 5');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// POS SESSION MANAGEMENT
// ============================================================================

/**
 * Open a new POS session.
 * Only one active session per store at a time.
 */
export async function openPOSSession(params: {
  businessId: string;
  storeId: string;
  operatorId: string;
  openingBalance: number;
}): Promise<{ success: boolean; session?: POSSessionInfo; error?: string }> {
  // Check for existing open session
  const existingSession = await db.pOSSession.findFirst({
    where: {
      storeId: params.storeId,
      status: 'OPEN',
    },
  });

  if (existingSession) {
    return {
      success: false,
      error: 'An open POS session already exists for this store. Close it first.',
    };
  }

  // Generate session number
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const sessionCount = await db.pOSSession.count({
    where: {
      businessId: params.businessId,
      openedAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });
  const sessionNumber = `POS-${dateStr}-${String(sessionCount + 1).padStart(3, '0')}`;

  const session = await db.pOSSession.create({
    data: {
      businessId: params.businessId,
      storeId: params.storeId,
      operatorId: params.operatorId,
      sessionNumber,
      status: 'OPEN',
      openingBalance: params.openingBalance,
    },
  });

  return {
    success: true,
    session: {
      id: session.id,
      sessionNumber: session.sessionNumber,
      storeId: session.storeId,
      operatorId: session.operatorId,
      status: session.status as POSSessionStatus,
      openingBalance: session.openingBalance,
      totalSales: session.totalSales,
      totalCash: session.totalCash,
      totalCard: session.totalCard,
      totalUpi: session.totalUpi,
      totalRefunds: session.totalRefunds,
      totalOrders: session.totalOrders,
      openedAt: session.openedAt,
    },
  };
}

/**
 * Close a POS session with daily settlement.
 */
export async function closePOSSession(params: {
  sessionId: string;
  closingBalance: number;
}): Promise<{ success: boolean; settlement?: POSSettlement; error?: string }> {
  const session = await db.pOSSession.findUnique({
    where: { id: params.sessionId },
    include: { orders: true },
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'OPEN') {
    return { success: false, error: 'Session is not open' };
  }

  const expectedCash = session.openingBalance + session.totalCash - session.totalRefunds;
  const difference = params.closingBalance - expectedCash;

  await db.pOSSession.update({
    where: { id: params.sessionId },
    data: {
      status: 'CLOSED',
      closingBalance: params.closingBalance,
      closedAt: new Date(),
    },
  });

  return {
    success: true,
    settlement: {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      openingBalance: session.openingBalance,
      totalSales: session.totalSales,
      totalCash: session.totalCash,
      totalCard: session.totalCard,
      totalUpi: session.totalUpi,
      totalRefunds: session.totalRefunds,
      totalOrders: session.totalOrders,
      expectedCash,
      actualCash: params.closingBalance,
      difference,
    },
  };
}

export interface POSSettlement {
  sessionId: string;
  sessionNumber: string;
  openingBalance: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalRefunds: number;
  totalOrders: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
}

// ============================================================================
// CART CALCULATION — GST-aware billing
// ============================================================================

/**
 * Calculate POS cart totals with GST breakdown.
 * For intra-state: CGST + SGST. For inter-state: IGST.
 */
export function calculatePOSCart(params: {
  items: POSCartItem[];
  isInterState: boolean;
  deliveryFee?: number;
  packagingFee?: number;
  roundOff?: boolean;
}): POSCartSummary {
  let subtotal = 0;
  let totalMrp = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;

  for (const item of params.items) {
    const lineMrp = item.mrp * item.quantity;
    const linePrice = item.unitPrice * item.quantity;
    const lineDiscount = item.discountPrice
      ? (item.mrp - item.discountPrice) * item.quantity
      : lineMrp - linePrice;

    totalMrp += lineMrp;
    totalDiscount += lineDiscount > 0 ? lineDiscount : 0;

    // GST calculation on the selling price
    const taxableAmount = linePrice;
    const gstAmount = taxableAmount * (item.gstRate / 100);

    if (params.isInterState) {
      igstTotal += gstAmount;
    } else {
      cgstTotal += gstAmount / 2;
      sgstTotal += gstAmount / 2;
    }

    subtotal += linePrice;
    totalTax += gstAmount;
  }

  const deliveryFee = params.deliveryFee || 0;
  const packagingFee = params.packagingFee || 0;
  let totalAmount = subtotal + totalTax + deliveryFee + packagingFee;

  // Round off to nearest integer (Indian billing standard)
  let roundOff = 0;
  if (params.roundOff !== false) {
    const rounded = Math.round(totalAmount);
    roundOff = rounded - totalAmount;
    totalAmount = rounded;
  }

  return {
    items: params.items,
    subtotal: Math.round(subtotal * 100) / 100,
    totalMrp: Math.round(totalMrp * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    cessTotal: Math.round(cessTotal * 100) / 100,
    deliveryFee,
    packagingFee,
    roundOff: Math.round(roundOff * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    amountInWords: numberToWords(Math.round(totalAmount)),
  };
}

// ============================================================================
// THERMAL RECEIPT GENERATION
// ============================================================================

/**
 * Generate a thermal receipt for printing.
 * Supports 58mm (32 chars), 80mm (48 chars), A4 formats.
 */
export function generateThermalReceipt(params: {
  orderNumber: string;
  date: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  discount?: number;
  deliveryFee?: number;
  businessName: string;
  businessAddress?: string;
  businessGst?: string;
  businessPhone?: string;
  customerName?: string;
  paymentMethod?: string;
  paperSize: '58mm' | '80mm' | 'A4';
}): ThermalReceipt {
  const charPerLine = params.paperSize === '58mm' ? 32 : params.paperSize === '80mm' ? 48 : 80;
  const divider = '-'.repeat(charPerLine);
  const header: string[] = [];
  const body: string[] = [];
  const footer: string[] = [];

  // Header
  header.push(centerText(params.businessName, charPerLine));
  if (params.businessAddress) header.push(centerText(params.businessAddress, charPerLine));
  if (params.businessPhone) header.push(centerText(`Ph: ${params.businessPhone}`, charPerLine));
  if (params.businessGst) header.push(centerText(`GSTIN: ${params.businessGst}`, charPerLine));
  header.push(divider);
  header.push(centerText('TAX INVOICE', charPerLine));
  header.push(divider);

  // Order info
  header.push(`Bill: ${params.orderNumber}`);
  header.push(`Date: ${params.date}`);
  if (params.customerName) header.push(`Customer: ${params.customerName}`);
  if (params.paymentMethod) header.push(`Payment: ${params.paymentMethod}`);
  header.push(divider);

  // Items
  header.push('Item                Qty   Price  Total');
  header.push(divider);
  for (const item of params.items) {
    const name = item.name.length > 18 ? item.name.slice(0, 18) : item.name.padEnd(18);
    const qty = String(item.qty).padStart(4);
    const price = String(item.price).padStart(6);
    const total = String(item.total).padStart(7);
    body.push(`${name}${qty}${price}${total}`);
  }
  body.push(divider);

  // Totals
  body.push(`Subtotal:${String(params.subtotal.toFixed(2)).padStart(charPerLine - 9)}`);
  if (params.discount && params.discount > 0) {
    body.push(`Discount:${String(params.discount.toFixed(2)).padStart(charPerLine - 9)}`);
  }
  if (params.cgst && params.cgst > 0) {
    body.push(`CGST:${String(params.cgst.toFixed(2)).padStart(charPerLine - 6)}`);
  }
  if (params.sgst && params.sgst > 0) {
    body.push(`SGST:${String(params.sgst.toFixed(2)).padStart(charPerLine - 6)}`);
  }
  if (params.igst && params.igst > 0) {
    body.push(`IGST:${String(params.igst.toFixed(2)).padStart(charPerLine - 6)}`);
  }
  if (params.deliveryFee && params.deliveryFee > 0) {
    body.push(`Delivery:${String(params.deliveryFee.toFixed(2)).padStart(charPerLine - 9)}`);
  }
  body.push(divider);
  body.push(`TOTAL:${String(params.totalAmount.toFixed(2)).padStart(charPerLine - 7)}`);
  body.push(divider);

  // Footer
  footer.push(centerText('Thank you for your visit!', charPerLine));
  footer.push(centerText('Powered by Quantix Technology', charPerLine));

  return {
    header,
    body,
    footer,
    totalLines: header.length + body.length + footer.length,
    paperSize: params.paperSize,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

/**
 * Convert a number to words (Indian numbering system).
 * Used for "Amount in Words" on invoices.
 */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = convert(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';

  return result;
}
