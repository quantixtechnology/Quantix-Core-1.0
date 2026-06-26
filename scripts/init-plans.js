const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function initializeCommerceOS() {
  console.log('Initializing COMMERCE OS plans...')
  
  const existing = await db.productPlan.findMany({
    where: { productCode: 'COMMERCE' }
  })
  
  if (existing.length > 0) {
    console.log(`COMMERCE already has ${existing.length} plans`)
    return
  }
  
  await db.productPlan.create({
    data: {
      productCode: 'COMMERCE',
      code: 'STARTER',
      name: 'Starter Plan',
      description: 'Perfect for new online stores',
      includedFeatures: JSON.stringify(['PRODUCTS', 'INVENTORY', 'ORDERS', 'CUSTOMERS']),
      storageQuotaMB: 10737418,
      userLimit: 5,
      branchLimit: 1,
      pricing: JSON.stringify({ amount: 2999, interval: 'monthly', currency: 'INR' }),
      isDefault: true,
    }
  })
  
  await db.productPlan.create({
    data: {
      productCode: 'COMMERCE',
      code: 'PROFESSIONAL',
      name: 'Professional Plan',
      description: 'For growing online businesses',
      includedFeatures: JSON.stringify(['PRODUCTS', 'INVENTORY', 'ORDERS', 'CUSTOMERS', 'ANALYTICS']),
      storageQuotaMB: 21474836,
      userLimit: 15,
      branchLimit: 5,
      pricing: JSON.stringify({ amount: 4999, interval: 'monthly', currency: 'INR' }),
      isDefault: false,
    }
  })
  
  await db.productPlan.create({
    data: {
      productCode: 'COMMERCE',
      code: 'ENTERPRISE',
      name: 'Enterprise Plan',
      description: 'For large-scale operations',
      includedFeatures: JSON.stringify(['PRODUCTS', 'INVENTORY', 'ORDERS', 'CUSTOMERS', 'ANALYTICS', 'API_ACCESS']),
      storageQuotaMB: 52428800,
      userLimit: 50,
      branchLimit: 20,
      pricing: JSON.stringify({ amount: 9999, interval: 'monthly', currency: 'INR' }),
      isDefault: false,
    }
  })
  
  console.log('✓ COMMERCE OS plans created')
}

async function main() {
  try {
    await initializeCommerceOS()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.$disconnect()
  }
}

main()
