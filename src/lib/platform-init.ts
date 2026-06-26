// ============================================================================
// Platform Initialization
// Auto-initializes platform components on startup
// Idempotent — safe to call multiple times
// ============================================================================

import { db } from '@/lib/db'
import { initializeProductRegistry } from '@/lib/product-registry-init'

let initialized = false

/**
 * Initialize platform on startup
 * Automatically registers products if not already registered
 * Called once per process on first application request
 */
export async function initializePlatform(): Promise<void> {
  if (initialized) return

  try {
    // Check if any products already exist
    const existingProducts = await db.platformProduct.count()

    // Only initialize if no products registered
    if (existingProducts === 0) {
      await initializeProductRegistry()
    }

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
