"use client"

// ============================================================================
// Quantix Platform — Business-Context-Aware Demo Data
// Provides categories, products, and customers matching each demo business type
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
    addresses: [
      { id: "ga_1", label: "Home", line1: "42, MG Road, Koramangala", line2: "Near Jyoti Nivas College", city: "Bengaluru", pincode: "560034", isDefault: true },
      { id: "ga_2", label: "Office", line1: "101, Brigade Metropolis", line2: "Garvebhavipalya", city: "Bengaluru", pincode: "560068", isDefault: false },
    ],
  },
  {
    id: "gcust_2", name: "Sneha Patil", phone: "+91 87654 32109", email: "sneha.patil@email.com",
    totalOrders: 18, totalSpent: 12300, loyaltyPoints: 2100, tier: "GOLD", lastOrder: "2026-05-07T10:15:00",
    addresses: [
      { id: "ga_3", label: "Home", line1: "15, HSR Layout, Sector 2", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
    ],
  },
  {
    id: "gcust_3", name: "Anand Joshi", phone: "+91 76543 21098", email: "anand.joshi@email.com",
    totalOrders: 12, totalSpent: 8900, loyaltyPoints: 1450, tier: "SILVER", lastOrder: "2026-05-06T16:45:00",
    addresses: [
      { id: "ga_4", label: "Home", line1: "78, Indiranagar, 100ft Road", line2: "Above Nilgiris", city: "Bengaluru", pincode: "560038", isDefault: true },
    ],
  },
  {
    id: "gcust_4", name: "Deepa Nair", phone: "+91 65432 10987", email: "deepa.nair@email.com",
    totalOrders: 8, totalSpent: 5600, loyaltyPoints: 800, tier: "SILVER", lastOrder: "2026-05-04T09:00:00",
    addresses: [
      { id: "ga_5", label: "Home", line1: "23, Whitefield Main Road", line2: "Near ITPL", city: "Bengaluru", pincode: "560066", isDefault: true },
    ],
  },
  {
    id: "gcust_5", name: "Mohan Sharma", phone: "+91 54321 09876", email: "mohan.sharma@email.com",
    totalOrders: 5, totalSpent: 3200, loyaltyPoints: 450, tier: "BRONZE", lastOrder: "2026-05-01T11:30:00",
    addresses: [
      { id: "ga_6", label: "Home", line1: "56, JP Nagar, Phase 3", line2: "", city: "Bengaluru", pincode: "560078", isDefault: true },
    ],
  },
  {
    id: "gcust_6", name: "Kavita Reddy", phone: "+91 43210 98765", email: "kavita.reddy@email.com",
    totalOrders: 15, totalSpent: 11200, loyaltyPoints: 1900, tier: "GOLD", lastOrder: "2026-05-08T18:20:00",
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
    addresses: [
      { id: "la_1", label: "Home", line1: "12, AECS Layout, Kundalahalli", line2: "Near Brookefield", city: "Bengaluru", pincode: "560037", isDefault: true },
    ],
  },
  {
    id: "lcust_2", name: "Vikram Patel", phone: "+91 88776 65544", email: "vikram.patel@email.com",
    totalOrders: 22, totalSpent: 16500, loyaltyPoints: 2800, tier: "GOLD", lastOrder: "2026-05-07T09:15:00",
    addresses: [
      { id: "la_2", label: "Home", line1: "45, Marathahalli Bridge", line2: "Opp. Innovative Multiplex", city: "Bengaluru", pincode: "560037", isDefault: true },
    ],
  },
  {
    id: "lcust_3", name: "Meera Iyer", phone: "+91 77665 54433", email: "meera.iyer@email.com",
    totalOrders: 15, totalSpent: 9200, loyaltyPoints: 1600, tier: "SILVER", lastOrder: "2026-05-06T14:00:00",
    addresses: [
      { id: "la_3", label: "Home", line1: "78, Bellandur, Outer Ring Road", line2: "Near Intel Office", city: "Bengaluru", pincode: "560103", isDefault: true },
    ],
  },
  {
    id: "lcust_4", name: "Arjun Reddy", phone: "+91 66554 43322", email: "arjun.reddy@email.com",
    totalOrders: 28, totalSpent: 21400, loyaltyPoints: 3800, tier: "PLATINUM", lastOrder: "2026-05-08T11:45:00",
    addresses: [
      { id: "la_4", label: "Home", line1: "23, HSR Layout, Sector 7", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
      { id: "la_5", label: "Office", line1: "56, EcoSpace, Outer Ring Road", line2: "Bellandur", city: "Bengaluru", pincode: "560103", isDefault: false },
    ],
  },
  {
    id: "lcust_5", name: "Sunita Deshmukh", phone: "+91 55443 32211", email: "sunita.d@email.com",
    totalOrders: 9, totalSpent: 5400, loyaltyPoints: 750, tier: "SILVER", lastOrder: "2026-05-03T10:30:00",
    addresses: [
      { id: "la_6", label: "Home", line1: "90, BTM Layout, 2nd Stage", line2: "", city: "Bengaluru", pincode: "560076", isDefault: true },
    ],
  },
  {
    id: "lcust_6", name: "Rahul Verma", phone: "+91 44332 21100", email: "rahul.verma@email.com",
    totalOrders: 4, totalSpent: 2800, loyaltyPoints: 350, tier: "BRONZE", lastOrder: "2026-04-28T17:00:00",
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
    addresses: [
      { id: "ca_1", label: "Home", line1: "15, Palm Meadows, Whitefield", line2: "", city: "Bengaluru", pincode: "560066", isDefault: true },
    ],
  },
  {
    id: "ccust_2", name: "Neha Gupta", phone: "+91 87012 34567", email: "neha.gupta@email.com",
    totalOrders: 24, totalSpent: 28900, loyaltyPoints: 4100, tier: "PLATINUM", lastOrder: "2026-05-07T15:30:00",
    addresses: [
      { id: "ca_2", label: "Home", line1: "42, Prestige Shantiniketan", line2: "ITPL Road, Whitefield", city: "Bengaluru", pincode: "560048", isDefault: true },
    ],
  },
  {
    id: "ccust_3", name: "Amit Singhania", phone: "+91 76098 76543", email: "amit.s@email.com",
    totalOrders: 18, totalSpent: 18200, loyaltyPoints: 2800, tier: "GOLD", lastOrder: "2026-05-06T11:00:00",
    addresses: [
      { id: "ca_3", label: "Home", line1: "88, Sobha Lakeview, HSR Layout", line2: "", city: "Bengaluru", pincode: "560102", isDefault: true },
      { id: "ca_4", label: "Office", line1: "101, Embassy Tech Village", line2: "Outer Ring Road, Marathahalli", city: "Bengaluru", pincode: "560103", isDefault: false },
    ],
  },
  {
    id: "ccust_4", name: "Sunita Rao", phone: "+91 65087 65432", email: "sunita.rao@email.com",
    totalOrders: 14, totalSpent: 12800, loyaltyPoints: 1900, tier: "GOLD", lastOrder: "2026-05-05T09:45:00",
    addresses: [
      { id: "ca_5", label: "Home", line1: "33, Brigade Cosmos, Malleshwaram", line2: "", city: "Bengaluru", pincode: "560055", isDefault: true },
    ],
  },
  {
    id: "ccust_5", name: "Karthik Menon", phone: "+91 54076 54321", email: "karthik.m@email.com",
    totalOrders: 7, totalSpent: 6500, loyaltyPoints: 950, tier: "SILVER", lastOrder: "2026-05-02T14:15:00",
    addresses: [
      { id: "ca_6", label: "Home", line1: "77, RMZ Ecoworld, Bellandur", line2: "", city: "Bengaluru", pincode: "560103", isDefault: true },
    ],
  },
  {
    id: "ccust_6", name: "Divya Nambiar", phone: "+91 43065 43210", email: "divya.n@email.com",
    totalOrders: 3, totalSpent: 2400, loyaltyPoints: 300, tier: "BRONZE", lastOrder: "2026-04-29T16:00:00",
    addresses: [
      { id: "ca_7", label: "Home", line1: "22, Jayanagar, 4th Block", line2: "Near Lalbagh", city: "Bengaluru", pincode: "560041", isDefault: true },
    ],
  },
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
