// ============================================================================
// Product Registry Initialization Helper
// Ensures default products are registered in the platform with feature catalogs
// References: src/lib/product-features.ts
// ============================================================================

import { db } from '@/lib/db'
import {
  COMMERCE_OS_CATALOG,
  LAUNDRY_OS_CATALOG,
  CARWASH_OS_CATALOG,
  type ProductCatalog,
} from '@/lib/product-features'

export interface InitialProduct {
  code: string
  name: string
  slug: string
  description: string
  workspaceUrl: string
  currentVersion: string
  status: 'ACTIVE' | 'PLANNED' | 'DEPRECATED' | 'DISABLED'
  defaultStorageQuotaMB: number
  catalog: ProductCatalog
}

// Default products provided by Quantix platform
const DEFAULT_PRODUCTS: InitialProduct[] = [
  {
    code: 'COMMERCE',
    name: 'Commerce OS',
    slug: 'commerce-os',
    description: 'E-commerce platform for online retail, food delivery, and general commerce businesses',
    workspaceUrl: 'commerce.quantixtechnology.in',
    currentVersion: '2.1.0',
    status: 'ACTIVE',
    defaultStorageQuotaMB: 52428800, // 50GB
    catalog: COMMERCE_OS_CATALOG,
  },
  {
    code: 'LAUNDRY',
    name: 'Laundry OS',
    slug: 'laundry-os',
    description: 'Complete laundry and dry cleaning business management system',
    workspaceUrl: 'laundry.quantixtechnology.in',
    currentVersion: '1.3.0',
    status: 'ACTIVE',
    defaultStorageQuotaMB: 31457280, // 30GB
    catalog: LAUNDRY_OS_CATALOG,
  },
  {
    code: 'CARWASH',
    name: 'Car Wash OS',
    slug: 'carwash-os',
    description: 'Car wash and automotive detailing service management platform',
    workspaceUrl: 'carwash.quantixtechnology.in',
    currentVersion: '1.0.0',
    status: 'PLANNED',
    defaultStorageQuotaMB: 41943040, // 40GB
    catalog: CARWASH_OS_CATALOG,
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
          defaultStorageQuotaMB: product.defaultStorageQuotaMB,
          createdBy: 'SYSTEM',
          metadata: JSON.stringify({
            type: 'CORE_PRODUCT',
            initialized: new Date().toISOString(),
            catalog: {
              features: product.catalog.features,
              roles: product.catalog.roles,
              subscriptionPlans: product.catalog.subscriptionPlans,
            },
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

/**
 * Get a product with full catalog information
 * Parses metadata to include catalog details
 */
export async function getProductWithCatalog(code: string) {
  const product = await getProductByCode(code)
  if (!product) return null

  try {
    const metadata = JSON.parse(product.metadata)
    return {
      ...product,
      catalog: metadata.catalog || null,
    }
  } catch {
    return {
      ...product,
      catalog: null,
    }
  }
}

/**
 * Get all products with catalog information
 */
export async function getAllProductsWithCatalogs() {
  const products = await getAllProducts()
  return products.map((product) => {
    try {
      const metadata = JSON.parse(product.metadata)
      return {
        ...product,
        catalog: metadata.catalog || null,
      }
    } catch {
      return {
        ...product,
        catalog: null,
      }
    }
  })
}
