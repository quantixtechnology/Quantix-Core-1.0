"use client"

import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"

// Re-export context-aware demo data (grocery by default for customer app)
export const categories = getDemoCategories("standard_grocery").map((c) => ({
  id: c.id, name: c.name, slug: c.slug, productCount: 0, icon: c.icon, color: c.color, sortOrder: c.sortOrder,
}))

export const products = getDemoProducts("standard_grocery").map((p) => ({
  id: p.id, name: p.name, slug: p.slug, categoryId: p.categoryId, category: p.category,
  status: p.status, isVeg: p.isVeg, isFeatured: p.isFeatured, image: p.image,
  variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, isDefault: v.isDefault })),
}))

// Banner data for home carousel
export const banners = [
  {
    id: "ban_1",
    title: "Fresh Vegetables",
    subtitle: "Farm to door in 2 hours",
    image: "",
    color: "#10B981",
    link: "cat_1",
  },
  {
    id: "ban_2",
    title: "Dairy Essentials",
    subtitle: "Up to 15% off on fresh dairy",
    image: "",
    color: "#3B82F6",
    link: "cat_2",
  },
  {
    id: "ban_3",
    title: "Weekend Specials",
    subtitle: "Flat ₹100 off on orders above ₹500",
    image: "",
    color: "#F59E0B",
    link: "",
  },
  {
    id: "ban_4",
    title: "Snack Attack",
    subtitle: "Buy 2 Get 1 Free on all snacks",
    image: "",
    color: "#EF4444",
    link: "cat_4",
  },
]

// Offer/promo data
export const offers = [
  {
    id: "off_1",
    title: "₹100 OFF",
    description: "On orders above ₹500",
    code: "FRESH100",
    discount: 100,
    validTill: "2025-02-28",
  },
  {
    id: "off_2",
    title: "FREE DELIVERY",
    description: "On all orders today",
    code: "FREEDEL",
    discount: 30,
    validTill: "2025-01-31",
  },
  {
    id: "off_3",
    title: "20% OFF",
    description: "On fruits & vegetables",
    code: "VEG20",
    discount: 0,
    validTill: "2025-02-15",
  },
  {
    id: "off_4",
    title: "₹50 OFF",
    description: "First order special",
    code: "WELCOME50",
    discount: 50,
    validTill: "2025-03-31",
  },
]

// Customer addresses
export const customerAddresses = [
  {
    id: "addr_1",
    label: "Home",
    line1: "402, Lotus Apartments, Andheri West",
    line2: "Near Metro Station",
    city: "Mumbai",
    pincode: "400053",
    isDefault: true,
    lat: 19.1364,
    lng: 72.8296,
  },
  {
    id: "addr_2",
    label: "Office",
    line1: "512,商业Tower, BKC",
    line2: "13th Floor",
    city: "Mumbai",
    pincode: "400051",
    isDefault: false,
    lat: 19.0708,
    lng: 72.8713,
  },
]

// Customer orders
export const customerOrders = [
  {
    id: "cord_1",
    orderNumber: "FM-20250115-001",
    status: "DELIVERED" as const,
    items: [
      { name: "Amul Toned Milk 1L", qty: 2, price: 54 },
      { name: "Fresh Tomatoes 1kg", qty: 1, price: 48 },
      { name: "Onion 1kg", qty: 2, price: 38 },
      { name: "Maggi Noodles Pack of 4", qty: 3, price: 52 },
    ],
    total: 396.64,
    paymentMethod: "UPI",
    createdAt: "2025-01-15 10:30",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: { name: "Ramesh K.", phone: "+91 91111 11111", vehicle: "Honda Activa - MH 02 AB 1234" },
    estimatedDelivery: "2025-01-15 11:30",
  },
  {
    id: "cord_2",
    orderNumber: "FM-20250115-005",
    status: "OUT_FOR_DELIVERY" as const,
    items: [
      { name: "Green Capsicum 500g", qty: 2, price: 45 },
      { name: "Frozen Peas 500g", qty: 1, price: 118 },
      { name: "Dove Shampoo 180ml", qty: 1, price: 130 },
      { name: "Amul Toned Milk 500ml", qty: 3, price: 27 },
    ],
    total: 454.48,
    paymentMethod: "UPI",
    createdAt: "2025-01-15 12:00",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: { name: "Ramesh K.", phone: "+91 91111 11111", vehicle: "Honda Activa - MH 02 AB 1234" },
    estimatedDelivery: "2025-01-15 13:00",
  },
  {
    id: "cord_3",
    orderNumber: "FM-20250114-009",
    status: "PREPARING" as const,
    items: [
      { name: "Basmati Rice Premium 5kg", qty: 1, price: 949 },
      { name: "MDH Garam Masala 100g", qty: 2, price: 108 },
    ],
    total: 1227.40,
    paymentMethod: "CARD",
    createdAt: "2025-01-15 13:15",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: null,
    estimatedDelivery: "2025-01-15 14:30",
  },
  {
    id: "cord_4",
    orderNumber: "FM-20250113-010",
    status: "CANCELLED" as const,
    items: [
      { name: "Coca Cola 750ml", qty: 6, price: 38 },
      { name: "Lays Classic Chips 52g", qty: 10, price: 20 },
    ],
    total: 491.12,
    paymentMethod: "UPI",
    createdAt: "2025-01-13 16:30",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: null,
    estimatedDelivery: null,
  },
  {
    id: "cord_5",
    orderNumber: "FM-20250112-011",
    status: "DELIVERED" as const,
    items: [
      { name: "Amul Butter 100g", qty: 2, price: 54 },
      { name: "Britannia Bread 400g", qty: 1, price: 42 },
      { name: "Parle-G Biscuit 800g", qty: 1, price: 68 },
    ],
    total: 252.80,
    paymentMethod: "COD",
    createdAt: "2025-01-12 09:20",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: { name: "Suresh M.", phone: "+91 92222 22222", vehicle: "TVS Jupiter - MH 02 CD 5678" },
    estimatedDelivery: "2025-01-12 10:15",
  },
  {
    id: "cord_6",
    orderNumber: "FM-20250110-012",
    status: "DELIVERED" as const,
    items: [
      { name: "Basmati Rice Premium 1kg", qty: 2, price: 195 },
      { name: "Surf Excel Matic 1kg", qty: 1, price: 160 },
      { name: "Frozen Peas 500g", qty: 2, price: 118 },
    ],
    total: 802.00,
    paymentMethod: "UPI",
    createdAt: "2025-01-10 18:45",
    deliveryAddress: "402, Lotus Apartments, Andheri West, Mumbai 400053",
    deliveryPartner: { name: "Amit T.", phone: "+91 93333 33333", vehicle: "Hero Splendor - MH 02 EF 9012" },
    estimatedDelivery: "2025-01-10 19:45",
  },
]

// Recently ordered product IDs
export const recentlyOrdered = ["prod_1", "prod_5", "prod_13", "prod_10", "prod_11"]

// Coupon validation
export const validCoupons: Record<string, { discount: number; minOrder: number }> = {
  FRESH100: { discount: 100, minOrder: 500 },
  FREEDEL: { discount: 30, minOrder: 0 },
  WELCOME50: { discount: 50, minOrder: 200 },
  VEG20: { discount: 0, minOrder: 0 },
}
