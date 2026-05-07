"use client"

// ============================================================================
// Quantix Technology — Business Owner Panel Mock Data
// FreshMart Grocers (GROCERY) — Business ID: biz_1
// ============================================================================

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DRAFT" | "OUT_OF_STOCK";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
export type StoreDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

// Categories
export const categories = [
  { id: "cat_1", name: "Fruits & Vegetables", slug: "fruits-vegetables", productCount: 48, icon: "Apple", color: "#10B981", sortOrder: 1 },
  { id: "cat_2", name: "Dairy & Eggs", slug: "dairy-eggs", productCount: 32, icon: "Milk", color: "#3B82F6", sortOrder: 2 },
  { id: "cat_3", name: "Bakery", slug: "bakery", productCount: 18, icon: "Croissant", color: "#F59E0B", sortOrder: 3 },
  { id: "cat_4", name: "Snacks & Chips", slug: "snacks-chips", productCount: 56, icon: "Cookie", color: "#EF4444", sortOrder: 4 },
  { id: "cat_5", name: "Beverages", slug: "beverages", productCount: 42, icon: "Coffee", color: "#8B5CF6", sortOrder: 5 },
  { id: "cat_6", name: "Rice & Grains", slug: "rice-grains", productCount: 24, icon: "Wheat", color: "#D97706", sortOrder: 6 },
  { id: "cat_7", name: "Spices & Masala", slug: "spices-masala", productCount: 36, icon: "Flame", color: "#DC2626", sortOrder: 7 },
  { id: "cat_8", name: "Personal Care", slug: "personal-care", productCount: 29, icon: "Sparkles", color: "#EC4899", sortOrder: 8 },
  { id: "cat_9", name: "Cleaning", slug: "cleaning", productCount: 21, icon: "SprayCan", color: "#0891B2", sortOrder: 9 },
  { id: "cat_10", name: "Frozen Foods", slug: "frozen-foods", productCount: 15, icon: "Snowflake", color: "#6366F1", sortOrder: 10 },
];

// Products with variants
export const products = [
  { id: "prod_1", name: "Amul Toned Milk", slug: "amul-toned-milk", categoryId: "cat_2", category: "Dairy & Eggs", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: true, image: "", variants: [
    { id: "var_1", name: "500ml", sku: "AML-MLK-500", mrp: 28, price: 27, stock: 150, isDefault: true },
    { id: "var_2", name: "1L", sku: "AML-MLK-1L", mrp: 56, price: 54, stock: 85, isDefault: false },
  ]},
  { id: "prod_2", name: "Britannia Bread", slug: "britannia-bread", categoryId: "cat_3", category: "Bakery", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_3", name: "White - 400g", sku: "BRT-BRD-400", mrp: 45, price: 42, stock: 40, isDefault: true },
  ]},
  { id: "prod_3", name: "Basmati Rice Premium", slug: "basmati-rice-premium", categoryId: "cat_6", category: "Rice & Grains", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: true, image: "", variants: [
    { id: "var_4", name: "1kg", sku: "BSM-RCE-1K", mrp: 220, price: 195, stock: 60, isDefault: true },
    { id: "var_5", name: "5kg", sku: "BSM-RCE-5K", mrp: 1050, price: 949, stock: 25, isDefault: false },
  ]},
  { id: "prod_4", name: "Lays Classic Chips", slug: "lays-classic-chips", categoryId: "cat_4", category: "Snacks & Chips", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_6", name: "52g", sku: "LYS-CLS-52", mrp: 20, price: 20, stock: 200, isDefault: true },
    { id: "var_7", name: "130g", sku: "LYS-CLS-130", mrp: 50, price: 48, stock: 120, isDefault: false },
  ]},
  { id: "prod_5", name: "Fresh Tomatoes", slug: "fresh-tomatoes", categoryId: "cat_1", category: "Fruits & Vegetables", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: true, image: "", variants: [
    { id: "var_8", name: "1kg", sku: "FRS-TOM-1K", mrp: 60, price: 48, stock: 80, isDefault: true },
  ]},
  { id: "prod_6", name: "MDH Garam Masala", slug: "mdh-garam-masala", categoryId: "cat_7", category: "Spices & Masala", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_9", name: "100g", sku: "MDH-GM-100", mrp: 120, price: 108, stock: 45, isDefault: true },
    { id: "var_10", name: "200g", sku: "MDH-GM-200", mrp: 230, price: 207, stock: 30, isDefault: false },
  ]},
  { id: "prod_7", name: "Coca Cola", slug: "coca-cola", categoryId: "cat_5", category: "Beverages", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_11", name: "750ml", sku: "COK-750", mrp: 40, price: 38, stock: 180, isDefault: true },
    { id: "var_12", name: "2L", sku: "COK-2L", mrp: 90, price: 85, stock: 65, isDefault: false },
  ]},
  { id: "prod_8", name: "Surf Excel Matic", slug: "surf-excel-matic", categoryId: "cat_9", category: "Cleaning", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_13", name: "1kg", sku: "SRF-MAT-1K", mrp: 175, price: 160, stock: 35, isDefault: true },
    { id: "var_14", name: "2kg", sku: "SRF-MAT-2K", mrp: 340, price: 310, stock: 20, isDefault: false },
  ]},
  { id: "prod_9", name: "Green Capsicum", slug: "green-capsicum", categoryId: "cat_1", category: "Fruits & Vegetables", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_15", name: "500g", sku: "FRS-CAP-500", mrp: 55, price: 45, stock: 30, isDefault: true },
  ]},
  { id: "prod_10", name: "Maggi Noodles", slug: "maggi-noodles", categoryId: "cat_4", category: "Snacks & Chips", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: true, image: "", variants: [
    { id: "var_16", name: "Pack of 4", sku: "MGG-4PK", mrp: 56, price: 52, stock: 250, isDefault: true },
    { id: "var_17", name: "Pack of 12", sku: "MGG-12PK", mrp: 168, price: 152, stock: 80, isDefault: false },
  ]},
  { id: "prod_11", name: "Amul Butter", slug: "amul-butter", categoryId: "cat_2", category: "Dairy & Eggs", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: true, image: "", variants: [
    { id: "var_18", name: "100g", sku: "AML-BTR-100", mrp: 56, price: 54, stock: 70, isDefault: true },
    { id: "var_19", name: "500g", sku: "AML-BTR-500", mrp: 270, price: 260, stock: 25, isDefault: false },
  ]},
  { id: "prod_12", name: "Frozen Peas", slug: "frozen-peas", categoryId: "cat_10", category: "Frozen Foods", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_20", name: "500g", sku: "FRZ-PES-500", mrp: 130, price: 118, stock: 40, isDefault: true },
  ]},
  { id: "prod_13", name: "Onion", slug: "onion", categoryId: "cat_1", category: "Fruits & Vegetables", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_21", name: "1kg", sku: "FRS-ONI-1K", mrp: 45, price: 38, stock: 200, isDefault: true },
  ]},
  { id: "prod_14", name: "Parle-G Biscuit", slug: "parle-g-biscuit", categoryId: "cat_4", category: "Snacks & Chips", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_22", name: "100g", sku: "PRL-G-100", mrp: 10, price: 10, stock: 500, isDefault: true },
    { id: "var_23", name: "800g", sku: "PRL-G-800", mrp: 72, price: 68, stock: 60, isDefault: false },
  ]},
  { id: "prod_15", name: "Dove Shampoo", slug: "dove-shampoo", categoryId: "cat_8", category: "Personal Care", status: "ACTIVE" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_24", name: "180ml", sku: "DV-SH-180", mrp: 145, price: 130, stock: 28, isDefault: true },
  ]},
  { id: "prod_16", name: "Red Bell Pepper", slug: "red-bell-pepper", categoryId: "cat_1", category: "Fruits & Vegetables", status: "OUT_OF_STOCK" as ProductStatus, isVeg: true, isFeatured: false, image: "", variants: [
    { id: "var_25", name: "250g", sku: "FRS-RBP-250", mrp: 80, price: 70, stock: 0, isDefault: true },
  ]},
];

// Business Orders (FreshMart Grocers)
export const businessOrders = [
  { id: "ord_1", orderNumber: "FM-20250115-001", type: "DELIVERY" as const, status: "PENDING" as const, customerName: "Rajesh Kumar", customerPhone: "+91 98765 11111", items: [
    { name: "Amul Toned Milk 1L", qty: 2, price: 54 },
    { name: "Fresh Tomatoes 1kg", qty: 1, price: 48 },
    { name: "Onion 1kg", qty: 2, price: 38 },
    { name: "Maggi Noodles Pack of 4", qty: 3, price: 52 },
  ], subtotal: 340, deliveryFee: 30, tax: 26.64, total: 396.64, paymentMethod: "UPI", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 10:30", deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053", assignedTo: null },
  { id: "ord_2", orderNumber: "FM-20250115-002", type: "DELIVERY" as const, status: "CONFIRMED" as const, customerName: "Sneha Patil", customerPhone: "+91 98765 22222", items: [
    { name: "Basmati Rice Premium 5kg", qty: 1, price: 949 },
    { name: "MDH Garam Masala 100g", qty: 2, price: 108 },
    { name: "Surf Excel Matic 1kg", qty: 1, price: 160 },
  ], subtotal: 1325, deliveryFee: 0, tax: 96.20, total: 1421.20, paymentMethod: "CARD", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 11:15", deliveryAddress: "B-12, Green Valley, Powai, Mumbai 400076", assignedTo: "Ramesh K." },
  { id: "ord_3", orderNumber: "FM-20250115-003", type: "DELIVERY" as const, status: "PREPARING" as const, customerName: "Anand Joshi", customerPhone: "+91 98765 33333", items: [
    { name: "Amul Butter 500g", qty: 1, price: 260 },
    { name: "Britannia Bread 400g", qty: 2, price: 42 },
    { name: "Coca Cola 2L", qty: 2, price: 85 },
  ], subtotal: 514, deliveryFee: 30, tax: 39.12, total: 583.12, paymentMethod: "UPI", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 11:45", deliveryAddress: "701, Skyline Tower, Juhu, Mumbai 400049", assignedTo: "Suresh M." },
  { id: "ord_4", orderNumber: "FM-20250115-004", type: "POS" as const, status: "DELIVERED" as const, customerName: "Walk-in Customer", customerPhone: "", items: [
    { name: "Parle-G Biscuit 800g", qty: 2, price: 68 },
    { name: "Maggi Noodles Pack of 12", qty: 1, price: 152 },
    { name: "Lays Classic Chips 130g", qty: 4, price: 48 },
  ], subtotal: 464, deliveryFee: 0, tax: 0, total: 464, paymentMethod: "CASH", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 09:20", deliveryAddress: null, assignedTo: null },
  { id: "ord_5", orderNumber: "FM-20250115-005", type: "DELIVERY" as const, status: "OUT_FOR_DELIVERY" as const, customerName: "Mohan Sharma", customerPhone: "+91 98765 55555", items: [
    { name: "Green Capsicum 500g", qty: 2, price: 45 },
    { name: "Frozen Peas 500g", qty: 1, price: 118 },
    { name: "Dove Shampoo 180ml", qty: 1, price: 130 },
    { name: "Amul Toned Milk 500ml", qty: 3, price: 27 },
  ], subtotal: 394, deliveryFee: 30, tax: 30.48, total: 454.48, paymentMethod: "UPI", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 12:00", deliveryAddress: "23, Hill View Road, Bandra West, Mumbai 400050", assignedTo: "Ramesh K." },
  { id: "ord_6", orderNumber: "FM-20250115-006", type: "DELIVERY" as const, status: "DELIVERED" as const, customerName: "Kavita Reddy", customerPhone: "+91 98765 66666", items: [
    { name: "Basmati Rice Premium 1kg", qty: 2, price: 195 },
    { name: "Amul Butter 100g", qty: 1, price: 54 },
  ], subtotal: 444, deliveryFee: 30, tax: 34.08, total: 508.08, paymentMethod: "UPI", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-15 08:15", deliveryAddress: "A-401, Palm Residency, Goregaon, Mumbai 400062", assignedTo: "Suresh M." },
  { id: "ord_7", orderNumber: "FM-20250114-007", type: "DELIVERY" as const, status: "CANCELLED" as const, customerName: "Deepa Nair", customerPhone: "+91 98765 44444", items: [
    { name: "Coca Cola 750ml", qty: 6, price: 38 },
    { name: "Lays Classic Chips 52g", qty: 10, price: 20 },
  ], subtotal: 428, deliveryFee: 30, tax: 33.12, total: 491.12, paymentMethod: "UPI", paymentStatus: "REFUNDED" as const, createdAt: "2025-01-14 16:30", deliveryAddress: "15, Sea View, Versova, Mumbai 400061", assignedTo: null },
  { id: "ord_8", orderNumber: "FM-20250114-008", type: "POS" as const, status: "DELIVERED" as const, customerName: "Walk-in Customer", customerPhone: "", items: [
    { name: "Surf Excel Matic 2kg", qty: 1, price: 310 },
    { name: "MDH Garam Masala 200g", qty: 1, price: 207 },
  ], subtotal: 517, deliveryFee: 0, tax: 0, total: 517, paymentMethod: "CASH", paymentStatus: "COMPLETED" as const, createdAt: "2025-01-14 14:10", deliveryAddress: null, assignedTo: null },
];

// Business Customers (FreshMart)
export const businessCustomers = [
  { id: "bcust_1", name: "Rajesh Kumar", phone: "+91 98765 11111", email: "rajesh@email.com", totalOrders: 24, totalSpent: 28500, loyaltyPoints: 1420, tier: "GOLD", lastOrder: "2025-01-15", addresses: [
    { id: "addr_1", label: "Home", line1: "402, Lotus Apartments", line2: "Andheri West", city: "Mumbai", pincode: "400053", isDefault: true },
  ]},
  { id: "bcust_2", name: "Sneha Patil", phone: "+91 98765 22222", email: "sneha@email.com", totalOrders: 12, totalSpent: 8400, loyaltyPoints: 420, tier: "SILVER", lastOrder: "2025-01-15", addresses: [
    { id: "addr_2", label: "Home", line1: "B-12, Green Valley", line2: "Powai", city: "Mumbai", pincode: "400076", isDefault: true },
  ]},
  { id: "bcust_3", name: "Anand Joshi", phone: "+91 98765 33333", email: "anand@email.com", totalOrders: 36, totalSpent: 16200, loyaltyPoints: 810, tier: "GOLD", lastOrder: "2025-01-15", addresses: [
    { id: "addr_3", label: "Home", line1: "701, Skyline Tower", line2: "Juhu", city: "Mumbai", pincode: "400049", isDefault: true },
  ]},
  { id: "bcust_4", name: "Deepa Nair", phone: "+91 98765 44444", email: "deepa@email.com", totalOrders: 8, totalSpent: 5600, loyaltyPoints: 280, tier: "BRONZE", lastOrder: "2025-01-14", addresses: [
    { id: "addr_4", label: "Home", line1: "15, Sea View", line2: "Versova", city: "Mumbai", pincode: "400061", isDefault: true },
  ]},
  { id: "bcust_5", name: "Mohan Sharma", phone: "+91 98765 55555", email: "mohan@email.com", totalOrders: 52, totalSpent: 78000, loyaltyPoints: 3900, tier: "PLATINUM", lastOrder: "2025-01-15", addresses: [
    { id: "addr_5", label: "Home", line1: "23, Hill View Road", line2: "Bandra West", city: "Mumbai", pincode: "400050", isDefault: true },
    { id: "addr_6", label: "Office", line1: "512,商业Tower", line2: "BKC", city: "Mumbai", pincode: "400051", isDefault: false },
  ]},
  { id: "bcust_6", name: "Kavita Reddy", phone: "+91 98765 66666", email: "kavita@email.com", totalOrders: 3, totalSpent: 1680, loyaltyPoints: 84, tier: "BRONZE", lastOrder: "2025-01-15", addresses: [
    { id: "addr_7", label: "Home", line1: "A-401, Palm Residency", line2: "Goregaon", city: "Mumbai", pincode: "400062", isDefault: true },
  ]},
];

// Delivery Partners
export const deliveryPartners = [
  { id: "dp_1", name: "Ramesh K.", phone: "+91 91111 11111", status: "ONLINE" as const, activeOrders: 2, totalDeliveries: 458, rating: 4.7 },
  { id: "dp_2", name: "Suresh M.", phone: "+91 92222 22222", status: "ONLINE" as const, activeOrders: 1, totalDeliveries: 312, rating: 4.5 },
  { id: "dp_3", name: "Amit T.", phone: "+91 93333 33333", status: "OFFLINE" as const, activeOrders: 0, totalDeliveries: 189, rating: 4.3 },
];

// Store Timing
export const storeTiming: { day: StoreDay; open: string; close: string; isClosed: boolean }[] = [
  { day: "MONDAY", open: "08:00", close: "22:00", isClosed: false },
  { day: "TUESDAY", open: "08:00", close: "22:00", isClosed: false },
  { day: "WEDNESDAY", open: "08:00", close: "22:00", isClosed: false },
  { day: "THURSDAY", open: "08:00", close: "22:00", isClosed: false },
  { day: "FRIDAY", open: "08:00", close: "22:00", isClosed: false },
  { day: "SATURDAY", open: "08:00", close: "23:00", isClosed: false },
  { day: "SUNDAY", open: "09:00", close: "21:00", isClosed: false },
];

// Daily Sales Data (for charts)
export const dailySalesData = [
  { date: "Mon", revenue: 18500, orders: 42 },
  { date: "Tue", revenue: 22300, orders: 56 },
  { date: "Wed", revenue: 19800, orders: 48 },
  { date: "Thu", revenue: 24100, orders: 62 },
  { date: "Fri", revenue: 28700, orders: 71 },
  { date: "Sat", revenue: 35200, orders: 89 },
  { date: "Sun", revenue: 26800, orders: 64 },
];

// Hourly Sales Data
export const hourlySalesData = [
  { hour: "8AM", revenue: 2100, orders: 5 },
  { hour: "9AM", revenue: 4200, orders: 12 },
  { hour: "10AM", revenue: 5800, orders: 15 },
  { hour: "11AM", revenue: 6500, orders: 18 },
  { hour: "12PM", revenue: 7200, orders: 20 },
  { hour: "1PM", revenue: 5100, orders: 14 },
  { hour: "2PM", revenue: 3800, orders: 10 },
  { hour: "3PM", revenue: 2900, orders: 8 },
  { hour: "4PM", revenue: 4100, orders: 11 },
  { hour: "5PM", revenue: 5600, orders: 16 },
  { hour: "6PM", revenue: 8900, orders: 24 },
  { hour: "7PM", revenue: 11200, orders: 32 },
  { hour: "8PM", revenue: 9800, orders: 28 },
  { hour: "9PM", revenue: 6200, orders: 17 },
  { hour: "10PM", revenue: 2800, orders: 7 },
];

// Top Products
export const topProducts = [
  { name: "Amul Toned Milk", sold: 235, revenue: 12690 },
  { name: "Maggi Noodles", sold: 198, revenue: 10296 },
  { name: "Fresh Tomatoes", sold: 180, revenue: 8640 },
  { name: "Onion", sold: 165, revenue: 6270 },
  { name: "Basmati Rice Premium", sold: 85, revenue: 16575 },
  { name: "Parle-G Biscuit", sold: 420, revenue: 4200 },
  { name: "Amul Butter", sold: 95, revenue: 5130 },
  { name: "Coca Cola", sold: 142, revenue: 5396 },
];

// Payment Summary
export const paymentSummary = [
  { method: "UPI", count: 156, amount: 89400, percentage: 52 },
  { method: "Cash", count: 68, amount: 38200, percentage: 23 },
  { method: "Card", count: 48, amount: 27300, percentage: 16 },
  { method: "COD", count: 26, amount: 14600, percentage: 9 },
];

// Recent Activity
export const recentActivity = [
  { id: "act_1", type: "ORDER" as const, message: "New order FM-20250115-006 from Rajesh Kumar", time: "2 min ago" },
  { id: "act_2", type: "DELIVERY" as const, message: "Order FM-20250115-005 delivered by Ramesh K.", time: "8 min ago" },
  { id: "act_3", type: "PAYMENT" as const, message: "UPI payment ₹396.64 received", time: "15 min ago" },
  { id: "act_4", type: "STOCK" as const, message: "Red Bell Pepper is now out of stock", time: "30 min ago" },
  { id: "act_5", type: "ORDER" as const, message: "Order FM-20250114-007 cancelled by customer", time: "1 hr ago" },
  { id: "act_6", type: "POS" as const, message: "POS session closed — daily total ₹12,450", time: "2 hrs ago" },
];
