// ============================================================================
// Product Registry Initialization Helper
// Ensures default products are registered in the platform
// ============================================================================

import { db } from '@/lib/db'

export interface InitialProduct {
  code: string
  name: string
  slug: string
  description: string
  workspaceUrl: string
  currentVersion: string
  status: 'ACTIVE' | 'PLANNED' | 'DEPRECATED' | 'DISABLED'
}

// Default products provided by Quantix platform
const DEFAULT_PRODUCTS: InitialProduct[] = [
  {
    code: 'COMMERCE',
    name: 'Commerce OS',
    slug: 'commerce-os',
    description: 'E-commerce platform for online retail, food delivery, and general commerce businesses',
    workspaceUrl: 'commerce.quantixtechnology.in',
    currentVersion: '1.0.0',
    status: 'ACTIVE',
  },
  {
    code: 'LAUNDRY',
    name: 'Laundry OS',
    slug: 'laundry-os',
    description: 'Complete laundry and dry cleaning business management system',
    workspaceUrl: 'laundry.quantixtechnology.in',
    currentVersion: '1.0.0',
    status: 'ACTIVE',
  },
  {
    code: 'CARWASH',
    name: 'Car Wash OS',
    slug: 'carwash-os',
    description: 'Car wash and automotive detailing service management platform',
    workspaceUrl: 'carwash.quantixtechnology.in',
    currentVersion: '1.0.0',
    status: 'PLANNED',
  },
]

/**
 * Initialize default products in the Product Registry
 * Idempotent — safe to call multiple times
 * Returns number of products created (0 if all already exist)
 */
export async function initializeProductRegistry(): Promise<number> {
  let created = 0

  for (const product of DEFAULT_PRODUCTS) {
    const existing = await db.platformProduct.findUnique({
      where: { code: product.code },
    })

    if (!existing) {
      await db.platformProduct.create({
        data: {
          code: product.code,
          name: product.name,
          slug: product.slug,
          description: product.description,
          workspaceUrl: product.workspaceUrl,
          currentVersion: product.currentVersion,
          status: product.status,
          isEnabled: product.status === 'ACTIVE',
          defaultStorageQuotaMB: 1048576, // 1GB
          createdBy: 'SYSTEM',
          metadata: JSON.stringify({
            type: 'CORE_PRODUCT',
            initialized: new Date().toISOString(),
          }),
        },
      })
      created++
    }
  }

  return created
}

/**
 * Get all registered products
 */
export async function getAllProducts() {
  return db.platformProduct.findMany({
    where: { isEnabled: true },
    orderBy: { status: 'asc' },
  })
}

/**
 * Get a product by code
 */
export async function getProductByCode(code: string) {
  return db.platformProduct.findUnique({
    where: { code },
  })
}
