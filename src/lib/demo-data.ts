"use client"

// ============================================================================
// Quantix Platform — Business-Context-Aware Demo Data
// Provides categories, products, customers, and dashboard data matching each demo business type
// ============================================================================

import type { WorkflowType } from "@/stores/admin-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DemoCategory {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  workflow: WorkflowType
  description: string
  sortOrder: number
}

export interface DemoVariant {
  id: string
  name: string
  sku: string
  mrp: number
  price: number
  stock: number
  isDefault: boolean
}

export interface DemoProduct {
  id: string
  name: string
  slug: string
  categoryId: string
  category: string
  status: "ACTIVE" | "INACTIVE" | "DRAFT" | "OUT_OF_STOCK"
  isVeg: boolean
  isFeatured: boolean
  image: string
  workflow: WorkflowType
  variants: DemoVariant[]
}

export interface DemoCustomer {
  id: string
  name: string
  phone: string
  email: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  tier: "PLATINUM" | "GOLD" | "SILVER" | "BRONZE"
  lastOrder: string
  tags: string[]
  addresses: {
    id: string
    label: string
    line1: string
    line2: string
    city: string
    pincode: string
    isDefault: boolean
  }[]
}

export interface DemoDashboardStats {
  todayRevenue: number
  todayOrders: number
  pendingOrders: number
  totalCustomers: number
  avgOrderValue: number
  totalProducts: number
  lowStockProducts: number
  activeStores: number
  totalDeliveryPartners: number
  deliveryPartnersOnline: number
}

export interface DemoRecentActivityItem {
  id: string
  type: "order" | "payment" | "stock" | "delivery" | "customer" | "pickup" | "service" | "subscription" | "appointment" | "billing"
  message: string
  time: string
}

export interface DemoBusinessOrderItem {
  name: string
  variant: string
  quantity: number
  price: number
}

export interface DemoBusinessOrder {
  id: string
  orderNumber: string
  type: "DELIVERY" | "PICKUP" | "APPOINTMENT" | "SUBSCRIPTION" | "POS"
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "SCHEDULED" | "ACTIVE" | "COMPLETED"
  customerName: string
  items: DemoBusinessOrderItem[]
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  paymentMethod: "UPI" | "CARD" | "CASH" | "NETBANKING" | "WALLET"
  paymentStatus: "PAID" | "PENDING" | "FAILED" | "REFUNDED"
  createdAt: string
  deliveryAddress: string
  assignedTo: string
  workflow: WorkflowType
}

// ============================================================================
// GROCERY — FreshMart Grocers (Standard)
// ============================================================================
const groceryCategories: DemoCategory[] = [
  { id: "gcat_1", name: "Fruits & Vegetables", slug: "fruits-vegetables", icon: "🥬", color: "#10B981", workflow: "ECOMMERCE", description: "Fresh produce daily", sortOrder: 1 },
  { id: "gcat_2", name: "Dairy & Bakery", slug: "dairy-bakery", icon: "🥛", color: "#3B82F6", workflow: "ECOMMERCE", description: "Milk, bread, eggs & more", sortOrder: 2 },
  { id: "gcat_3", name: "Snacks & Beverages", slug: "snacks-beverages", icon: "🍪", color: "#EF4444", workflow: "ECOMMERCE", description: "Chips, drinks, biscuits", sortOrder: 3 },
  { id: "gcat_4", name: "Rice & Grains", slug: "rice-grains", icon: "🌾", color: "#D97706", workflow: "ECOMMERCE", description: "Basmati, dal, atta", sortOrder: 4 },
  { id: "gcat_5", name: "Spices & Masala", slug: "spices-masala", icon: "🌶️", color: "#DC2626", workflow: "ECOMMERCE", description: "Whole & ground spices", sortOrder: 5 },
  { id: "gcat_6", name: "Personal Care", slug: "personal-care", icon: "✨", color: "#EC4899", workflow: "ECOMMERCE", description: "Shampoo, soap, skincare", sortOrder: 6 },
  { id: "gcat_7", name: "Household Items", slug: "household-items", icon: "🧹", color: "#0891B2", workflow: "ECOMMERCE", description: "Cleaning & essentials", sortOrder: 7 },
  { id: "gcat_8", name: "Frozen Foods", slug: "frozen-foods", icon: "❄️", color: "#6366F1", workflow: "ECOMMERCE", description: "Frozen snacks & meals", sortOrder: 8 },
]

const groceryProducts: DemoProduct[] = [
  {
    id: "gprod_1", name: "Fresh Tomatoes", slug: "fresh-tomatoes", categoryId: "gcat_1", category: "Fruits & Vegetables", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_1", name: "1 kg", sku: "FV-TOM-1KG", mrp: 40, price: 35, stock: 120, isDefault: true }],
  },
  {
    id: "gprod_2", name: "Amul Toned Milk", slug: "amul-toned-milk", categoryId: "gcat_2", category: "Dairy & Bakery", status: "ACTIVE", isVeg: true, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_2a", name: "500ml", sku: "DB-AML-500", mrp: 28, price: 27, stock: 85, isDefault: true },
      { id: "gvar_2b", name: "1L", sku: "DB-AML-1L", mrp: 54, price: 52, stock: 60, isDefault: false },
    ],
  },
  {
    id: "gprod_3", name: "Britannia Bread", slug: "britannia-bread", categoryId: "gcat_2", category: "Dairy & Bakery", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_3", name: "400g", sku: "DB-BRD-400", mrp: 45, price: 42, stock: 40, isDefault: true }],
  },
  {
    id: "gprod_4", name: "Lays Classic Chips", slug: "lays-classic-chips", categoryId: "gcat_3", category: "Snacks & Beverages", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_4a", name: "52g", sku: "SB-LAY-52", mrp: 20, price: 20, stock: 200, isDefault: true },
      { id: "gvar_4b", name: "130g", sku: "SB-LAY-130", mrp: 40, price: 38, stock: 150, isDefault: false },
    ],
  },
  {
    id: "gprod_5", name: "India Gate Basmati Rice", slug: "india-gate-basmati", categoryId: "gcat_4", category: "Rice & Grains", status: "ACTIVE", isVeg: true, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_5a", name: "1kg", sku: "RG-IGB-1K", mrp: 250, price: 230, stock: 45, isDefault: true },
      { id: "gvar_5b", name: "5kg", sku: "RG-IGB-5K", mrp: 1100, price: 1020, stock: 20, isDefault: false },
    ],
  },
  {
    id: "gprod_6", name: "MDH Garam Masala", slug: "mdh-garam-masala", categoryId: "gcat_5", category: "Spices & Masala", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_6", name: "100g", sku: "SM-MDH-GM100", mrp: 85, price: 78, stock: 65, isDefault: true }],
  },
  {
    id: "gprod_7", name: "Coca Cola", slug: "coca-cola", categoryId: "gcat_3", category: "Snacks & Beverages", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_7", name: "750ml", sku: "SB-CC-750", mrp: 40, price: 38, stock: 100, isDefault: true }],
  },
  {
    id: "gprod_8", name: "Surf Excel Matic", slug: "surf-excel-matic", categoryId: "gcat_7", category: "Household Items", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_8a", name: "1kg", sku: "HI-SEM-1K", mrp: 160, price: 148, stock: 30, isDefault: true },
      { id: "gvar_8b", name: "2kg", sku: "HI-SEM-2K", mrp: 310, price: 285, stock: 15, isDefault: false },
    ],
  },
  {
    id: "gprod_9", name: "Dove Shampoo", slug: "dove-shampoo", categoryId: "gcat_6", category: "Personal Care", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_9", name: "180ml", sku: "PC-DSH-180", mrp: 195, price: 175, stock: 42, isDefault: true }],
  },
  {
    id: "gprod_10", name: "Maggi Noodles", slug: "maggi-noodles", categoryId: "gcat_3", category: "Snacks & Beverages", status: "ACTIVE", isVeg: true, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_10a", name: "2-Min Masala (280g)", sku: "SB-MAG-280", mrp: 56, price: 52, stock: 180, isDefault: true },
      { id: "gvar_10b", name: "Family Pack (560g)", sku: "SB-MAG-560", mrp: 108, price: 99, stock: 90, isDefault: false },
    ],
  },
  {
    id: "gprod_11", name: "Amul Butter", slug: "amul-butter", categoryId: "gcat_2", category: "Dairy & Bakery", status: "ACTIVE", isVeg: true, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_11", name: "500g", sku: "DB-ABT-500", mrp: 270, price: 260, stock: 25, isDefault: true }],
  },
  {
    id: "gprod_12", name: "Green Capsicum", slug: "green-capsicum", categoryId: "gcat_1", category: "Fruits & Vegetables", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_12", name: "500g", sku: "FV-GC-500", mrp: 60, price: 48, stock: 55, isDefault: true }],
  },
  {
    id: "gprod_13", name: "Frozen Peas", slug: "frozen-peas", categoryId: "gcat_8", category: "Frozen Foods", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_13", name: "500g", sku: "FF-FP-500", mrp: 99, price: 89, stock: 40, isDefault: true }],
  },
  {
    id: "gprod_14", name: "Parle-G Biscuit", slug: "parle-g-biscuit", categoryId: "gcat_3", category: "Snacks & Beverages", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "gvar_14a", name: "100g", sku: "SB-PG-100", mrp: 10, price: 10, stock: 300, isDefault: true },
      { id: "gvar_14b", name: "800g Family Pack", sku: "SB-PG-800", mrp: 70, price: 65, stock: 120, isDefault: false },
    ],
  },
  {
    id: "gprod_15", name: "Onion", slug: "onion", categoryId: "gcat_1", category: "Fruits & Vegetables", status: "ACTIVE", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_15", name: "1 kg", sku: "FV-ONI-1KG", mrp: 35, price: 30, stock: 200, isDefault: true }],
  },
  {
    id: "gprod_16", name: "Red Bell Pepper", slug: "red-bell-pepper", categoryId: "gcat_1", category: "Fruits & Vegetables", status: "OUT_OF_STOCK", isVeg: true, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "gvar_16", name: "250g", sku: "FV-RBP-250", mrp: 80, price: 70, stock: 0, isDefault: true }],
  },
]

const groceryCustomers: DemoCustomer[] = [
  {
    id: "gcust_1", name: "Rajesh Kumar", phone: "+91 98765 43210", email: "rajesh.kumar@email.com",
    totalOrders: 24, totalSpent: 18540, loyaltyPoints: 3200, tier: "PLATINUM", lastOrder: "2026-05-08T14:30:00",
    tags: ["Weekly Shopper", "Bulk Buyer", "Vegetables"],
    addresses: [
      { id: "ga_1", label: "Home", line1: "42, MG Road, Koramangala", line2: "Near Jyoti Nivas College", city: "Bengaluru", pincode: "560034", isDefault: true },
      { id: "ga_2", label: "Office", line1: "101, Brigade Metropolis", line2: "Garvebhavipalya", city: "Bengaluru", pincode: "560068", isDefault: false },
    ],
  },
  {
    id: "gcust_2", name: "Sneha Patil", phone: "+91 87654 32109", email: "sneha.patil@email.com",
    totalOrders: 18, totalSpent: 12300, loyaltyPoints: 2100, tier: "GOLD", lastOrder: "2026-05-07T10:15:00",
    tags: ["Organic Preference", "Dairy Regular", "Home Delivery"],
    addresses: [
      { id: "ga_3", label: "Home", line1: "15, HSR Layout, Sector 2", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
    ],
  },
  {
    id: "gcust_3", name: "Anand Joshi", phone: "+91 76543 21098", email: "anand.joshi@email.com",
    totalOrders: 12, totalSpent: 8900, loyaltyPoints: 1450, tier: "SILVER", lastOrder: "2026-05-06T16:45:00",
    tags: ["Snack Buyer", "Monthly Restock"],
    addresses: [
      { id: "ga_4", label: "Home", line1: "78, Indiranagar, 100ft Road", line2: "Above Nilgiris", city: "Bengaluru", pincode: "560038", isDefault: true },
    ],
  },
  {
    id: "gcust_4", name: "Deepa Nair", phone: "+91 65432 10987", email: "deepa.nair@email.com",
    totalOrders: 8, totalSpent: 5600, loyaltyPoints: 800, tier: "SILVER", lastOrder: "2026-05-04T09:00:00",
    tags: ["Bakery Items", "Breakfast Essentials"],
    addresses: [
      { id: "ga_5", label: "Home", line1: "23, Whitefield Main Road", line2: "Near ITPL", city: "Bengaluru", pincode: "560066", isDefault: true },
    ],
  },
  {
    id: "gcust_5", name: "Mohan Sharma", phone: "+91 54321 09876", email: "mohan.sharma@email.com",
    totalOrders: 5, totalSpent: 3200, loyaltyPoints: 450, tier: "BRONZE", lastOrder: "2026-05-01T11:30:00",
    tags: ["New Customer", "Rice & Grains"],
    addresses: [
      { id: "ga_6", label: "Home", line1: "56, JP Nagar, Phase 3", line2: "", city: "Bengaluru", pincode: "560078", isDefault: true },
    ],
  },
  {
    id: "gcust_6", name: "Kavita Reddy", phone: "+91 43210 98765", email: "kavita.reddy@email.com",
    totalOrders: 15, totalSpent: 11200, loyaltyPoints: 1900, tier: "GOLD", lastOrder: "2026-05-08T18:20:00",
    tags: ["Family Pack Buyer", "Spices & Masala", "Weekend Shopper"],
    addresses: [
      { id: "ga_7", label: "Home", line1: "90, Electronic City, Phase 1", line2: "Near Infosys Gate 4", city: "Bengaluru", pincode: "560100", isDefault: true },
    ],
  },
]

// ============================================================================
// LAUNDRY — QuickWash (Standard) & ProWash (Pro)
// ============================================================================
const laundryCategories: DemoCategory[] = [
  { id: "lcat_1", name: "Wash & Fold", slug: "wash-fold", icon: "👕", color: "#10B981", workflow: "ECOMMERCE", description: "Regular washing & folding", sortOrder: 1 },
  { id: "lcat_2", name: "Dry Cleaning", slug: "dry-cleaning", icon: "🧥", color: "#8B5CF6", workflow: "ECOMMERCE", description: "Premium dry clean service", sortOrder: 2 },
  { id: "lcat_3", name: "Ironing", slug: "ironing", icon: "♨️", color: "#F59E0B", workflow: "ECOMMERCE", description: "Steam press & ironing", sortOrder: 3 },
]

const proLaundryCategories: DemoCategory[] = [
  { id: "plcat_1", name: "Standard Wash", slug: "standard-wash", icon: "👕", color: "#10B981", workflow: "ECOMMERCE", description: "Regular wash & fold with fixed pricing", sortOrder: 1 },
  { id: "plcat_2", name: "Weight Wash", slug: "weight-wash", icon: "⚖️", color: "#EF4444", workflow: "POST_SERVICE_BILLING", description: "Weigh after wash, pay by kg", sortOrder: 2 },
  { id: "plcat_3", name: "Subscription Wash", slug: "subscription-wash", icon: "🔄", color: "#8B5CF6", workflow: "SUBSCRIPTION", description: "Monthly wash packages with credits", sortOrder: 3 },
  { id: "plcat_4", name: "Pickup & Delivery", slug: "pickup-delivery", icon: "🚚", color: "#3B82F6", workflow: "PICKUP_DELIVERY", description: "Doorstep pickup & delivery service", sortOrder: 4 },
  { id: "plcat_5", name: "Ironing", slug: "ironing-pro", icon: "♨️", color: "#F59E0B", workflow: "ECOMMERCE", description: "Steam press & ironing", sortOrder: 5 },
]

const laundryProducts: DemoProduct[] = [
  {
    id: "lprod_1", name: "Shirt Wash & Fold", slug: "shirt-wash-fold", categoryId: "lcat_1", category: "Wash & Fold", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_1", name: "Per piece", sku: "WF-SHIRT", mrp: 25, price: 20, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_2", name: "T-Shirt Wash & Fold", slug: "tshirt-wash-fold", categoryId: "lcat_1", category: "Wash & Fold", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_2", name: "Per piece", sku: "WF-TSHIRT", mrp: 20, price: 15, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_3", name: "Trouser/Pant Wash", slug: "trouser-wash", categoryId: "lcat_1", category: "Wash & Fold", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_3", name: "Per piece", sku: "WF-TROUSER", mrp: 30, price: 25, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_4", name: "Bedsheet Wash", slug: "bedsheet-wash", categoryId: "lcat_1", category: "Wash & Fold", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "lvar_4a", name: "Single", sku: "WF-BS-SGL", mrp: 80, price: 70, stock: 999, isDefault: true },
      { id: "lvar_4b", name: "Double", sku: "WF-BS-DBL", mrp: 120, price: 100, stock: 999, isDefault: false },
    ],
  },
  {
    id: "lprod_5", name: "Suit Dry Clean", slug: "suit-dry-clean", categoryId: "lcat_2", category: "Dry Cleaning", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "lvar_5a", name: "2-piece", sku: "DC-SUIT-2P", mrp: 350, price: 299, stock: 999, isDefault: true },
      { id: "lvar_5b", name: "3-piece", sku: "DC-SUIT-3P", mrp: 450, price: 399, stock: 999, isDefault: false },
    ],
  },
  {
    id: "lprod_6", name: "Saree Dry Clean", slug: "saree-dry-clean", categoryId: "lcat_2", category: "Dry Cleaning", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [
      { id: "lvar_6a", name: "Regular Saree", sku: "DC-SAREE-REG", mrp: 200, price: 180, stock: 999, isDefault: true },
      { id: "lvar_6b", name: "Silk/Special Saree", sku: "DC-SAREE-SP", mrp: 350, price: 320, stock: 999, isDefault: false },
    ],
  },
  {
    id: "lprod_7", name: "Blouse Dry Clean", slug: "blouse-dry-clean", categoryId: "lcat_2", category: "Dry Cleaning", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_7", name: "Per piece", sku: "DC-BLOUSE", mrp: 80, price: 65, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_8", name: "Shirt Ironing", slug: "shirt-ironing", categoryId: "lcat_3", category: "Ironing", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_8", name: "Per piece", sku: "IR-SHIRT", mrp: 15, price: 12, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_9", name: "Trouser Ironing", slug: "trouser-ironing", categoryId: "lcat_3", category: "Ironing", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_9", name: "Per piece", sku: "IR-TROUSER", mrp: 20, price: 15, stock: 999, isDefault: true }],
  },
  {
    id: "lprod_10", name: "Saree Ironing", slug: "saree-ironing", categoryId: "lcat_3", category: "Ironing", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "lvar_10", name: "Per piece", sku: "IR-SAREE", mrp: 40, price: 35, stock: 999, isDefault: true }],
  },
]

const proLaundryProducts: DemoProduct[] = [
  // Standard Wash (ECOMMERCE)
  ...laundryProducts.filter(p => ["lprod_1", "lprod_2", "lprod_3", "lprod_4"].includes(p.id)).map(p => ({
    ...p, categoryId: "plcat_1", category: "Standard Wash", workflow: "ECOMMERCE" as WorkflowType,
  })),
  // Weight Wash (POST_SERVICE_BILLING)
  {
    id: "plprod_5", name: "Clothes by Weight", slug: "clothes-by-weight", categoryId: "plcat_2", category: "Weight Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "POST_SERVICE_BILLING",
    variants: [
      { id: "plvar_5a", name: "Up to 3 kg", sku: "WW-3KG", mrp: 150, price: 130, stock: 999, isDefault: true },
      { id: "plvar_5b", name: "Up to 5 kg", sku: "WW-5KG", mrp: 250, price: 220, stock: 999, isDefault: false },
      { id: "plvar_5c", name: "Up to 8 kg", sku: "WW-8KG", mrp: 400, price: 350, stock: 999, isDefault: false },
    ],
  },
  {
    id: "plprod_6", name: "Blanket by Weight", slug: "blanket-by-weight", categoryId: "plcat_2", category: "Weight Wash", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "POST_SERVICE_BILLING",
    variants: [
      { id: "plvar_6a", name: "Single (₹80/kg est.)", sku: "WW-BLK-SGL", mrp: 240, price: 200, stock: 999, isDefault: true },
      { id: "plvar_6b", name: "Double (₹80/kg est.)", sku: "WW-BLK-DBL", mrp: 480, price: 400, stock: 999, isDefault: false },
    ],
  },
  // Subscription Wash (SUBSCRIPTION)
  {
    id: "plprod_7", name: "Monthly Basic — 20 Credits", slug: "monthly-basic-20", categoryId: "plcat_3", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "SUBSCRIPTION",
    variants: [{ id: "plvar_7", name: "Monthly", sku: "SUB-BASIC-20", mrp: 999, price: 899, stock: 999, isDefault: true }],
  },
  {
    id: "plprod_8", name: "Monthly Pro — 50 Credits", slug: "monthly-pro-50", categoryId: "plcat_3", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "SUBSCRIPTION",
    variants: [{ id: "plvar_8", name: "Monthly", sku: "SUB-PRO-50", mrp: 2199, price: 1999, stock: 999, isDefault: true }],
  },
  {
    id: "plprod_9", name: "Quarterly Family — 100 Credits", slug: "quarterly-family-100", categoryId: "plcat_3", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "SUBSCRIPTION",
    variants: [{ id: "plvar_9", name: "Quarterly", sku: "SUB-FAM-100", mrp: 5499, price: 4999, stock: 999, isDefault: true }],
  },
  // Pickup & Delivery (PICKUP_DELIVERY)
  {
    id: "plprod_10", name: "Express Pickup (Same Day)", slug: "express-pickup", categoryId: "plcat_4", category: "Pickup & Delivery", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "PICKUP_DELIVERY",
    variants: [{ id: "plvar_10", name: "Per pickup", sku: "PD-EXPRESS", mrp: 99, price: 79, stock: 999, isDefault: true }],
  },
  {
    id: "plprod_11", name: "Scheduled Pickup (Next Day)", slug: "scheduled-pickup", categoryId: "plcat_4", category: "Pickup & Delivery", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "PICKUP_DELIVERY",
    variants: [{ id: "plvar_11", name: "Per pickup", sku: "PD-SCHEDULED", mrp: 49, price: 39, stock: 999, isDefault: true }],
  },
  // Ironing (ECOMMERCE)
  {
    id: "plprod_12", name: "Shirt Ironing", slug: "pro-shirt-ironing", categoryId: "plcat_5", category: "Ironing", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "plvar_12", name: "Per piece", sku: "PIR-SHIRT", mrp: 15, price: 12, stock: 999, isDefault: true }],
  },
  {
    id: "plprod_13", name: "Saree Ironing", slug: "pro-saree-ironing", categoryId: "plcat_5", category: "Ironing", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "plvar_13", name: "Per piece", sku: "PIR-SAREE", mrp: 40, price: 35, stock: 999, isDefault: true }],
  },
]

const laundryCustomers: DemoCustomer[] = [
  {
    id: "lcust_1", name: "Priya Sharma", phone: "+91 99887 76655", email: "priya.sharma@email.com",
    totalOrders: 32, totalSpent: 24800, loyaltyPoints: 4500, tier: "PLATINUM", lastOrder: "2026-05-08T16:30:00",
    tags: ["Weekly Pickup", "Dry Clean Regular", "Saree Specialist"],
    addresses: [
      { id: "la_1", label: "Home", line1: "12, AECS Layout, Kundalahalli", line2: "Near Brookefield", city: "Bengaluru", pincode: "560037", isDefault: true },
    ],
  },
  {
    id: "lcust_2", name: "Vikram Patel", phone: "+91 88776 65544", email: "vikram.patel@email.com",
    totalOrders: 22, totalSpent: 16500, loyaltyPoints: 2800, tier: "GOLD", lastOrder: "2026-05-07T09:15:00",
    tags: ["Office Wear", "Shirt & Trouser Wash", "Bi-weekly"],
    addresses: [
      { id: "la_2", label: "Home", line1: "45, Marathahalli Bridge", line2: "Opp. Innovative Multiplex", city: "Bengaluru", pincode: "560037", isDefault: true },
    ],
  },
  {
    id: "lcust_3", name: "Meera Iyer", phone: "+91 77665 54433", email: "meera.iyer@email.com",
    totalOrders: 15, totalSpent: 9200, loyaltyPoints: 1600, tier: "SILVER", lastOrder: "2026-05-06T14:00:00",
    tags: ["Ironing Only", "Saree Ironing"],
    addresses: [
      { id: "la_3", label: "Home", line1: "78, Bellandur, Outer Ring Road", line2: "Near Intel Office", city: "Bengaluru", pincode: "560103", isDefault: true },
    ],
  },
  {
    id: "lcust_4", name: "Arjun Reddy", phone: "+91 66554 43322", email: "arjun.reddy@email.com",
    totalOrders: 28, totalSpent: 21400, loyaltyPoints: 3800, tier: "PLATINUM", lastOrder: "2026-05-08T11:45:00",
    tags: ["Subscription Member", "Suit Dry Clean", "Bedsheet Wash"],
    addresses: [
      { id: "la_4", label: "Home", line1: "23, HSR Layout, Sector 7", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
      { id: "la_5", label: "Office", line1: "56, EcoSpace, Outer Ring Road", line2: "Bellandur", city: "Bengaluru", pincode: "560103", isDefault: false },
    ],
  },
  {
    id: "lcust_5", name: "Sunita Deshmukh", phone: "+91 55443 32211", email: "sunita.d@email.com",
    totalOrders: 9, totalSpent: 5400, loyaltyPoints: 750, tier: "SILVER", lastOrder: "2026-05-03T10:30:00",
    tags: ["Curtain Wash", "Bedsheet Regular"],
    addresses: [
      { id: "la_6", label: "Home", line1: "90, BTM Layout, 2nd Stage", line2: "", city: "Bengaluru", pincode: "560076", isDefault: true },
    ],
  },
  {
    id: "lcust_6", name: "Rahul Verma", phone: "+91 44332 21100", email: "rahul.verma@email.com",
    totalOrders: 4, totalSpent: 2800, loyaltyPoints: 350, tier: "BRONZE", lastOrder: "2026-04-28T17:00:00",
    tags: ["New Customer", "Express Wash"],
    addresses: [
      { id: "la_7", label: "Home", line1: "67, JP Nagar, Phase 6", line2: "Near Puttenahalli Lake", city: "Bengaluru", pincode: "560078", isDefault: true },
    ],
  },
]

// ============================================================================
// CAR WASH — SparkleCar Wash (Pro)
// ============================================================================
const carwashCategories: DemoCategory[] = [
  { id: "ccat_1", name: "Subscription Wash", slug: "subscription-wash", icon: "🔄", color: "#8B5CF6", workflow: "SUBSCRIPTION", description: "Monthly car wash packages", sortOrder: 1 },
  { id: "ccat_2", name: "Pickup Wash", slug: "pickup-wash", icon: "🚗", color: "#3B82F6", workflow: "PICKUP_DELIVERY", description: "We pick up, wash & return your car", sortOrder: 2 },
  { id: "ccat_3", name: "Accessories", slug: "car-accessories", icon: "🧴", color: "#10B981", workflow: "ECOMMERCE", description: "Car care products & accessories", sortOrder: 3 },
  { id: "ccat_4", name: "Appointment Wash", slug: "appointment-wash", icon: "📅", color: "#F59E0B", workflow: "APPOINTMENT", description: "Book a slot for in-bay wash", sortOrder: 4 },
  { id: "ccat_5", name: "Detailing Service", slug: "detailing-service", icon: "✨", color: "#EF4444", workflow: "POST_SERVICE_BILLING", description: "Full detailing — price after inspection", sortOrder: 5 },
]

const carwashProducts: DemoProduct[] = [
  // Subscription Wash (SUBSCRIPTION)
  {
    id: "cprod_1", name: "Basic Monthly — 4 Washes", slug: "basic-monthly-4", categoryId: "ccat_1", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "SUBSCRIPTION",
    variants: [{ id: "cvar_1", name: "Hatchback/Sedan", sku: "SUB-BW-4", mrp: 999, price: 899, stock: 999, isDefault: true }],
  },
  {
    id: "cprod_2", name: "Pro Monthly — 8 Washes", slug: "pro-monthly-8", categoryId: "ccat_1", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "SUBSCRIPTION",
    variants: [
      { id: "cvar_2a", name: "Hatchback/Sedan", sku: "SUB-PW-8-SD", mrp: 1799, price: 1599, stock: 999, isDefault: true },
      { id: "cvar_2b", name: "SUV/MUV", sku: "SUB-PW-8-SUV", mrp: 2399, price: 2199, stock: 999, isDefault: false },
    ],
  },
  {
    id: "cprod_3", name: "Unlimited Monthly", slug: "unlimited-monthly", categoryId: "ccat_1", category: "Subscription Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "SUBSCRIPTION",
    variants: [
      { id: "cvar_3a", name: "Hatchback/Sedan", sku: "SUB-UNL-SD", mrp: 2999, price: 2699, stock: 999, isDefault: true },
      { id: "cvar_3b", name: "SUV/MUV", sku: "SUB-UNL-SUV", mrp: 3999, price: 3599, stock: 999, isDefault: false },
    ],
  },
  // Pickup Wash (PICKUP_DELIVERY)
  {
    id: "cprod_4", name: "Exterior Pickup Wash", slug: "exterior-pickup-wash", categoryId: "ccat_2", category: "Pickup Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "PICKUP_DELIVERY",
    variants: [
      { id: "cvar_4a", name: "Hatchback", sku: "PK-EXT-HB", mrp: 399, price: 349, stock: 999, isDefault: true },
      { id: "cvar_4b", name: "Sedan", sku: "PK-EXT-SD", mrp: 499, price: 449, stock: 999, isDefault: false },
      { id: "cvar_4c", name: "SUV", sku: "PK-EXT-SUV", mrp: 699, price: 599, stock: 999, isDefault: false },
    ],
  },
  {
    id: "cprod_5", name: "Interior + Exterior Pickup Wash", slug: "full-pickup-wash", categoryId: "ccat_2", category: "Pickup Wash", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "PICKUP_DELIVERY",
    variants: [
      { id: "cvar_5a", name: "Hatchback", sku: "PK-FUL-HB", mrp: 699, price: 599, stock: 999, isDefault: true },
      { id: "cvar_5b", name: "Sedan", sku: "PK-FUL-SD", mrp: 899, price: 799, stock: 999, isDefault: false },
      { id: "cvar_5c", name: "SUV", sku: "PK-FUL-SUV", mrp: 1199, price: 999, stock: 999, isDefault: false },
    ],
  },
  // Accessories (ECOMMERCE)
  {
    id: "cprod_6", name: "Microfiber Cloth Set (3pcs)", slug: "microfiber-cloth-set", categoryId: "ccat_3", category: "Accessories", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "cvar_6", name: "Pack of 3", sku: "ACC-MFC-3", mrp: 350, price: 299, stock: 48, isDefault: true }],
  },
  {
    id: "cprod_7", name: "Car Dashboard Polish", slug: "dashboard-polish", categoryId: "ccat_3", category: "Accessories", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "cvar_7", name: "200ml", sku: "ACC-DP-200", mrp: 250, price: 220, stock: 35, isDefault: true }],
  },
  {
    id: "cprod_8", name: "Car Perfume Freshener", slug: "car-perfume", categoryId: "ccat_3", category: "Accessories", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "ECOMMERCE",
    variants: [{ id: "cvar_8", name: "50ml", sku: "ACC-CPF-50", mrp: 199, price: 179, stock: 62, isDefault: true }],
  },
  // Appointment Wash (APPOINTMENT)
  {
    id: "cprod_9", name: "In-Bay Exterior Wash", slug: "inbay-exterior", categoryId: "ccat_4", category: "Appointment Wash", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "APPOINTMENT",
    variants: [
      { id: "cvar_9a", name: "Hatchback/Sedan — 30 min slot", sku: "APT-EXT-SD", mrp: 299, price: 249, stock: 999, isDefault: true },
      { id: "cvar_9b", name: "SUV/MUV — 45 min slot", sku: "APT-EXT-SUV", mrp: 449, price: 399, stock: 999, isDefault: false },
    ],
  },
  {
    id: "cprod_10", name: "In-Bay Full Detail Wash", slug: "inbay-full-detail", categoryId: "ccat_4", category: "Appointment Wash", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "APPOINTMENT",
    variants: [
      { id: "cvar_10a", name: "Hatchback/Sedan — 90 min slot", sku: "APT-FUL-SD", mrp: 799, price: 699, stock: 999, isDefault: true },
      { id: "cvar_10b", name: "SUV/MUV — 120 min slot", sku: "APT-FUL-SUV", mrp: 1199, price: 999, stock: 999, isDefault: false },
    ],
  },
  // Detailing Service (POST_SERVICE_BILLING)
  {
    id: "cprod_11", name: "Interior Deep Cleaning", slug: "interior-deep-cleaning", categoryId: "ccat_5", category: "Detailing Service", status: "ACTIVE", isVeg: false, isFeatured: true, image: "", workflow: "POST_SERVICE_BILLING",
    variants: [
      { id: "cvar_11a", name: "Hatchback (est. ₹1,500)", sku: "DTL-INT-HB", mrp: 1500, price: 1200, stock: 999, isDefault: true },
      { id: "cvar_11b", name: "Sedan (est. ₹2,000)", sku: "DTL-INT-SD", mrp: 2000, price: 1600, stock: 999, isDefault: false },
      { id: "cvar_11c", name: "SUV (est. ₹2,800)", sku: "DTL-INT-SUV", mrp: 2800, price: 2200, stock: 999, isDefault: false },
    ],
  },
  {
    id: "cprod_12", name: "Paint Protection Coating", slug: "paint-protection", categoryId: "ccat_5", category: "Detailing Service", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "POST_SERVICE_BILLING",
    variants: [
      { id: "cvar_12a", name: "Sedan (est. ₹4,500)", sku: "DTL-PPC-SD", mrp: 4500, price: 3800, stock: 999, isDefault: true },
      { id: "cvar_12b", name: "SUV (est. ₹6,000)", sku: "DTL-PPC-SUV", mrp: 6000, price: 5200, stock: 999, isDefault: false },
    ],
  },
  {
    id: "cprod_13", name: "Engine Bay Cleaning", slug: "engine-bay-cleaning", categoryId: "ccat_5", category: "Detailing Service", status: "ACTIVE", isVeg: false, isFeatured: false, image: "", workflow: "POST_SERVICE_BILLING",
    variants: [{ id: "cvar_13", name: "All cars (est. ₹800)", sku: "DTL-ENG", mrp: 800, price: 650, stock: 999, isDefault: true }],
  },
]

const carwashCustomers: DemoCustomer[] = [
  {
    id: "ccust_1", name: "Rohit Kapoor", phone: "+91 98123 45670", email: "rohit.kapoor@email.com",
    totalOrders: 36, totalSpent: 45600, loyaltyPoints: 6200, tier: "PLATINUM", lastOrder: "2026-05-08T10:00:00",
    tags: ["SUV Owner", "Subscription Member", "Monthly Unlimited"],
    addresses: [
      { id: "ca_1", label: "Home", line1: "15, Palm Meadows, Whitefield", line2: "", city: "Bengaluru", pincode: "560066", isDefault: true },
    ],
  },
  {
    id: "ccust_2", name: "Neha Gupta", phone: "+91 87012 34567", email: "neha.gupta@email.com",
    totalOrders: 24, totalSpent: 28900, loyaltyPoints: 4100, tier: "PLATINUM", lastOrder: "2026-05-07T15:30:00",
    tags: ["Sedan Owner", "Detailing Service", "Pickup Wash"],
    addresses: [
      { id: "ca_2", label: "Home", line1: "42, Prestige Shantiniketan", line2: "ITPL Road, Whitefield", city: "Bengaluru", pincode: "560048", isDefault: true },
    ],
  },
  {
    id: "ccust_3", name: "Amit Singhania", phone: "+91 76098 76543", email: "amit.s@email.com",
    totalOrders: 18, totalSpent: 18200, loyaltyPoints: 2800, tier: "GOLD", lastOrder: "2026-05-06T11:00:00",
    tags: ["Hatchback Owner", "Appointment Wash", "Interior Clean"],
    addresses: [
      { id: "ca_3", label: "Home", line1: "88, Sobha Lakeview, HSR Layout", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
      { id: "ca_4", label: "Office", line1: "101, Embassy Tech Village", line2: "Outer Ring Road, Marathahalli", city: "Bengaluru", pincode: "560103", isDefault: false },
    ],
  },
  {
    id: "ccust_4", name: "Sunita Rao", phone: "+91 65087 65432", email: "sunita.rao@email.com",
    totalOrders: 14, totalSpent: 12800, loyaltyPoints: 1900, tier: "GOLD", lastOrder: "2026-05-05T09:45:00",
    tags: ["SUV Owner", "Paint Protection", "Accessories Buyer"],
    addresses: [
      { id: "ca_5", label: "Home", line1: "33, Brigade Cosmos, Malleshwaram", line2: "", city: "Bengaluru", pincode: "560055", isDefault: true },
    ],
  },
  {
    id: "ccust_5", name: "Karthik Menon", phone: "+91 54076 54321", email: "karthik.m@email.com",
    totalOrders: 7, totalSpent: 6500, loyaltyPoints: 950, tier: "SILVER", lastOrder: "2026-05-02T14:15:00",
    tags: ["Sedan Owner", "Exterior Wash", "Occasional"],
    addresses: [
      { id: "ca_6", label: "Home", line1: "77, RMZ Ecoworld, Bellandur", line2: "", city: "Bengaluru", pincode: "560103", isDefault: true },
    ],
  },
  {
    id: "ccust_6", name: "Divya Nambiar", phone: "+91 43065 43210", email: "divya.n@email.com",
    totalOrders: 3, totalSpent: 2400, loyaltyPoints: 300, tier: "BRONZE", lastOrder: "2026-04-29T16:00:00",
    tags: ["Hatchback Owner", "First-time Customer"],
    addresses: [
      { id: "ca_7", label: "Home", line1: "22, Jayanagar, 4th Block", line2: "Near Lalbagh", city: "Bengaluru", pincode: "560041", isDefault: true },
    ],
  },
]

// ============================================================================
// DASHBOARD STATS — Per Business Type
// ============================================================================
const groceryDashboardStats: DemoDashboardStats = {
  todayRevenue: 28500,
  todayOrders: 42,
  pendingOrders: 5,
  totalCustomers: 6,
  avgOrderValue: 678,
  totalProducts: 16,
  lowStockProducts: 2,
  activeStores: 1,
  totalDeliveryPartners: 3,
  deliveryPartnersOnline: 2,
}

const laundryDashboardStats: DemoDashboardStats = {
  todayRevenue: 12400,
  todayOrders: 28,
  pendingOrders: 3,
  totalCustomers: 6,
  avgOrderValue: 443,
  totalProducts: 10,
  lowStockProducts: 0,
  activeStores: 1,
  totalDeliveryPartners: 2,
  deliveryPartnersOnline: 1,
}

const proLaundryDashboardStats: DemoDashboardStats = {
  todayRevenue: 24800,
  todayOrders: 52,
  pendingOrders: 4,
  totalCustomers: 6,
  avgOrderValue: 477,
  totalProducts: 13,
  lowStockProducts: 0,
  activeStores: 2,
  totalDeliveryPartners: 4,
  deliveryPartnersOnline: 3,
}

const carwashDashboardStats: DemoDashboardStats = {
  todayRevenue: 35200,
  todayOrders: 38,
  pendingOrders: 6,
  totalCustomers: 6,
  avgOrderValue: 926,
  totalProducts: 13,
  lowStockProducts: 2,
  activeStores: 1,
  totalDeliveryPartners: 3,
  deliveryPartnersOnline: 2,
}

// ============================================================================
// DAILY SALES — 7 Days Per Business Type
// ============================================================================
const groceryDailySales = [
  { date: "Mon", revenue: 18500, orders: 28 },
  { date: "Tue", revenue: 19800, orders: 31 },
  { date: "Wed", revenue: 21200, orders: 34 },
  { date: "Thu", revenue: 22800, orders: 37 },
  { date: "Fri", revenue: 24500, orders: 40 },
  { date: "Sat", revenue: 25600, orders: 42 },
  { date: "Sun", revenue: 26800, orders: 45 },
]

const laundryDailySales = [
  { date: "Mon", revenue: 8200, orders: 18 },
  { date: "Tue", revenue: 8900, orders: 20 },
  { date: "Wed", revenue: 9500, orders: 22 },
  { date: "Thu", revenue: 10200, orders: 24 },
  { date: "Fri", revenue: 11800, orders: 27 },
  { date: "Sat", revenue: 13100, orders: 30 },
  { date: "Sun", revenue: 14500, orders: 33 },
]

const proLaundryDailySales = [
  { date: "Mon", revenue: 16000, orders: 32 },
  { date: "Tue", revenue: 18200, orders: 37 },
  { date: "Wed", revenue: 20500, orders: 42 },
  { date: "Thu", revenue: 22800, orders: 47 },
  { date: "Fri", revenue: 24200, orders: 50 },
  { date: "Sat", revenue: 26100, orders: 54 },
  { date: "Sun", revenue: 28000, orders: 58 },
]

const carwashDailySales = [
  { date: "Mon", revenue: 22000, orders: 22 },
  { date: "Tue", revenue: 25000, orders: 25 },
  { date: "Wed", revenue: 28500, orders: 29 },
  { date: "Thu", revenue: 31200, orders: 32 },
  { date: "Fri", revenue: 34800, orders: 36 },
  { date: "Sat", revenue: 38500, orders: 40 },
  { date: "Sun", revenue: 42000, orders: 44 },
]

// ============================================================================
// HOURLY SALES — Per Business Type
// ============================================================================
const groceryHourlySales = [
  { hour: "6AM", revenue: 800 },
  { hour: "7AM", revenue: 1200 },
  { hour: "8AM", revenue: 2100 },
  { hour: "9AM", revenue: 2800 },
  { hour: "10AM", revenue: 3200 },
  { hour: "11AM", revenue: 3500 },
  { hour: "12PM", revenue: 3100 },
  { hour: "1PM", revenue: 2900 },
  { hour: "2PM", revenue: 2500 },
  { hour: "3PM", revenue: 2200 },
  { hour: "4PM", revenue: 2600 },
  { hour: "5PM", revenue: 3200 },
  { hour: "6PM", revenue: 4100 },
  { hour: "7PM", revenue: 5800 },
  { hour: "8PM", revenue: 5500 },
  { hour: "9PM", revenue: 3800 },
  { hour: "10PM", revenue: 2100 },
  { hour: "11PM", revenue: 800 },
]

const laundryHourlySales = [
  { hour: "6AM", revenue: 200 },
  { hour: "7AM", revenue: 400 },
  { hour: "8AM", revenue: 800 },
  { hour: "9AM", revenue: 1500 },
  { hour: "10AM", revenue: 2800 },
  { hour: "11AM", revenue: 3200 },
  { hour: "12PM", revenue: 2600 },
  { hour: "1PM", revenue: 1800 },
  { hour: "2PM", revenue: 1200 },
  { hour: "3PM", revenue: 900 },
  { hour: "4PM", revenue: 800 },
  { hour: "5PM", revenue: 1100 },
  { hour: "6PM", revenue: 1400 },
  { hour: "7PM", revenue: 1600 },
  { hour: "8PM", revenue: 1200 },
  { hour: "9PM", revenue: 700 },
  { hour: "10PM", revenue: 400 },
  { hour: "11PM", revenue: 200 },
]

const proLaundryHourlySales = [
  { hour: "6AM", revenue: 300 },
  { hour: "7AM", revenue: 500 },
  { hour: "8AM", revenue: 1000 },
  { hour: "9AM", revenue: 2200 },
  { hour: "10AM", revenue: 3800 },
  { hour: "11AM", revenue: 4200 },
  { hour: "12PM", revenue: 2800 },
  { hour: "1PM", revenue: 2000 },
  { hour: "2PM", revenue: 1500 },
  { hour: "3PM", revenue: 1200 },
  { hour: "4PM", revenue: 1400 },
  { hour: "5PM", revenue: 2000 },
  { hour: "6PM", revenue: 3500 },
  { hour: "7PM", revenue: 4800 },
  { hour: "8PM", revenue: 4200 },
  { hour: "9PM", revenue: 2500 },
  { hour: "10PM", revenue: 1200 },
  { hour: "11PM", revenue: 400 },
]

const carwashHourlySales = [
  { hour: "6AM", revenue: 500 },
  { hour: "7AM", revenue: 1500 },
  { hour: "8AM", revenue: 3800 },
  { hour: "9AM", revenue: 4500 },
  { hour: "10AM", revenue: 3200 },
  { hour: "11AM", revenue: 2400 },
  { hour: "12PM", revenue: 1800 },
  { hour: "1PM", revenue: 1500 },
  { hour: "2PM", revenue: 1200 },
  { hour: "3PM", revenue: 1400 },
  { hour: "4PM", revenue: 2000 },
  { hour: "5PM", revenue: 4200 },
  { hour: "6PM", revenue: 5500 },
  { hour: "7PM", revenue: 4800 },
  { hour: "8PM", revenue: 2800 },
  { hour: "9PM", revenue: 1500 },
  { hour: "10PM", revenue: 800 },
  { hour: "11PM", revenue: 300 },
]

// ============================================================================
// RECENT ACTIVITY — Per Business Type
// ============================================================================
const groceryRecentActivity: DemoRecentActivityItem[] = [
  { id: "gra_1", type: "order", message: "New order from Rajesh Kumar", time: "2 min ago" },
  { id: "gra_2", type: "payment", message: "UPI payment ₹485 received", time: "5 min ago" },
  { id: "gra_3", type: "stock", message: "Fresh Tomatoes back in stock", time: "12 min ago" },
  { id: "gra_4", type: "delivery", message: "Order #FM-2847 delivered successfully", time: "18 min ago" },
  { id: "gra_5", type: "customer", message: "New customer Kavita Reddy registered", time: "25 min ago" },
]

const laundryRecentActivity: DemoRecentActivityItem[] = [
  { id: "lra_1", type: "pickup", message: "Pickup scheduled for Priya Sharma", time: "3 min ago" },
  { id: "lra_2", type: "service", message: "Saree dry clean completed", time: "8 min ago" },
  { id: "lra_3", type: "payment", message: "Payment ₹680 received from Vikram Patel", time: "15 min ago" },
  { id: "lra_4", type: "delivery", message: "3 shirts ready for delivery — Meera Iyer", time: "22 min ago" },
  { id: "lra_5", type: "order", message: "New order from Arjun Reddy", time: "30 min ago" },
]

const proLaundryRecentActivity: DemoRecentActivityItem[] = [
  { id: "plra_1", type: "subscription", message: "Subscription renewed — Monthly Pro 50 credits", time: "2 min ago" },
  { id: "plra_2", type: "billing", message: "Weight wash 5.2kg billed ₹228", time: "6 min ago" },
  { id: "plra_3", type: "pickup", message: "Express pickup assigned to Ramesh", time: "11 min ago" },
  { id: "plra_4", type: "delivery", message: "Order #PW-1203 out for delivery", time: "19 min ago" },
  { id: "plra_5", type: "subscription", message: "New subscription — Monthly Basic 20 credits", time: "28 min ago" },
]

const carwashRecentActivity: DemoRecentActivityItem[] = [
  { id: "cra_1", type: "subscription", message: "Monthly subscription renewed — Rohit Kapoor", time: "4 min ago" },
  { id: "cra_2", type: "service", message: "Detailing service completed for SUV", time: "9 min ago" },
  { id: "cra_3", type: "appointment", message: "Appointment booked — 10:00 AM slot", time: "14 min ago" },
  { id: "cra_4", type: "pickup", message: "Pickup wash assigned — Neha Gupta's Sedan", time: "20 min ago" },
  { id: "cra_5", type: "billing", message: "Interior deep cleaning estimate ₹2,200", time: "32 min ago" },
]

// ============================================================================
// TOP PRODUCTS — Per Business Type
// ============================================================================
const groceryTopProducts = [
  { name: "Amul Toned Milk", sold: 85, revenue: 2295 },
  { name: "Maggi Noodles", sold: 72, revenue: 3744 },
  { name: "Fresh Tomatoes", sold: 68, revenue: 2380 },
  { name: "Parle-G Biscuit", sold: 55, revenue: 550 },
  { name: "India Gate Basmati Rice", sold: 18, revenue: 4140 },
]

const laundryTopProducts = [
  { name: "Shirt Wash & Fold", sold: 120, revenue: 2400 },
  { name: "Saree Dry Clean", sold: 45, revenue: 8100 },
  { name: "Trouser/Pant Wash", sold: 85, revenue: 2125 },
  { name: "Shirt Ironing", sold: 150, revenue: 1800 },
  { name: "Suit Dry Clean", sold: 22, revenue: 6578 },
]

const proLaundryTopProducts = [
  { name: "Clothes by Weight", sold: 62, revenue: 13640 },
  { name: "Monthly Pro — 50 Credits", sold: 18, revenue: 35982 },
  { name: "Shirt Wash & Fold", sold: 95, revenue: 1900 },
  { name: "Express Pickup (Same Day)", sold: 48, revenue: 3792 },
  { name: "Monthly Basic — 20 Credits", sold: 25, revenue: 22475 },
]

const carwashTopProducts = [
  { name: "Basic Monthly — 4 Washes", sold: 32, revenue: 28768 },
  { name: "Interior Deep Cleaning", sold: 15, revenue: 18000 },
  { name: "Pro Monthly — 8 Washes", sold: 22, revenue: 35178 },
  { name: "Exterior Pickup Wash", sold: 28, revenue: 9772 },
  { name: "Car Perfume Freshener", sold: 42, revenue: 7518 },
]

// ============================================================================
// BUSINESS ORDERS — Per Business Type
// ============================================================================
const groceryOrders: DemoBusinessOrder[] = [
  {
    id: "gord_1", orderNumber: "FM-2851", type: "DELIVERY", status: "CONFIRMED",
    customerName: "Rajesh Kumar",
    items: [
      { name: "Amul Toned Milk", variant: "1L", quantity: 2, price: 52 },
      { name: "Maggi Noodles", variant: "2-Min Masala (280g)", quantity: 1, price: 52 },
      { name: "Fresh Tomatoes", variant: "1 kg", quantity: 2, price: 35 },
    ],
    subtotal: 226, deliveryFee: 30, tax: 18, total: 274,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T19:30:00",
    deliveryAddress: "42, MG Road, Koramangala, Bengaluru",
    assignedTo: "Ravi", workflow: "ECOMMERCE",
  },
  {
    id: "gord_2", orderNumber: "FM-2850", type: "DELIVERY", status: "PROCESSING",
    customerName: "Sneha Patil",
    items: [
      { name: "India Gate Basmati Rice", variant: "5kg", quantity: 1, price: 1020 },
      { name: "MDH Garam Masala", variant: "100g", quantity: 1, price: 78 },
    ],
    subtotal: 1098, deliveryFee: 30, tax: 85, total: 1213,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T18:45:00",
    deliveryAddress: "15, HSR Layout, Sector 2, Bengaluru",
    assignedTo: "Amit", workflow: "ECOMMERCE",
  },
  {
    id: "gord_3", orderNumber: "FM-2849", type: "DELIVERY", status: "PACKED",
    customerName: "Anand Joshi",
    items: [
      { name: "Amul Butter", variant: "500g", quantity: 1, price: 260 },
      { name: "Britannia Bread", variant: "400g", quantity: 2, price: 42 },
      { name: "Frozen Peas", variant: "500g", quantity: 1, price: 89 },
    ],
    subtotal: 433, deliveryFee: 30, tax: 32, total: 495,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T17:20:00",
    deliveryAddress: "78, Indiranagar, 100ft Road, Bengaluru",
    assignedTo: "Ravi", workflow: "ECOMMERCE",
  },
  {
    id: "gord_4", orderNumber: "FM-2848", type: "DELIVERY", status: "OUT_FOR_DELIVERY",
    customerName: "Deepa Nair",
    items: [
      { name: "Surf Excel Matic", variant: "2kg", quantity: 1, price: 285 },
      { name: "Dove Shampoo", variant: "180ml", quantity: 1, price: 175 },
    ],
    subtotal: 460, deliveryFee: 30, tax: 37, total: 527,
    paymentMethod: "CASH", paymentStatus: "PENDING",
    createdAt: "2026-05-08T16:00:00",
    deliveryAddress: "23, Whitefield Main Road, Bengaluru",
    assignedTo: "Suresh", workflow: "ECOMMERCE",
  },
  {
    id: "gord_5", orderNumber: "FM-2847", type: "DELIVERY", status: "DELIVERED",
    customerName: "Kavita Reddy",
    items: [
      { name: "Lays Classic Chips", variant: "130g", quantity: 3, price: 38 },
      { name: "Coca Cola", variant: "750ml", quantity: 2, price: 38 },
      { name: "Parle-G Biscuit", variant: "800g Family Pack", quantity: 1, price: 65 },
    ],
    subtotal: 291, deliveryFee: 30, tax: 22, total: 343,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T14:30:00",
    deliveryAddress: "90, Electronic City, Phase 1, Bengaluru",
    assignedTo: "Amit", workflow: "ECOMMERCE",
  },
  {
    id: "gord_6", orderNumber: "FM-2846", type: "POS", status: "COMPLETED",
    customerName: "Mohan Sharma",
    items: [
      { name: "Onion", variant: "1 kg", quantity: 2, price: 30 },
      { name: "Green Capsicum", variant: "500g", quantity: 1, price: 48 },
      { name: "Fresh Tomatoes", variant: "1 kg", quantity: 1, price: 35 },
    ],
    subtotal: 143, deliveryFee: 0, tax: 10, total: 153,
    paymentMethod: "CASH", paymentStatus: "PAID",
    createdAt: "2026-05-08T11:30:00",
    deliveryAddress: "In-store",
    assignedTo: "-", workflow: "ECOMMERCE",
  },
]

const laundryOrders: DemoBusinessOrder[] = [
  {
    id: "lord_1", orderNumber: "QW-1842", type: "PICKUP", status: "CONFIRMED",
    customerName: "Priya Sharma",
    items: [
      { name: "Saree Dry Clean", variant: "Regular Saree", quantity: 2, price: 180 },
      { name: "Blouse Dry Clean", variant: "Per piece", quantity: 3, price: 65 },
    ],
    subtotal: 555, deliveryFee: 0, tax: 28, total: 583,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T16:30:00",
    deliveryAddress: "12, AECS Layout, Kundalahalli, Bengaluru",
    assignedTo: "Ramesh", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "lord_2", orderNumber: "QW-1841", type: "DELIVERY", status: "PROCESSING",
    customerName: "Vikram Patel",
    items: [
      { name: "Shirt Wash & Fold", variant: "Per piece", quantity: 8, price: 20 },
      { name: "Trouser/Pant Wash", variant: "Per piece", quantity: 4, price: 25 },
    ],
    subtotal: 260, deliveryFee: 0, tax: 13, total: 273,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T09:15:00",
    deliveryAddress: "45, Marathahalli Bridge, Bengaluru",
    assignedTo: "Suresh", workflow: "ECOMMERCE",
  },
  {
    id: "lord_3", orderNumber: "QW-1840", type: "PICKUP", status: "SCHEDULED",
    customerName: "Meera Iyer",
    items: [
      { name: "Suit Dry Clean", variant: "2-piece", quantity: 1, price: 299 },
      { name: "Shirt Ironing", variant: "Per piece", quantity: 6, price: 12 },
    ],
    subtotal: 371, deliveryFee: 0, tax: 19, total: 390,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T14:00:00",
    deliveryAddress: "78, Bellandur, Outer Ring Road, Bengaluru",
    assignedTo: "-", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "lord_4", orderNumber: "QW-1839", type: "DELIVERY", status: "OUT_FOR_DELIVERY",
    customerName: "Arjun Reddy",
    items: [
      { name: "T-Shirt Wash & Fold", variant: "Per piece", quantity: 12, price: 15 },
      { name: "Bedsheet Wash", variant: "Double", quantity: 2, price: 100 },
    ],
    subtotal: 380, deliveryFee: 0, tax: 19, total: 399,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T11:45:00",
    deliveryAddress: "23, HSR Layout, Sector 7, Bengaluru",
    assignedTo: "Ramesh", workflow: "ECOMMERCE",
  },
  {
    id: "lord_5", orderNumber: "QW-1838", type: "PICKUP", status: "COMPLETED",
    customerName: "Sunita Deshmukh",
    items: [
      { name: "Saree Ironing", variant: "Per piece", quantity: 4, price: 35 },
      { name: "Saree Dry Clean", variant: "Silk/Special Saree", quantity: 1, price: 320 },
    ],
    subtotal: 460, deliveryFee: 0, tax: 23, total: 483,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-07T10:30:00",
    deliveryAddress: "90, BTM Layout, 2nd Stage, Bengaluru",
    assignedTo: "Suresh", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "lord_6", orderNumber: "QW-1837", type: "DELIVERY", status: "DELIVERED",
    customerName: "Rahul Verma",
    items: [
      { name: "Shirt Wash & Fold", variant: "Per piece", quantity: 5, price: 20 },
      { name: "Trouser Ironing", variant: "Per piece", quantity: 3, price: 15 },
    ],
    subtotal: 145, deliveryFee: 0, tax: 7, total: 152,
    paymentMethod: "CASH", paymentStatus: "PAID",
    createdAt: "2026-05-06T17:00:00",
    deliveryAddress: "67, JP Nagar, Phase 6, Bengaluru",
    assignedTo: "-", workflow: "ECOMMERCE",
  },
]

const proLaundryOrders: DemoBusinessOrder[] = [
  {
    id: "plord_1", orderNumber: "PW-1208", type: "PICKUP", status: "CONFIRMED",
    customerName: "Priya Sharma",
    items: [
      { name: "Clothes by Weight", variant: "Up to 5 kg", quantity: 1, price: 220 },
      { name: "Express Pickup (Same Day)", variant: "Per pickup", quantity: 1, price: 79 },
    ],
    subtotal: 299, deliveryFee: 0, tax: 15, total: 314,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T16:30:00",
    deliveryAddress: "12, AECS Layout, Kundalahalli, Bengaluru",
    assignedTo: "Ramesh", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "plord_2", orderNumber: "PW-1207", type: "SUBSCRIPTION", status: "ACTIVE",
    customerName: "Vikram Patel",
    items: [
      { name: "Monthly Pro — 50 Credits", variant: "Monthly", quantity: 1, price: 1999 },
    ],
    subtotal: 1999, deliveryFee: 0, tax: 0, total: 1999,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T09:15:00",
    deliveryAddress: "45, Marathahalli Bridge, Bengaluru",
    assignedTo: "-", workflow: "SUBSCRIPTION",
  },
  {
    id: "plord_3", orderNumber: "PW-1206", type: "PICKUP", status: "PROCESSING",
    customerName: "Meera Iyer",
    items: [
      { name: "Blanket by Weight", variant: "Single (₹80/kg est.)", quantity: 2, price: 200 },
      { name: "Scheduled Pickup (Next Day)", variant: "Per pickup", quantity: 1, price: 39 },
    ],
    subtotal: 439, deliveryFee: 0, tax: 22, total: 461,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T14:00:00",
    deliveryAddress: "78, Bellandur, Outer Ring Road, Bengaluru",
    assignedTo: "Suresh", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "plord_4", orderNumber: "PW-1205", type: "DELIVERY", status: "OUT_FOR_DELIVERY",
    customerName: "Arjun Reddy",
    items: [
      { name: "Shirt Wash & Fold", variant: "Per piece", quantity: 10, price: 20 },
      { name: "Shirt Ironing", variant: "Per piece", quantity: 10, price: 12 },
    ],
    subtotal: 320, deliveryFee: 0, tax: 16, total: 336,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T11:45:00",
    deliveryAddress: "23, HSR Layout, Sector 7, Bengaluru",
    assignedTo: "Ramesh", workflow: "ECOMMERCE",
  },
  {
    id: "plord_5", orderNumber: "PW-1204", type: "SUBSCRIPTION", status: "ACTIVE",
    customerName: "Sunita Deshmukh",
    items: [
      { name: "Monthly Basic — 20 Credits", variant: "Monthly", quantity: 1, price: 899 },
    ],
    subtotal: 899, deliveryFee: 0, tax: 0, total: 899,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-06T10:30:00",
    deliveryAddress: "90, BTM Layout, 2nd Stage, Bengaluru",
    assignedTo: "-", workflow: "SUBSCRIPTION",
  },
  {
    id: "plord_6", orderNumber: "PW-1203", type: "DELIVERY", status: "DELIVERED",
    customerName: "Rahul Verma",
    items: [
      { name: "Clothes by Weight", variant: "Up to 3 kg", quantity: 1, price: 130 },
      { name: "Saree Ironing", variant: "Per piece", quantity: 2, price: 35 },
    ],
    subtotal: 200, deliveryFee: 0, tax: 10, total: 210,
    paymentMethod: "CASH", paymentStatus: "PAID",
    createdAt: "2026-05-05T17:00:00",
    deliveryAddress: "67, JP Nagar, Phase 6, Bengaluru",
    assignedTo: "-", workflow: "ECOMMERCE",
  },
]

const carwashOrders: DemoBusinessOrder[] = [
  {
    id: "cord_1", orderNumber: "SC-0942", type: "SUBSCRIPTION", status: "ACTIVE",
    customerName: "Rohit Kapoor",
    items: [
      { name: "Unlimited Monthly", variant: "Hatchback/Sedan", quantity: 1, price: 2699 },
    ],
    subtotal: 2699, deliveryFee: 0, tax: 0, total: 2699,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T10:00:00",
    deliveryAddress: "15, Palm Meadows, Whitefield, Bengaluru",
    assignedTo: "-", workflow: "SUBSCRIPTION",
  },
  {
    id: "cord_2", orderNumber: "SC-0941", type: "APPOINTMENT", status: "CONFIRMED",
    customerName: "Neha Gupta",
    items: [
      { name: "In-Bay Full Detail Wash", variant: "Hatchback/Sedan — 90 min slot", quantity: 1, price: 699 },
    ],
    subtotal: 699, deliveryFee: 0, tax: 35, total: 734,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-08T15:30:00",
    deliveryAddress: "42, Prestige Shantiniketan, Whitefield, Bengaluru",
    assignedTo: "-", workflow: "APPOINTMENT",
  },
  {
    id: "cord_3", orderNumber: "SC-0940", type: "PICKUP", status: "OUT_FOR_DELIVERY",
    customerName: "Amit Singhania",
    items: [
      { name: "Interior + Exterior Pickup Wash", variant: "SUV", quantity: 1, price: 999 },
    ],
    subtotal: 999, deliveryFee: 0, tax: 50, total: 1049,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-08T11:00:00",
    deliveryAddress: "88, Sobha Lakeview, HSR Layout, Bengaluru",
    assignedTo: "Karthik", workflow: "PICKUP_DELIVERY",
  },
  {
    id: "cord_4", orderNumber: "SC-0939", type: "SUBSCRIPTION", status: "ACTIVE",
    customerName: "Sunita Rao",
    items: [
      { name: "Pro Monthly — 8 Washes", variant: "Hatchback/Sedan", quantity: 1, price: 1599 },
    ],
    subtotal: 1599, deliveryFee: 0, tax: 0, total: 1599,
    paymentMethod: "CARD", paymentStatus: "PAID",
    createdAt: "2026-05-07T09:45:00",
    deliveryAddress: "33, Brigade Cosmos, Malleshwaram, Bengaluru",
    assignedTo: "-", workflow: "SUBSCRIPTION",
  },
  {
    id: "cord_5", orderNumber: "SC-0938", type: "APPOINTMENT", status: "COMPLETED",
    customerName: "Karthik Menon",
    items: [
      { name: "In-Bay Exterior Wash", variant: "SUV/MUV — 45 min slot", quantity: 1, price: 399 },
      { name: "Engine Bay Cleaning", variant: "All cars (est. ₹800)", quantity: 1, price: 650 },
    ],
    subtotal: 1049, deliveryFee: 0, tax: 52, total: 1101,
    paymentMethod: "UPI", paymentStatus: "PAID",
    createdAt: "2026-05-06T14:15:00",
    deliveryAddress: "77, RMZ Ecoworld, Bellandur, Bengaluru",
    assignedTo: "-", workflow: "APPOINTMENT",
  },
  {
    id: "cord_6", orderNumber: "SC-0937", type: "PICKUP", status: "DELIVERED",
    customerName: "Divya Nambiar",
    items: [
      { name: "Exterior Pickup Wash", variant: "Hatchback", quantity: 1, price: 349 },
      { name: "Car Perfume Freshener", variant: "50ml", quantity: 1, price: 179 },
    ],
    subtotal: 528, deliveryFee: 0, tax: 26, total: 554,
    paymentMethod: "CASH", paymentStatus: "PAID",
    createdAt: "2026-04-29T16:00:00",
    deliveryAddress: "22, Jayanagar, 4th Block, Bengaluru",
    assignedTo: "Suresh", workflow: "PICKUP_DELIVERY",
  },
]

// ============================================================================
// CATEGORY REVENUE DATA — Per Business Type
// ============================================================================
const groceryCategoryRevenueData = [
  { category: "Fruits & Vegetables", revenue: 42500, percentage: "22%" },
  { category: "Dairy & Bakery", revenue: 31200, percentage: "16%" },
  { category: "Snacks & Beverages", revenue: 28700, percentage: "15%" },
  { category: "Rice & Grains", revenue: 24100, percentage: "13%" },
  { category: "Spices & Masala", revenue: 16500, percentage: "9%" },
  { category: "Personal Care", revenue: 14200, percentage: "7%" },
  { category: "Household Items", revenue: 15800, percentage: "8%" },
  { category: "Frozen Foods", revenue: 9800, percentage: "5%" },
  { category: "Others", revenue: 5200, percentage: "5%" },
]

const laundryCategoryRevenueData = [
  { category: "Wash & Fold", revenue: 18500, percentage: "42%" },
  { category: "Dry Cleaning", revenue: 15200, percentage: "35%" },
  { category: "Ironing", revenue: 10300, percentage: "23%" },
]

const proLaundryCategoryRevenueData = [
  { category: "Standard Wash", revenue: 14200, percentage: "22%" },
  { category: "Weight Wash", revenue: 18500, percentage: "29%" },
  { category: "Subscription Wash", revenue: 16800, percentage: "26%" },
  { category: "Pickup & Delivery", revenue: 8900, percentage: "14%" },
  { category: "Ironing", revenue: 5600, percentage: "9%" },
]

const carwashCategoryRevenueData = [
  { category: "Subscription Wash", revenue: 38500, percentage: "32%" },
  { category: "Pickup Wash", revenue: 22200, percentage: "18%" },
  { category: "Accessories", revenue: 8400, percentage: "7%" },
  { category: "Appointment Wash", revenue: 18900, percentage: "16%" },
  { category: "Detailing Service", revenue: 32800, percentage: "27%" },
]

// ============================================================================
// PAYMENT SUMMARY — Per Business Type
// ============================================================================
const groceryPaymentSummary = [
  { method: "UPI", count: 156, amount: 89400, percentage: 52 },
  { method: "Cash", count: 68, amount: 38200, percentage: 23 },
  { method: "Card", count: 48, amount: 27300, percentage: 16 },
  { method: "COD", count: 21, amount: 7500, percentage: 9 },
]

const laundryPaymentSummary = [
  { method: "UPI", count: 82, amount: 32800, percentage: 55 },
  { method: "Cash", count: 35, amount: 12600, percentage: 21 },
  { method: "Card", count: 22, amount: 9900, percentage: 17 },
  { method: "Wallet", count: 10, amount: 4200, percentage: 7 },
]

const proLaundryPaymentSummary = [
  { method: "UPI", count: 128, amount: 62400, percentage: 48 },
  { method: "Card", count: 65, amount: 35800, percentage: 28 },
  { method: "Cash", count: 42, amount: 18900, percentage: 15 },
  { method: "Wallet", count: 18, amount: 8100, percentage: 9 },
]

const carwashPaymentSummary = [
  { method: "UPI", count: 145, amount: 72500, percentage: 45 },
  { method: "Card", count: 78, amount: 45600, percentage: 28 },
  { method: "Cash", count: 52, amount: 28400, percentage: 18 },
  { method: "Wallet", count: 15, amount: 12000, percentage: 9 },
]

// ============================================================================
// ORDER TYPE DATA — Per Business Type
// ============================================================================
const groceryOrderTypeData = [
  { name: "Delivery", value: 198, color: "#10B981" },
  { name: "POS", value: 87, color: "#3B82F6" },
  { name: "Takeaway", value: 34, color: "#F59E0B" },
]

const laundryOrderTypeData = [
  { name: "Pickup", value: 145, color: "#10B981" },
  { name: "Delivery", value: 82, color: "#3B82F6" },
  { name: "Walk-in", value: 28, color: "#F59E0B" },
]

const proLaundryOrderTypeData = [
  { name: "Pickup", value: 120, color: "#10B981" },
  { name: "Delivery", value: 95, color: "#3B82F6" },
  { name: "Subscription", value: 62, color: "#8B5CF6" },
  { name: "Walk-in", value: 18, color: "#F59E0B" },
]

const carwashOrderTypeData = [
  { name: "Subscription", value: 85, color: "#8B5CF6" },
  { name: "Pickup", value: 68, color: "#10B981" },
  { name: "Appointment", value: 52, color: "#F59E0B" },
  { name: "Walk-in", value: 34, color: "#3B82F6" },
  { name: "POS", value: 22, color: "#EC4899" },
]

// ============================================================================
// ORDER STATUS DATA — Per Business Type
// ============================================================================
const groceryOrderStatusData = [
  { status: "Pending", count: 12, percentage: "4.0%" },
  { status: "Confirmed", count: 18, percentage: "6.0%" },
  { status: "Processing", count: 24, percentage: "8.0%" },
  { status: "Out for Delivery", count: 15, percentage: "5.0%" },
  { status: "Delivered", count: 210, percentage: "70.0%" },
  { status: "Cancelled", count: 21, percentage: "7.0%" },
]

const laundryOrderStatusData = [
  { status: "Pending Pickup", count: 8, percentage: "5.3%" },
  { status: "In Progress", count: 22, percentage: "14.7%" },
  { status: "Ready for Delivery", count: 15, percentage: "10.0%" },
  { status: "Delivered", count: 95, percentage: "63.3%" },
  { status: "Cancelled", count: 10, percentage: "6.7%" },
]

const proLaundryOrderStatusData = [
  { status: "Pending Pickup", count: 14, percentage: "4.7%" },
  { status: "In Progress", count: 35, percentage: "11.7%" },
  { status: "Ready for Delivery", count: 22, percentage: "7.3%" },
  { status: "Active Subscription", count: 42, percentage: "14.0%" },
  { status: "Delivered/Completed", count: 172, percentage: "57.3%" },
  { status: "Cancelled", count: 15, percentage: "5.0%" },
]

const carwashOrderStatusData = [
  { status: "Pending", count: 10, percentage: "4.0%" },
  { status: "Scheduled", count: 28, percentage: "11.2%" },
  { status: "In Progress", count: 18, percentage: "7.2%" },
  { status: "Active Subscription", count: 45, percentage: "18.0%" },
  { status: "Completed", count: 138, percentage: "55.2%" },
  { status: "Cancelled", count: 11, percentage: "4.4%" },
]

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

export function getDemoCategories(demoBusinessId: string): DemoCategory[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryCategories
    case "standard_laundry":
      return laundryCategories
    case "pro_laundry":
      return proLaundryCategories
    case "pro_carwash":
      return carwashCategories
    default:
      return groceryCategories
  }
}

export function getDemoProducts(demoBusinessId: string): DemoProduct[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryProducts
    case "standard_laundry":
      return laundryProducts
    case "pro_laundry":
      return proLaundryProducts
    case "pro_carwash":
      return carwashProducts
    default:
      return groceryProducts
  }
}

export function getDemoCustomers(demoBusinessId: string): DemoCustomer[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryCustomers
    case "standard_laundry":
    case "pro_laundry":
      return laundryCustomers
    case "pro_carwash":
      return carwashCustomers
    default:
      return groceryCustomers
  }
}

export function getDemoBusinessName(demoBusinessId: string): string {
  switch (demoBusinessId) {
    case "standard_grocery":
      return "FreshMart Grocers"
    case "standard_laundry":
      return "QuickWash Laundry"
    case "pro_laundry":
      return "ProWash Premium"
    case "pro_carwash":
      return "SparkleCar Wash"
    default:
      return "Quantix Platform"
  }
}

export function getDemoOrderPrefix(demoBusinessId: string): string {
  switch (demoBusinessId) {
    case "standard_grocery":
      return "FM-"
    case "standard_laundry":
      return "QW-"
    case "pro_laundry":
      return "PW-"
    case "pro_carwash":
      return "SC-"
    default:
      return "QX-"
  }
}

export function getDemoStoreInfo(demoBusinessId: string): { name: string; email: string; address: string; phone: string; code: string } {
  switch (demoBusinessId) {
    case "standard_grocery":
      return { name: "FreshMart Grocers", email: "info@freshmart.in", address: "Hill Road, Bandra West, Bengaluru", phone: "+91 80 2642 1234", code: "FM-BW01" }
    case "standard_laundry":
      return { name: "QuickWash Laundry", email: "care@quickwash.in", address: "AECS Layout, Kundalahalli, Bengaluru", phone: "+91 80 4123 5678", code: "QW-KD01" }
    case "pro_laundry":
      return { name: "ProWash Premium", email: "hello@prowash.in", address: "HSR Layout, Sector 2, Bengaluru", phone: "+91 80 4987 6543", code: "PW-HS01" }
    case "pro_carwash":
      return { name: "SparkleCar Wash", email: "support@sparklecar.in", address: "Whitefield Main Road, Bengaluru", phone: "+91 80 4321 8765", code: "SC-WF01" }
    default:
      return { name: "Quantix Store", email: "info@quantix.in", address: "Bengaluru, Karnataka", phone: "+91 80 0000 0000", code: "QX-01" }
  }
}

export function getDemoDashboardStats(demoBusinessId: string): DemoDashboardStats {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryDashboardStats
    case "standard_laundry":
      return laundryDashboardStats
    case "pro_laundry":
      return proLaundryDashboardStats
    case "pro_carwash":
      return carwashDashboardStats
    default:
      return groceryDashboardStats
  }
}

export function getDemoDailySales(demoBusinessId: string): { date: string; revenue: number; orders: number }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryDailySales
    case "standard_laundry":
      return laundryDailySales
    case "pro_laundry":
      return proLaundryDailySales
    case "pro_carwash":
      return carwashDailySales
    default:
      return groceryDailySales
  }
}

export function getDemoHourlySales(demoBusinessId: string): { hour: string; revenue: number }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryHourlySales
    case "standard_laundry":
      return laundryHourlySales
    case "pro_laundry":
      return proLaundryHourlySales
    case "pro_carwash":
      return carwashHourlySales
    default:
      return groceryHourlySales
  }
}

export function getDemoRecentActivity(demoBusinessId: string): DemoRecentActivityItem[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryRecentActivity
    case "standard_laundry":
      return laundryRecentActivity
    case "pro_laundry":
      return proLaundryRecentActivity
    case "pro_carwash":
      return carwashRecentActivity
    default:
      return groceryRecentActivity
  }
}

export function getDemoTopProducts(demoBusinessId: string): { name: string; sold: number; revenue: number }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryTopProducts
    case "standard_laundry":
      return laundryTopProducts
    case "pro_laundry":
      return proLaundryTopProducts
    case "pro_carwash":
      return carwashTopProducts
    default:
      return groceryTopProducts
  }
}

export function getDemoBusinessOrders(demoBusinessId: string): DemoBusinessOrder[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryOrders
    case "standard_laundry":
      return laundryOrders
    case "pro_laundry":
      return proLaundryOrders
    case "pro_carwash":
      return carwashOrders
    default:
      return groceryOrders
  }
}

export function getDemoCategoryRevenueData(demoBusinessId: string): { category: string; revenue: number; percentage: string }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryCategoryRevenueData
    case "standard_laundry":
      return laundryCategoryRevenueData
    case "pro_laundry":
      return proLaundryCategoryRevenueData
    case "pro_carwash":
      return carwashCategoryRevenueData
    default:
      return groceryCategoryRevenueData
  }
}

export function getDemoPaymentSummary(demoBusinessId: string): { method: string; count: number; amount: number; percentage: number }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryPaymentSummary
    case "standard_laundry":
      return laundryPaymentSummary
    case "pro_laundry":
      return proLaundryPaymentSummary
    case "pro_carwash":
      return carwashPaymentSummary
    default:
      return groceryPaymentSummary
  }
}

export function getDemoOrderTypeData(demoBusinessId: string): { name: string; value: number; color: string }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryOrderTypeData
    case "standard_laundry":
      return laundryOrderTypeData
    case "pro_laundry":
      return proLaundryOrderTypeData
    case "pro_carwash":
      return carwashOrderTypeData
    default:
      return groceryOrderTypeData
  }
}

export function getDemoOrderStatusData(demoBusinessId: string): { status: string; count: number; percentage: string }[] {
  switch (demoBusinessId) {
    case "standard_grocery":
      return groceryOrderStatusData
    case "standard_laundry":
      return laundryOrderStatusData
    case "pro_laundry":
      return proLaundryOrderStatusData
    case "pro_carwash":
      return carwashOrderStatusData
    default:
      return groceryOrderStatusData
  }
}

export function getDemoBusinessTagline(demoBusinessId: string): string {
  switch (demoBusinessId) {
    case "standard_grocery": return "Fresh groceries delivered to your doorstep"
    case "standard_laundry": return "Expert care for your garments"
    case "pro_laundry": return "Premium laundry at your service"
    case "pro_carwash": return "Your car deserves the best"
    default: return "Quality service, every time"
  }
}

export function getDemoBusinessInitials(demoBusinessId: string): string {
  switch (demoBusinessId) {
    case "standard_grocery": return "FM"
    case "standard_laundry": return "QW"
    case "pro_laundry": return "PW"
    case "pro_carwash": return "SC"
    default: return "QX"
  }
}

export function getDemoCoupons(demoBusinessId: string): Record<string, { discount: number; minOrder: number; description: string }> {
  switch (demoBusinessId) {
    case "standard_grocery":
      return {
        FRESH100: { discount: 100, minOrder: 500, description: "₹100 off on groceries" },
        FREEDEL: { discount: 30, minOrder: 0, description: "Free delivery" },
        WELCOME50: { discount: 50, minOrder: 200, description: "Welcome discount" },
        VEG20: { discount: 0, minOrder: 0, description: "Free delivery on vegetables" },
      }
    case "standard_laundry":
      return {
        WASH50: { discount: 50, minOrder: 300, description: "₹50 off on laundry" },
        FIRSTPICK: { discount: 30, minOrder: 0, description: "Free pickup" },
        NEW25: { discount: 25, minOrder: 150, description: "New customer discount" },
        IRON10: { discount: 0, minOrder: 0, description: "Free ironing on first order" },
      }
    case "pro_laundry":
      return {
        PRO100: { discount: 100, minOrder: 800, description: "₹100 off premium service" },
        SUBFREE: { discount: 0, minOrder: 0, description: "Free subscription setup" },
        EXPRESS49: { discount: 49, minOrder: 200, description: "Express pickup discount" },
        BULK50: { discount: 50, minOrder: 500, description: "Bulk order savings" },
      }
    case "pro_carwash":
      return {
        SPARKLE150: { discount: 150, minOrder: 600, description: "₹150 off detailing" },
        FIRSTWASH: { discount: 0, minOrder: 0, description: "Free exterior wash on first visit" },
        CARCARE99: { discount: 99, minOrder: 400, description: "Car care combo discount" },
        DETAIL200: { discount: 200, minOrder: 1500, description: "Detailing service savings" },
      }
    default:
      return {
        WELCOME50: { discount: 50, minOrder: 200, description: "Welcome discount" },
      }
  }
}
