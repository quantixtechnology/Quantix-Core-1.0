// ============================================================================
// Platform Initialization
// Auto-initializes platform components on startup
// Idempotent — safe to call multiple times
// ============================================================================

import { db } from '@/lib/db'
import { initializeProductRegistry } from '@/lib/product-registry-init'
import {
  initializeCommerceOS,
  initializeLaundryOS,
} from '@/lib/product-initialization'
import { initializeCommerceProduct } from '@/lib/products/commerce-init'
import { initializeLaundryProduct } from '@/lib/products/laundry-init'

let initialized = false

/**
 * Initialize platform on startup
 * Automatically registers products and their plans if not already registered
 * Called once per process on first application request
 */
export async function initializePlatform(): Promise<void> {
  if (initialized) return

  try {
    // Check if any products already exist
    const existingProducts = await db.platformProduct.count()

    // Initialize product registry if no products registered
    if (existingProducts === 0) {
      await initializeProductRegistry()
    }

    // Check if plans are initialized
    const existingPlans = await db.productPlan.count()

    // Initialize product plans if missing
    if (existingPlans === 0) {
      await initializeCommerceOS()
      await initializeLaundryOS()
    }

    // Initialize product provisioners and runtime configurations
    await initializeCommerceProduct()
    await initializeLaundryProduct()

    initialized = true
  } catch (error) {
    // Initialization errors should not block application startup
    console.error('[PLATFORM INIT] Failed to initialize platform:', error)
    // Set flag anyway to avoid repeated attempts
    initialized = true
  }
}

/**
 * Reset initialization flag for testing
 */
export function resetInitializationFlag(): void {
  initialized = false
}
