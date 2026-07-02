// Integration test — Customer India Address save→read round-trip.
// Exercises the REAL HTTP API (create → DB → search → read-back) and asserts
// every address field matches. Requires the dev/prod server running.
//   BASE_URL=http://localhost:3000 npx tsx scripts/test-customer-address.mjs
// Exits 0 on pass, 1 on any failure.

import { PrismaClient } from "@prisma/client"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const prisma = new PrismaClient()
let failures = 0
const ok = (cond, msg) => { console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`); if (!cond) failures++ }

const ADDR = {
  addressLine1: "221, 5th Cross",
  addressLine2: "HSR Layout",
  area: "Sector 7",
  landmark: "Near Central Park",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560102",
  country: "India",
}

async function main() {
  const biz = await prisma.laundryBusiness.findFirst({ select: { platformBusinessId: true } })
  if (!biz?.platformBusinessId) { console.error("No laundry business found to test against."); process.exit(1) }
  const businessId = biz.platformBusinessId
  const mobile = "9" + String(Date.now()).slice(-9)
  let customerId = null

  try {
    // 1) CREATE
    console.log("\n[1] POST /api/laundry/customers")
    const createRes = await fetch(`${BASE}/api/laundry/customers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, name: "Integration Test Customer", mobile, alternateMobile: "9111122223", email: "itest@example.com", ...ADDR }),
    })
    const created = await createRes.json()
    ok(createRes.status === 201 && created.success, `create returns 201/success (got ${createRes.status})`)
    customerId = created?.data?.id
    ok(!!customerId, "response includes new customer id")

    // 2) DB — customer + address persisted with every field
    console.log("[2] DB verification")
    const dbCust = await prisma.customer.findUnique({ where: { id: customerId }, include: { addresses: true } })
    ok(!!dbCust, "customer row exists in DB")
    ok(dbCust?.addresses.length === 1, "exactly one address row created")
    const a = dbCust?.addresses[0] || {}
    for (const [k, v] of Object.entries(ADDR)) ok(a[k] === v, `address.${k} == "${v}" (got "${a[k]}")`)
    ok(a.isDefault === true, "address.isDefault == true")

    // 3) SEARCH — new customer appears with full address
    console.log("[3] GET /api/laundry/customers/search")
    const searchRes = await fetch(`${BASE}/api/laundry/customers/search?businessId=${businessId}&q=${mobile}`)
    const search = await searchRes.json()
    const hit = (search.data || []).find((c) => c.id === customerId)
    ok(!!hit, "new customer appears in Existing Customer search")
    const sa = hit?.addresses?.[0] || {}
    for (const [k, v] of Object.entries(ADDR)) ok(sa[k] === v, `search address.${k} == "${v}"`)

    // 4) READ-BACK — GET /[id] returns every field + computed fullAddress
    console.log("[4] GET /api/laundry/customers/[id]")
    const readRes = await fetch(`${BASE}/api/laundry/customers/${customerId}?businessId=${businessId}`)
    const read = await readRes.json()
    const ra = read?.data?.addresses?.[0] || {}
    for (const [k, v] of Object.entries(ADDR)) ok(ra[k] === v, `read address.${k} == "${v}"`)
    const expectedFull = "221, 5th Cross, HSR Layout, Sector 7, Bangalore, Karnataka - 560102, India"
    ok(read?.data?.fullAddress === expectedFull, `fullAddress formatted correctly`)

    // 5) EDIT — PUT updates address
    console.log("[5] PUT /api/laundry/customers/[id] (edit address)")
    const editRes = await fetch(`${BASE}/api/laundry/customers/${customerId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, city: "Mysore", pincode: "570001", state: "Karnataka", addressLine1: ADDR.addressLine1, area: ADDR.area }),
    })
    const edited = await editRes.json()
    ok(editRes.ok && edited.success, "edit returns success")
    const ea = edited?.data?.addresses?.[0] || {}
    ok(ea.city === "Mysore" && ea.pincode === "570001", `edit persisted (city=${ea.city}, pin=${ea.pincode})`)

    // 6) VALIDATION — bad PIN rejected
    console.log("[6] PIN validation")
    const badRes = await fetch(`${BASE}/api/laundry/customers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, name: "Bad Pin", mobile: "9" + String(Date.now() + 1).slice(-9), pincode: "12ab5" }),
    })
    ok(badRes.status === 400, `invalid PIN rejected with 400 (got ${badRes.status})`)
  } finally {
    if (customerId) {
      await prisma.address.deleteMany({ where: { customerId } })
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {})
      await prisma.customer.deleteMany({ where: { name: "Bad Pin", businessId } }).catch(() => {})
    }
  }

  console.log(`\n${failures === 0 ? "✅ PASS" : `❌ FAIL (${failures} assertion${failures === 1 ? "" : "s"})`} — Customer India Address round-trip`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
