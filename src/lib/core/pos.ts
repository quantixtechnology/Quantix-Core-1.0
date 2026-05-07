// ============================================================================
// QUANTIX CORE — POS (Point of Sale) Architecture
// Session management, thermal printing, GST invoices, daily settlement
// Indian billing standard: CGST/SGST for intra-state, IGST for inter-state
// Round-off to nearest rupee, amount in words (Lakh/Crore system)
// ============================================================================

import { db } from '@/lib/db';

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
  hsnCode?: string;
  unit?: string;
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
  convenienceFee: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  /** GST breakdown grouped by tax rate for receipt printing */
  taxBreakdown: Array<{
    rate: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
}

export interface POSSessionInfo {
  id: string;
  sessionNumber: string;
  businessId: string;
  storeId: string;
  operatorId: string;
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED';
  openingBalance: number;
  closingBalance: number | null;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalOther: number;
  totalRefunds: number;
  totalOrders: number;
  openedAt: Date;
  closedAt: Date | null;
  /** Aggregated order stats from DB */
  orderStats?: {
    completedOrders: number;
    pendingOrders: number;
    averageOrderValue: number;
  };
}

export interface PrinterConfig {
  type: 'thermal_bluetooth' | 'thermal_usb' | 'laser';
  paperSize: '58mm' | '80mm' | 'A4';
  autoPrint: boolean;
  copies: number;
  characterPerLine: number; // 32 for 58mm, 48 for 80mm
  cutPaper: boolean;
  openCashDrawer: boolean;
}

export interface ThermalReceipt {
  header: string[];
  body: string[];
  footer: string[];
  totalLines: number;
  paperSize: '58mm' | '80mm' | 'A4';
  rawText: string; // Full receipt as single string for direct printing
}

export interface POSSettlement {
  sessionId: string;
  sessionNumber: string;
  openingBalance: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalOther: number;
  totalRefunds: number;
  totalOrders: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  settledAt: Date;
}

// ============================================================================
// POS SESSION MANAGEMENT
// ============================================================================

/**
 * Open a new POS session.
 * Only one open session per store at a time.
 * Generates a session number in format: POS-YYYYMMDD-NNN
 */
export async function openPOSSession(params: {
  businessId: string;
  storeId: string;
  operatorId: string;
  openingBalance: number;
}): Promise<{ success: boolean; session?: POSSessionInfo; error?: string }> {
  // Verify store belongs to business and POS is enabled
  const store = await db.store.findFirst({
    where: {
      id: params.storeId,
      businessId: params.businessId,
      status: 'ACTIVE',
    },
  });

  if (!store) {
    return { success: false, error: 'Store not found or not active' };
  }

  if (!store.posEnabled) {
    return { success: false, error: 'POS is not enabled for this store' };
  }

  // Check for existing open session for this store
  const existingSession = await db.pOSSession.findFirst({
    where: {
      storeId: params.storeId,
      status: 'OPEN',
    },
  });

  if (existingSession) {
    return {
      success: false,
      error: `An open POS session already exists for this store (Session: ${existingSession.sessionNumber}). Close it first.`,
    };
  }

  // Generate session number: POS-YYYYMMDD-NNN
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
    session: mapSessionToInfo(session),
  };
}

/**
 * Close a POS session with daily settlement.
 * Calculates expected vs actual cash, and the difference.
 */
export async function closePOSSession(params: {
  sessionId: string;
  closingBalance: number;
}): Promise<{ success: boolean; settlement?: POSSettlement; error?: string }> {
  const session = await db.pOSSession.findUnique({
    where: { id: params.sessionId },
    include: {
      orders: {
        where: { paymentStatus: 'COMPLETED' },
      },
    },
  });

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status !== 'OPEN') {
    return { success: false, error: `Session is already ${session.status}` };
  }

  // Calculate expected cash from session totals
  const expectedCash = session.openingBalance + session.totalCash - session.totalRefunds;
  const difference = Math.round((params.closingBalance - expectedCash) * 100) / 100;

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
      totalOther: session.totalOther,
      totalRefunds: session.totalRefunds,
      totalOrders: session.totalOrders,
      expectedCash: Math.round(expectedCash * 100) / 100,
      actualCash: params.closingBalance,
      difference,
      settledAt: new Date(),
    },
  };
}

/**
 * Get a POS session with order stats.
 */
export async function getPOSSession(
  sessionId: string
): Promise<{ session?: POSSessionInfo; error?: string }> {
  const session = await db.pOSSession.findUnique({
    where: { id: sessionId },
    include: {
      orders: {
        select: {
          id: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });

  if (!session) {
    return { error: 'Session not found' };
  }

  const completedOrders = session.orders.filter((o) => o.paymentStatus === 'COMPLETED');
  const pendingOrders = session.orders.filter((o) => o.paymentStatus === 'PENDING');
  const averageOrderValue =
    completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => sum + o.totalAmount, 0) / completedOrders.length
      : 0;

  const info = mapSessionToInfo(session);
  info.orderStats = {
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
  };

  return { session: info };
}

/**
 * Get the active (open) session for a store.
 */
export async function getActiveSession(
  storeId: string
): Promise<{ session?: POSSessionInfo; error?: string }> {
  const session = await db.pOSSession.findFirst({
    where: {
      storeId,
      status: 'OPEN',
    },
    orderBy: { openedAt: 'desc' },
  });

  if (!session) {
    return { error: 'No active session found for this store' };
  }

  return { session: mapSessionToInfo(session) };
}

// ============================================================================
// CART CALCULATION — GST-aware Indian billing
// ============================================================================

/**
 * Calculate POS cart totals with GST breakdown.
 * For intra-state: CGST + SGST (each half of GST rate).
 * For inter-state: IGST (full GST rate).
 * Applies round-off to nearest rupee (Indian billing standard).
 * Groups tax by rate for receipt printing.
 */
export function calculatePOSCart(params: {
  items: POSCartItem[];
  isInterState: boolean;
  deliveryFee?: number;
  packagingFee?: number;
  convenienceFee?: number;
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

  // Group tax by rate for breakdown
  const taxByRate = new Map<number, { taxableAmount: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

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
    const gstAmount = Math.round(taxableAmount * (item.gstRate / 100) * 100) / 100;

    let itemCgst = 0;
    let itemSgst = 0;
    let itemIgst = 0;

    if (params.isInterState) {
      itemIgst = gstAmount;
      igstTotal += gstAmount;
    } else {
      itemCgst = Math.round((gstAmount / 2) * 100) / 100;
      itemSgst = Math.round((gstAmount / 2) * 100) / 100;
      cgstTotal += itemCgst;
      sgstTotal += itemSgst;
    }

    subtotal += linePrice;
    totalTax += gstAmount;

    // Accumulate tax breakdown by rate
    const existing = taxByRate.get(item.gstRate) || { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    existing.taxableAmount += taxableAmount;
    existing.cgst += itemCgst;
    existing.sgst += itemSgst;
    existing.igst += itemIgst;
    existing.totalTax += gstAmount;
    taxByRate.set(item.gstRate, existing);
  }

  const deliveryFee = params.deliveryFee || 0;
  const packagingFee = params.packagingFee || 0;
  const convenienceFee = params.convenienceFee || 0;
  let totalAmount = subtotal + totalTax + deliveryFee + packagingFee + convenienceFee;

  // Round off to nearest integer (Indian billing standard)
  let roundOff = 0;
  if (params.roundOff !== false) {
    const rounded = Math.round(totalAmount);
    roundOff = Math.round((rounded - totalAmount) * 100) / 100;
    totalAmount = rounded;
  }

  // Build tax breakdown array
  const taxBreakdown = Array.from(taxByRate.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, data]) => ({
      rate,
      taxableAmount: Math.round(data.taxableAmount * 100) / 100,
      cgst: Math.round(data.cgst * 100) / 100,
      sgst: Math.round(data.sgst * 100) / 100,
      igst: Math.round(data.igst * 100) / 100,
      totalTax: Math.round(data.totalTax * 100) / 100,
    }));

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
    convenienceFee,
    roundOff,
    totalAmount: Math.round(totalAmount * 100) / 100,
    amountInWords: numberToWords(Math.round(totalAmount)),
    taxBreakdown,
  };
}

// ============================================================================
// THERMAL RECEIPT GENERATION
// ============================================================================

/**
 * Generate a thermal receipt for printing.
 * Supports 58mm (32 chars/line), 80mm (48 chars/line), A4 formats.
 * Includes business name, GSTIN, item list, tax breakdown, total, footer.
 */
export function generateThermalReceipt(params: {
  orderNumber: string;
  date: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
    gstRate?: number;
    hsnCode?: string;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  discount?: number;
  deliveryFee?: number;
  packagingFee?: number;
  convenienceFee?: number;
  roundOff?: number;
  businessName: string;
  businessAddress?: string;
  businessGst?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessFssai?: string;
  customerName?: string;
  customerPhone?: string;
  customerGst?: string;
  paymentMethod?: string;
  paperSize: '58mm' | '80mm' | 'A4';
  taxBreakdown?: Array<{
    rate: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
  amountInWords?: string;
  footerMessage?: string;
}): ThermalReceipt {
  const charPerLine = params.paperSize === '58mm' ? 32 : params.paperSize === '80mm' ? 48 : 80;
  const divider = '-'.repeat(charPerLine);
  const doubleDivider = '='.repeat(charPerLine);
  const header: string[] = [];
  const body: string[] = [];
  const footer: string[] = [];

  // ── Header: Business Info ──
  header.push(centerText(params.businessName, charPerLine));
  if (params.businessAddress) header.push(centerText(params.businessAddress, charPerLine));
  if (params.businessPhone) header.push(centerText(`Ph: ${params.businessPhone}`, charPerLine));
  if (params.businessEmail) header.push(centerText(params.businessEmail, charPerLine));
  if (params.businessGst) header.push(centerText(`GSTIN: ${params.businessGst}`, charPerLine));
  if (params.businessFssai) header.push(centerText(`FSSAI: ${params.businessFssai}`, charPerLine));
  header.push(divider);
  header.push(centerText('TAX INVOICE', charPerLine));
  header.push(doubleDivider);

  // ── Order Info ──
  header.push(`Bill: ${params.orderNumber}`);
  header.push(`Date: ${params.date}`);
  if (params.customerName) header.push(`Customer: ${params.customerName}`);
  if (params.customerPhone) header.push(`Phone: ${params.customerPhone}`);
  if (params.customerGst) header.push(`GSTIN: ${params.customerGst}`);
  if (params.paymentMethod) header.push(`Payment: ${params.paymentMethod}`);
  header.push(divider);

  // ── Items ──
  // Format: Item Name  Qty  Rate  Amount
  const nameWidth = charPerLine <= 32 ? 14 : charPerLine <= 48 ? 22 : 36;
  const qtyWidth = 4;
  const rateWidth = charPerLine <= 32 ? 6 : 8;
  const totalWidth = charPerLine <= 32 ? 7 : 9;

  const itemHeader = 'Item'.padEnd(nameWidth) + 'Qty'.padStart(qtyWidth) + 'Rate'.padStart(rateWidth) + 'Amt'.padStart(totalWidth);
  header.push(itemHeader);
  header.push(divider);

  for (const item of params.items) {
    const name = item.name.length > nameWidth ? item.name.slice(0, nameWidth - 1) + '.' : item.name.padEnd(nameWidth);
    const qty = String(item.qty).padStart(qtyWidth);
    const price = item.price.toFixed(2).padStart(rateWidth);
    const total = item.total.toFixed(2).padStart(totalWidth);
    body.push(`${name}${qty}${price}${total}`);
  }
  body.push(divider);

  // ── Totals ──
  body.push(alignLine('Subtotal', params.subtotal.toFixed(2), charPerLine));
  if (params.discount && params.discount > 0) {
    body.push(alignLine('Discount', `-${params.discount.toFixed(2)}`, charPerLine));
  }

  // ── Tax Breakdown ──
  if (params.taxBreakdown && params.taxBreakdown.length > 0) {
    body.push('');
    body.push(centerText('Tax Breakdown', charPerLine));
    for (const tb of params.taxBreakdown) {
      if (tb.rate === 0) continue;
      body.push(`  ${tb.rate}% on ${tb.taxableAmount.toFixed(2)}`);
      if (tb.cgst > 0) {
        body.push(alignLine(`  CGST ${tb.rate / 2}%`, tb.cgst.toFixed(2), charPerLine));
      }
      if (tb.sgst > 0) {
        body.push(alignLine(`  SGST ${tb.rate / 2}%`, tb.sgst.toFixed(2), charPerLine));
      }
      if (tb.igst > 0) {
        body.push(alignLine(`  IGST ${tb.rate}%`, tb.igst.toFixed(2), charPerLine));
      }
    }
  } else {
    // Fallback simple tax display
    if (params.cgst && params.cgst > 0) {
      body.push(alignLine('CGST', params.cgst.toFixed(2), charPerLine));
    }
    if (params.sgst && params.sgst > 0) {
      body.push(alignLine('SGST', params.sgst.toFixed(2), charPerLine));
    }
    if (params.igst && params.igst > 0) {
      body.push(alignLine('IGST', params.igst.toFixed(2), charPerLine));
    }
  }

  if (params.deliveryFee && params.deliveryFee > 0) {
    body.push(alignLine('Delivery', params.deliveryFee.toFixed(2), charPerLine));
  }
  if (params.packagingFee && params.packagingFee > 0) {
    body.push(alignLine('Packaging', params.packagingFee.toFixed(2), charPerLine));
  }
  if (params.convenienceFee && params.convenienceFee > 0) {
    body.push(alignLine('Convenience', params.convenienceFee.toFixed(2), charPerLine));
  }
  if (params.roundOff && params.roundOff !== 0) {
    body.push(alignLine('Round Off', (params.roundOff > 0 ? '+' : '') + params.roundOff.toFixed(2), charPerLine));
  }

  body.push(doubleDivider);
  body.push(alignLine('TOTAL', params.totalAmount.toFixed(2), charPerLine));
  body.push(doubleDivider);

  // ── Amount in words ──
  if (params.amountInWords) {
    body.push(`Amt in words: ${params.amountInWords}`);
  }

  // ── Footer ──
  footer.push('');
  footer.push(centerText(params.footerMessage || 'Thank you for your visit!', charPerLine));
  footer.push(centerText('Powered by Quantix Technology', charPerLine));
  footer.push(centerText('www.quantixtechnology.in', charPerLine));

  const allLines = [...header, ...body, ...footer];

  return {
    header,
    body,
    footer,
    totalLines: allLines.length,
    paperSize: params.paperSize,
    rawText: allLines.join('\n'),
  };
}

// ============================================================================
// NUMBER TO WORDS — Indian Numbering System (Lakh, Crore)
// ============================================================================

/**
 * Convert a number to words using the Indian numbering system.
 * E.g., 1234567 → "Twelve Lakh Thirty Four Thousand Five Hundred and Sixty Seven"
 * Used for "Amount in Words" on invoices per Indian billing standards.
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  if (num < 0) return 'Negative ' + numberToWords(-num);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  if (rupees > 0) {
    result += convert(rupees) + ' Rupees';
  }
  if (paise > 0) {
    result += (rupees > 0 ? ' and ' : '') + convert(paise) + ' Paise';
  }
  result += ' Only';

  return result;
}

// ============================================================================
// PRINTER CONFIGURATION
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
  if (config.copies !== undefined && (config.copies < 1 || config.copies > 5)) {
    errors.push('Copies must be between 1 and 5');
  }
  if (config.characterPerLine !== undefined && (config.characterPerLine < 32 || config.characterPerLine > 80)) {
    errors.push('Characters per line must be between 32 and 80');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function mapSessionToInfo(session: {
  id: string;
  sessionNumber: string;
  businessId: string;
  storeId: string;
  operatorId: string;
  status: string;
  openingBalance: number;
  closingBalance: number | null;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalOther: number;
  totalRefunds: number;
  totalOrders: number;
  openedAt: Date;
  closedAt: Date | null;
}): POSSessionInfo {
  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    businessId: session.businessId,
    storeId: session.storeId,
    operatorId: session.operatorId,
    status: session.status as 'OPEN' | 'CLOSED' | 'SUSPENDED',
    openingBalance: session.openingBalance,
    closingBalance: session.closingBalance,
    totalSales: session.totalSales,
    totalCash: session.totalCash,
    totalCard: session.totalCard,
    totalUpi: session.totalUpi,
    totalOther: session.totalOther,
    totalRefunds: session.totalRefunds,
    totalOrders: session.totalOrders,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
  };
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

function alignLine(label: string, value: string, width: number): string {
  const space = Math.max(1, width - label.length - value.length);
  return label + ' '.repeat(space) + value;
}
