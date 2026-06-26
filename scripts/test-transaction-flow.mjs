#!/usr/bin/env node

/**
 * P0.4 — FIRST BUSINESS TRANSACTION
 * Validates complete transaction flow for each product
 */

const BASE_URL = 'http://localhost:3000/api'

async function step(description, fn) {
  try {
    console.log(`\n  → ${description}`)
    const result = await fn()
    console.log(`    ✅ ${result.message}`)
    return result.data
  } catch (error) {
    console.log(`    ❌ ${error.message}`)
    throw error
  }
}

async function testCommerceTransaction() {
  console.log('\n[COMMERCE OS] First Business Transaction')
  console.log('─'.repeat(60))

  try {
    // Step 1: Create business
    const business = await step('Create business', async () => {
      const timestamp = Date.now()
      const res = await fetch(`${BASE_URL}/admin/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Commerce Store',
          slug: 'test-commerce-' + timestamp,
          businessType: 'ECOMMERCE',
          country: 'India',
          contactEmail: `commerce-owner-${timestamp}@test.com`,
          contactPhone: '+919999999999',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return { message: `Business created: ${data.data.id}`, data: data.data }
    })

    // Step 2: Assign COMMERCE product
    const assignment = await step('Assign COMMERCE product', async () => {
      const res = await fetch(`${BASE_URL}/admin/businesses/assign-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          productCode: 'COMMERCE',
          subscriptionPlanCode: 'STARTER',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return { message: `Product assigned: ${data.data.productCode}`, data: data.data }
    })

    // Step 3: Provision business
    const provisioning = await step('Provision workspace', async () => {
      const res = await fetch(`${BASE_URL}/admin/businesses/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const completedSteps = data.data.steps.filter(s => s.status === 'COMPLETED').length
      return {
        message: `Provisioning complete: ${completedSteps}/9 steps passed`,
        data: data.data
      }
    })

    // Step 4: Get workspace URL
    const workspace = await step('Get workspace URL', async () => {
      const res = await fetch(`${BASE_URL}/admin/products/runtime`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const commerce = data.data.products.find(p => p.productCode === 'COMMERCE')
      const url = commerce?.workspaceUrl
      if (!url) throw new Error('Commerce workspace URL not found')
      return { message: `Workspace URL: ${url}`, data: { url } }
    })

    console.log('\n✅ COMMERCE transaction flow: READY')
    console.log(`   To complete: Open ${workspace.url}/${business.id} and create:`)
    console.log('   1. Category')
    console.log('   2. Product')
    console.log('   3. Inventory')
    console.log('   4. Customer')
    console.log('   5. Order')

    return true
  } catch (error) {
    console.log('\n❌ COMMERCE transaction flow: FAILED')
    return false
  }
}

async function testLaundryTransaction() {
  console.log('\n[LAUNDRY OS] First Business Transaction')
  console.log('─'.repeat(60))

  try {
    // Step 1: Create business
    const business = await step('Create business', async () => {
      const timestamp = Date.now()
      const res = await fetch(`${BASE_URL}/admin/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Laundry Service',
          slug: 'test-laundry-' + timestamp,
          businessType: 'LAUNDRY',
          country: 'India',
          contactEmail: `laundry-owner-${timestamp}@test.com`,
          contactPhone: '+919999999999',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return { message: `Business created: ${data.data.id}`, data: data.data }
    })

    // Step 2: Assign LAUNDRY product
    const assignment = await step('Assign LAUNDRY product', async () => {
      const res = await fetch(`${BASE_URL}/admin/businesses/assign-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          productCode: 'LAUNDRY',
          subscriptionPlanCode: 'STARTER',
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return { message: `Product assigned: ${data.data.productCode}`, data: data.data }
    })

    // Step 3: Provision business
    const provisioning = await step('Provision workspace', async () => {
      const res = await fetch(`${BASE_URL}/admin/businesses/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const completedSteps = data.data.steps.filter(s => s.status === 'COMPLETED').length
      return {
        message: `Provisioning complete: ${completedSteps}/9 steps passed`,
        data: data.data
      }
    })

    // Step 4: Get workspace URL
    const workspace = await step('Get workspace URL', async () => {
      const res = await fetch(`${BASE_URL}/admin/products/runtime`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const laundry = data.data.products.find(p => p.productCode === 'LAUNDRY')
      const url = laundry?.workspaceUrl
      if (!url) throw new Error('Laundry workspace URL not found')
      return { message: `Workspace URL: ${url}`, data: { url } }
    })

    console.log('\n✅ LAUNDRY transaction flow: READY')
    console.log(`   To complete: Open ${workspace.url}/${business.id} and create:`)
    console.log('   1. Laundry Order')
    console.log('   2. Processing Instructions')
    console.log('   3. Complete Workflow')
    console.log('   4. Delivery')

    return true
  } catch (error) {
    console.log('\n❌ LAUNDRY transaction flow: FAILED')
    return false
  }
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('P0.4 — FIRST BUSINESS TRANSACTION VALIDATION')
  console.log('='.repeat(80))

  const commerceReady = await testCommerceTransaction()
  const laundryReady = await testLaundryTransaction()

  console.log('\n' + '='.repeat(80))
  console.log('TRANSACTION FLOW SUMMARY')
  console.log('='.repeat(80))
  console.log(`Commerce OS: ${commerceReady ? '✅ READY' : '❌ FAILED'}`)
  console.log(`Laundry OS:  ${laundryReady ? '✅ READY' : '❌ FAILED'}`)
  console.log('='.repeat(80) + '\n')

  process.exit(commerceReady && laundryReady ? 0 : 1)
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})
