// ============================================================================
// Quantix Core — Invoice Mock Data
// GST-compliant invoice data for Indian tax law
// ============================================================================

export interface InvoiceItem {
  id: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  mrp: number;
  discount: number;
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  type: "TAX_INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | "PROFORMA" | "RECEIPT";
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

  // Seller
  sellerName: string;
  sellerAddress: string;
  sellerCity: string;
  sellerState: string;
  sellerPincode: string;
  sellerGstin: string;
  sellerPan: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerFssai?: string;

  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerPincode: string;
  buyerGstin?: string;
  buyerPan?: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerType: "B2B" | "B2C";

  // Invoice details
  placeOfSupply: string;
  isReverseCharge: boolean;
  isInterState: boolean;
  orderId: string;
  orderNumber: string;

  // Items
  items: InvoiceItem[];

  // Totals
  subtotal: number;
  totalDiscount: number;
  totalTaxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  deliveryFee: number;
  packagingFee: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;

  // Payment
  paymentMethod: string;
  paymentStatus: string;

  // Terms
  termsAndConditions: string[];
}

// ============================================================================
// Mock invoices
// ============================================================================

export const invoices: InvoiceData[] = [
  {
    id: "inv_001",
    invoiceNumber: "FM/25/01/0001",
    invoiceDate: "2025-01-15",
    dueDate: "2025-01-15",
    type: "TAX_INVOICE",
    status: "PAID",
    sellerName: "FreshMart Grocers Pvt. Ltd.",
    sellerAddress: "42 Linking Road, Bandra West",
    sellerCity: "Mumbai",
    sellerState: "Maharashtra",
    sellerPincode: "400050",
    sellerGstin: "27AABCF1234A1Z5",
    sellerPan: "AABCF1234A",
    sellerPhone: "+91 22 2640 0000",
    sellerEmail: "billing@freshmart.in",
    sellerFssai: "12345678901234",
    buyerName: "Rajesh Kumar",
    buyerAddress: "402, Lotus Apartments, Andheri West",
    buyerCity: "Mumbai",
    buyerState: "Maharashtra",
    buyerPincode: "400053",
    buyerPhone: "+91 98765 11111",
    buyerEmail: "rajesh@email.com",
    buyerType: "B2C",
    placeOfSupply: "Maharashtra",
    isReverseCharge: false,
    isInterState: false,
    orderId: "ord_893",
    orderNumber: "FM-20250115-007",
    items: [
      {
        id: "ii_001",
        name: "Amul Toned Milk 1L",
        hsnCode: "0401",
        quantity: 2,
        unit: "Pcs",
        unitPrice: 54,
        mrp: 56,
        discount: 4,
        taxableAmount: 108,
        gstRate: 5,
        cgst: 2.70,
        sgst: 2.70,
        igst: 0,
        totalAmount: 113.40,
      },
      {
        id: "ii_002",
        name: "Fresh Tomatoes 1kg",
        hsnCode: "0702",
        quantity: 1,
        unit: "Kg",
        unitPrice: 48,
        mrp: 60,
        discount: 12,
        taxableAmount: 48,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalAmount: 48,
      },
      {
        id: "ii_003",
        name: "Onion 1kg",
        hsnCode: "0703",
        quantity: 2,
        unit: "Kg",
        unitPrice: 38,
        mrp: 45,
        discount: 14,
        taxableAmount: 76,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalAmount: 76,
      },
      {
        id: "ii_004",
        name: "Maggi Noodles Pack of 4",
        hsnCode: "1902",
        quantity: 3,
        unit: "Pcs",
        unitPrice: 52,
        mrp: 56,
        discount: 12,
        taxableAmount: 156,
        gstRate: 18,
        cgst: 14.04,
        sgst: 14.04,
        igst: 0,
        totalAmount: 184.08,
      },
    ],
    subtotal: 421.48,
    totalDiscount: 42,
    totalTaxableAmount: 388,
    totalCgst: 16.74,
    totalSgst: 16.74,
    totalIgst: 0,
    totalTax: 33.48,
    deliveryFee: 30,
    packagingFee: 0,
    roundOff: -0.96,
    totalAmount: 454.48,
    amountInWords: "Four Hundred Fifty Four Rupees and Forty Eight Paise Only",
    paymentMethod: "UPI",
    paymentStatus: "COMPLETED",
    termsAndConditions: [
      "Goods once sold will not be taken back or exchanged.",
      "All disputes are subject to Mumbai jurisdiction.",
      "This is a computer-generated invoice.",
      "E&OE (Errors and Omissions Excepted).",
    ],
  },
  {
    id: "inv_002",
    invoiceNumber: "FM/25/01/0002",
    invoiceDate: "2025-01-15",
    dueDate: "2025-01-15",
    type: "TAX_INVOICE",
    status: "PAID",
    sellerName: "FreshMart Grocers Pvt. Ltd.",
    sellerAddress: "42 Linking Road, Bandra West",
    sellerCity: "Mumbai",
    sellerState: "Maharashtra",
    sellerPincode: "400050",
    sellerGstin: "27AABCF1234A1Z5",
    sellerPan: "AABCF1234A",
    sellerPhone: "+91 22 2640 0000",
    sellerEmail: "billing@freshmart.in",
    sellerFssai: "12345678901234",
    buyerName: "Sneha Patil",
    buyerAddress: "B-12, Green Valley, Powai",
    buyerCity: "Mumbai",
    buyerState: "Maharashtra",
    buyerPincode: "400076",
    buyerPhone: "+91 98765 22222",
    buyerEmail: "sneha@email.com",
    buyerType: "B2C",
    placeOfSupply: "Maharashtra",
    isReverseCharge: false,
    isInterState: false,
    orderId: "ord_888",
    orderNumber: "FM-20250115-002",
    items: [
      {
        id: "ii_005",
        name: "Basmati Rice Premium 5kg",
        hsnCode: "1006",
        quantity: 1,
        unit: "Pcs",
        unitPrice: 949,
        mrp: 1050,
        discount: 101,
        taxableAmount: 949,
        gstRate: 5,
        cgst: 23.73,
        sgst: 23.73,
        igst: 0,
        totalAmount: 996.46,
      },
      {
        id: "ii_006",
        name: "MDH Garam Masala 100g",
        hsnCode: "0910",
        quantity: 2,
        unit: "Pcs",
        unitPrice: 108,
        mrp: 120,
        discount: 24,
        taxableAmount: 216,
        gstRate: 18,
        cgst: 19.44,
        sgst: 19.44,
        igst: 0,
        totalAmount: 254.88,
      },
      {
        id: "ii_007",
        name: "Surf Excel Matic 1kg",
        hsnCode: "3402",
        quantity: 1,
        unit: "Pcs",
        unitPrice: 160,
        mrp: 175,
        discount: 15,
        taxableAmount: 160,
        gstRate: 18,
        cgst: 14.40,
        sgst: 14.40,
        igst: 0,
        totalAmount: 188.80,
      },
    ],
    subtotal: 1440.14,
    totalDiscount: 140,
    totalTaxableAmount: 1325,
    totalCgst: 57.57,
    totalSgst: 57.57,
    totalIgst: 0,
    totalTax: 115.14,
    deliveryFee: 0,
    packagingFee: 0,
    roundOff: -0.94,
    totalAmount: 1421.20,
    amountInWords: "One Thousand Four Hundred Twenty One Rupees and Twenty Paise Only",
    paymentMethod: "CARD",
    paymentStatus: "COMPLETED",
    termsAndConditions: [
      "Goods once sold will not be taken back or exchanged.",
      "All disputes are subject to Mumbai jurisdiction.",
      "This is a computer-generated invoice.",
      "E&OE (Errors and Omissions Excepted).",
    ],
  },
  {
    id: "inv_003",
    invoiceNumber: "FM/25/01/0003",
    invoiceDate: "2025-01-14",
    dueDate: "2025-01-14",
    type: "TAX_INVOICE",
    status: "PAID",
    sellerName: "FreshMart Grocers Pvt. Ltd.",
    sellerAddress: "42 Linking Road, Bandra West",
    sellerCity: "Mumbai",
    sellerState: "Maharashtra",
    sellerPincode: "400050",
    sellerGstin: "27AABCF1234A1Z5",
    sellerPan: "AABCF1234A",
    sellerPhone: "+91 22 2640 0000",
    sellerEmail: "billing@freshmart.in",
    sellerFssai: "12345678901234",
    buyerName: "TechMart Electronics",
    buyerAddress: "12, MIDC, Andheri East",
    buyerCity: "Mumbai",
    buyerState: "Maharashtra",
    buyerPincode: "400093",
    buyerGstin: "27AABCT5678B1Z3",
    buyerPan: "AABCT5678B",
    buyerPhone: "+91 22 2831 0000",
    buyerEmail: "accounts@techmart.in",
    buyerType: "B2B",
    placeOfSupply: "Maharashtra",
    isReverseCharge: false,
    isInterState: false,
    orderId: "ord_880",
    orderNumber: "FM-20250114-010",
    items: [
      {
        id: "ii_008",
        name: "Surf Excel Matic 2kg",
        hsnCode: "3402",
        quantity: 5,
        unit: "Pcs",
        unitPrice: 310,
        mrp: 340,
        discount: 150,
        taxableAmount: 1550,
        gstRate: 18,
        cgst: 139.50,
        sgst: 139.50,
        igst: 0,
        totalAmount: 1829.00,
      },
      {
        id: "ii_009",
        name: "MDH Garam Masala 200g",
        hsnCode: "0910",
        quantity: 10,
        unit: "Pcs",
        unitPrice: 207,
        mrp: 230,
        discount: 230,
        taxableAmount: 2070,
        gstRate: 18,
        cgst: 186.30,
        sgst: 186.30,
        igst: 0,
        totalAmount: 2442.60,
      },
    ],
    subtotal: 4271.60,
    totalDiscount: 380,
    totalTaxableAmount: 3620,
    totalCgst: 325.80,
    totalSgst: 325.80,
    totalIgst: 0,
    totalTax: 651.60,
    deliveryFee: 0,
    packagingFee: 0,
    roundOff: -1.20,
    totalAmount: 4271.60,
    amountInWords: "Four Thousand Two Hundred Seventy One Rupees and Sixty Paise Only",
    paymentMethod: "NETBANKING",
    paymentStatus: "COMPLETED",
    termsAndConditions: [
      "Payment terms: Net 30 days from invoice date.",
      "Late payment interest @ 18% per annum.",
      "Goods once sold will not be taken back or exchanged.",
      "All disputes are subject to Mumbai jurisdiction.",
      "This is a computer-generated invoice.",
      "E&OE (Errors and Omissions Excepted).",
    ],
  },
];
