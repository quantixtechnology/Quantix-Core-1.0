#!/usr/bin/env node

/**
 * P0.7 — FAILURE TESTS
 * Tests graceful failure recovery and error handling
 */

const BASE_URL = 'http://localhost:3000/api'

async function test(name, fn) {
  console.log(`\n[TEST] ${name}`)
  try {
    const result = await fn()
    if (result) {
      console.log('✅ PASS')
      return true
    } else {
      console.log('❌ FAIL')
      return false
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`)
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 1: Invalid email on owner login
// ──────────────────────────────────────────────────────────────────────────
async function testOwnerLoginInvalidEmail() {
  const res = await fetch(`${BASE_URL}/auth/owner-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent@example.com' }),
  })

  const data = await res.json()
  return res.status === 404 && !data.success && data.error.includes('not found')
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 2: Invalid OTP verification
// ──────────────────────────────────────────────────────────────────────────
async function testOwnerLoginInvalidOTP() {
  const res = await fetch(`${BASE_URL}/auth/owner-login`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', otp: '000000' }),
  })

  const data = await res.json()
  return res.status === 401 && !data.success
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 3: Missing required fields on business creation
// ──────────────────────────────────────────────────────────────────────────
async function testBusinessCreationMissingFields() {
  const res = await fetch(`${BASE_URL}/admin/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test' }), // Missing slug and businessType
  })

  const data = await res.json()
  return res.status === 400 && !data.success && data.error.includes('required')
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 4: Duplicate slug on business creation
// ──────────────────────────────────────────────────────────────────────────
async function testBusinessCreationDuplicateSlug() {
  // Create first business
  await fetch(`${BASE_URL}/admin/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Business',
      slug: 'test-dup-slug',
      businessType: 'ECOMMERCE',
    }),
  })

  // Try to create another with same slug
  const res = await fetch(`${BASE_URL}/admin/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Business',
      slug: 'test-dup-slug',
      businessType: 'ECOMMERCE',
    }),
  })

  const data = await res.json()
  return res.status === 409 && !data.success && data.error.includes('already taken')
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 5: Product assignment with invalid product code
// ──────────────────────────────────────────────────────────────────────────
async function testProductAssignmentInvalidProduct() {
  const res = await fetch(`${BASE_URL}/admin/businesses/assign-product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: 'invalid-id',
      productCode: 'NONEXISTENT',
      subscriptionPlanCode: 'STARTER',
    }),
  })

  const data = await res.json()
  return !data.success && (data.error.includes('not found') || res.status >= 400)
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 6: Product assignment with invalid plan
// ──────────────────────────────────────────────────────────────────────────
async function testProductAssignmentInvalidPlan() {
  // Create a business first
  const bizRes = await fetch(`${BASE_URL}/admin/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Business',
      slug: 'test-invalid-plan-' + Date.now(),
      businessType: 'ECOMMERCE',
    }),
  })

  const biz = await bizRes.json()
  const businessId = biz.data.id

  // Try to assign with invalid plan
  const res = await fetch(`${BASE_URL}/admin/businesses/assign-product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId,
      productCode: 'COMMERCE',
      subscriptionPlanCode: 'NONEXISTENT_PLAN',
    }),
  })

  const data = await res.json()
  return !data.success && data.error.includes('not found')
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 7: Provisioning without product assignment
// ──────────────────────────────────────────────────────────────────────────
async function testProvisioningWithoutProductAssignment() {
  // Create business (but don't assign product)
  const bizRes = await fetch(`${BASE_URL}/admin/businesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Business',
      slug: 'test-no-product-' + Date.now(),
      businessType: 'ECOMMERCE',
    }),
  })

  const biz = await bizRes.json()
  const businessId = biz.data.id

  // Try to provision without assigning product
  const res = await fetch(`${BASE_URL}/admin/businesses/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId }),
  })

  const data = await res.json()
  return !data.success && (data.error.includes('not assigned') || data.error.includes('not found'))
}

// ──────────────────────────────────────────────────────────────────────────
// TEST 8: Config health check with invalid config
// ──────────────────────────────────────────────────────────────────────────
async function testConfigHealthCheck() {
  const res = await fetch(`${BASE_URL}/admin/config/health`)
  const data = await res.json()

  // Should always return status, even if not ready
  return data.status !== undefined && data.checklist !== undefined
}

// ──────────────────────────────────────────────────────────────────────────
// RUN ALL TESTS
// ──────────────────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('\n' + '='.repeat(80))
  console.log('P0.7 FAILURE TESTS')
  console.log('='.repeat(80))

  const results = []

  results.push(await test('Owner login with invalid email', testOwnerLoginInvalidEmail))
  results.push(await test('Owner login with invalid OTP', testOwnerLoginInvalidOTP))
  results.push(await test('Business creation with missing fields', testBusinessCreationMissingFields))
  results.push(await test('Business creation with duplicate slug', testBusinessCreationDuplicateSlug))
  results.push(await test('Product assignment with invalid product', testProductAssignmentInvalidProduct))
  results.push(await test('Product assignment with invalid plan', testProductAssignmentInvalidPlan))
  results.push(await test('Provisioning without product assignment', testProvisioningWithoutProductAssignment))
  results.push(await test('Config health check response', testConfigHealthCheck))

  const passed = results.filter(r => r).length
  const total = results.length

  console.log('\n' + '='.repeat(80))
  console.log(`SUMMARY: ${passed}/${total} tests passed`)
  console.log('='.repeat(80) + '\n')

  process.exit(passed === total ? 0 : 1)
}

runAllTests().catch(error => {
  console.error('Test suite error:', error)
  process.exit(1)
})
