"use client"

// ============================================================================
// StorefrontEmptyState — reusable empty state for all 5 commerce surfaces.
//
// Every business inherits the same polished empty UX.  No page writes
// its own empty state markup.
//
// Usage:
//   <StorefrontEmptyState variant="no-products" />
//   <StorefrontEmptyState variant="empty-cart" brandColor={c} onAction={() => nav.go("home")} />
// ============================================================================

import { ShoppingCart, Package, Search, ClipboardList, Heart } from "lucide-react"
import { TYPE, BTN_MD, primaryBtnStyle } from "@/design-system"

export type EmptyVariant =
  | "no-products"
  | "no-results"
  | "empty-cart"
  | "no-orders"
  | "empty-wishlist"

interface EmptyConfig {
  Icon: React.ElementType
  title: string
  sub: string
  defaultAction: string
}

const CONFIGS: Record<EmptyVariant, EmptyConfig> = {
  "no-products": {
    Icon: Package,
    title: "No products yet",
    sub: "Products are being stocked. Check back soon.",
    defaultAction: "Browse Categories",
  },
  "no-results": {
    Icon: Search,
    title: "No results found",
    sub: "Try different keywords or browse all categories.",
    defaultAction: "Browse All",
  },
  "empty-cart": {
    Icon: ShoppingCart,
    title: "Your cart is empty",
    sub: "Add some products to get started.",
    defaultAction: "Shop Now",
  },
  "no-orders": {
    Icon: ClipboardList,
    title: "No orders yet",
    sub: "Your order history will appear here after your first purchase.",
    defaultAction: "Start Shopping",
  },
  "empty-wishlist": {
    Icon: Heart,
    title: "Nothing saved yet",
    sub: "Tap the heart icon on any product to save it here.",
    defaultAction: "Explore Products",
  },
}

interface StorefrontEmptyStateProps {
  variant: EmptyVariant
  brandColor?: string
  onAction?: () => void
  /** Override the default action label */
  actionLabel?: string
  /** Hide the action button entirely */
  hideAction?: boolean
}

export function StorefrontEmptyState({
  variant,
  brandColor = "#10B981",
  onAction,
  actionLabel,
  hideAction = false,
}: StorefrontEmptyStateProps) {
  const { Icon, title, sub, defaultAction } = CONFIGS[variant]

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 gap-3 text-center">
      <Icon className="w-14 h-14 text-gray-200" strokeWidth={1.5} />
      <p className={TYPE.EMPTY_TITLE}>{title}</p>
      <p className={TYPE.EMPTY_SUB}>{sub}</p>
      {!hideAction && onAction && (
        <button
          onClick={onAction}
          className={`${BTN_MD} mt-2`}
          style={primaryBtnStyle(brandColor)}
        >
          {actionLabel ?? defaultAction}
        </button>
      )}
    </div>
  )
}
