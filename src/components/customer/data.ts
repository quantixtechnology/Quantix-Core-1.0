"use client"

import { getDemoCategories, getDemoProducts } from "@/lib/demo-data"
import type { WorkflowType } from "@/stores/admin-store"

// Context-aware banner data per business type
const groceryBanners = [
  { id: "ban_1", title: "Fresh Vegetables", subtitle: "Farm to door in 2 hours", color: "#10B981", link: "gcat_1" },
  { id: "ban_2", title: "Dairy Essentials", subtitle: "Up to 15% off on fresh dairy", color: "#3B82F6", link: "gcat_2" },
  { id: "ban_3", title: "Weekend Specials", subtitle: "Flat ₹100 off on orders above ₹500", color: "#F59E0B", link: "" },
  { id: "ban_4", title: "Snack Attack", subtitle: "Buy 2 Get 1 Free on all snacks", color: "#EF4444", link: "gcat_3" },
]

const laundryBanners = [
  { id: "ban_1", title: "Wash & Fold", subtitle: "Fresh clothes from ₹15/piece", color: "#10B981", link: "lcat_1" },
  { id: "ban_2", title: "Dry Cleaning", subtitle: "Premium care for your garments", color: "#8B5CF6", link: "lcat_2" },
  { id: "ban_3", title: "Express Service", subtitle: "Same day delivery available", color: "#3B82F6", link: "" },
]

const proLaundryBanners = [
  { id: "ban_1", title: "Subscription Wash", subtitle: "Monthly packages from ₹899", color: "#8B5CF6", link: "plcat_3" },
  { id: "ban_2", title: "Pickup & Delivery", subtitle: "We come to your doorstep", color: "#3B82F6", link: "plcat_4" },
  { id: "ban_3", title: "Weight Wash", subtitle: "Pay only for what you use", color: "#EF4444", link: "plcat_2" },
  { id: "ban_4", title: "Free Pickup", subtitle: "On orders above ₹300", color: "#10B981", link: "" },
]

const carwashBanners = [
  { id: "ban_1", title: "Monthly Unlimited", subtitle: "Wash your car as many times as you want", color: "#8B5CF6", link: "ccat_1" },
  { id: "ban_2", title: "Pickup Wash", subtitle: "We pick up, wash & return your car", color: "#3B82F6", link: "ccat_2" },
  { id: "ban_3", title: "Book an Appointment", subtitle: "Choose your preferred time slot", color: "#F59E0B", link: "ccat_4" },
  { id: "ban_4", title: "Detailing Service", subtitle: "Full interior & exterior detailing", color: "#EF4444", link: "ccat_5" },
]

const meatBanners = [
  { id: "ban_1", title: "Fresh Daily Cut", subtitle: "Sourced fresh every morning", color: "#d72d58", link: "" },
  { id: "ban_2", title: "Order by 10 AM", subtitle: "Get delivery the same day", color: "#991b1b", link: "" },
  { id: "ban_3", title: "Seafood Special", subtitle: "Prawns, Pomfret & more", color: "#1d4ed8", link: "" },
]

const meatOffers = [
  { id: "off_1", title: "FREE DELIVERY", description: "On all orders today", code: "" },
  { id: "off_2", title: "FRESH DAILY", description: "Sourced fresh every morning", code: "" },
]

// Context-aware offers per business type
const groceryOffers = [
  { id: "off_1", title: "₹100 OFF", description: "On orders above ₹500", code: "FRESH100" },
  { id: "off_2", title: "FREE DELIVERY", description: "On all orders today", code: "FREEDEL" },
  { id: "off_3", title: "20% OFF", description: "On fruits & vegetables", code: "VEG20" },
  { id: "off_4", title: "₹50 OFF", description: "First order special", code: "WELCOME50" },
]

const laundryOffers = [
  { id: "off_1", title: "₹75 OFF", description: "On orders above ₹300", code: "CLEAN75" },
  { id: "off_2", title: "FREE PICKUP", description: "On all orders today", code: "FREEPICK" },
  { id: "off_3", title: "15% OFF", description: "On dry cleaning", code: "DRY15" },
  { id: "off_4", title: "₹50 OFF", description: "First order special", code: "WASH50" },
]

const carwashOffers = [
  { id: "off_1", title: "₹200 OFF", description: "On first subscription", code: "SPARKLE200" },
  { id: "off_2", title: "FREE DETAILING", description: "With unlimited plan", code: "DETAILFREE" },
  { id: "off_3", title: "10% OFF", description: "On appointment wash", code: "BOOK10" },
  { id: "off_4", title: "₹100 OFF", description: "First pickup wash", code: "PICKUP100" },
]

// Helper to get context-aware banners
export function getBanners(demoBusinessId: string) {
  switch (demoBusinessId) {
    case "standard_laundry":
      return laundryBanners
    case "pro_laundry":
      return proLaundryBanners
    case "pro_carwash":
      return carwashBanners
    case "MEAT_DELIVERY":
    case "SEAFOOD":
    case "meat_delivery":
    case "seafood":
      return meatBanners
    case "standard_grocery":
    default:
      return groceryBanners
  }
}

// Helper to get context-aware offers
export function getOffers(demoBusinessId: string) {
  switch (demoBusinessId) {
    case "standard_laundry":
    case "pro_laundry":
      return laundryOffers
    case "pro_carwash":
      return carwashOffers
    case "MEAT_DELIVERY":
    case "SEAFOOD":
    case "meat_delivery":
    case "seafood":
      return meatOffers
    case "standard_grocery":
    default:
      return groceryOffers
  }
}

// Context-aware categories (default to grocery for backward compat)
export const categories = getDemoCategories("standard_grocery").map((c) => ({
  id: c.id, name: c.name, slug: c.slug, productCount: 0, icon: c.icon, color: c.color, sortOrder: c.sortOrder,
}))

// Context-aware products (default to grocery for backward compat)
export const products = getDemoProducts("standard_grocery").map((p) => ({
  id: p.id, name: p.name, slug: p.slug, categoryId: p.categoryId, category: p.category,
  status: p.status, isVeg: p.isVeg, isFeatured: p.isFeatured, image: p.image,
  variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, isDefault: v.isDefault })),
}))

// Default banners and offers (grocery) for backward compatibility
export const banners = groceryBanners
export const offers = groceryOffers

