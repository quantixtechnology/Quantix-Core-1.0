#!/usr/bin/env node
/**
 * DRY-RUN duplicate-customer audit. Reports only — never merges or deletes.
 *
 * Groups customers within each business (tenant) by canonical normalized email
 * and phone, and lists groups with >1 record together with their linked orders,
 * addresses and subscriptions so a human can decide a safe merge. Canonical
 * candidate preference: account-linked (userId) → has email → most orders →
 * oldest. Run:  node scripts/audit-duplicate-customers.js [businessId]
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function normPhone(p) {
  if (!p) return ''
  const d = String(p).replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10) return `+91${d}`
  if (d.startsWith('91') && d.length === 12) return `+${d}`
  if (d.startsWith('0') && d.length === 11) return `+91${d.slice(1)}`
  return String(p).startsWith('+') ? String(p) : `+${d}`
}
const normEmail = (e) => (e ? String(e).trim().toLowerCase() : '')

async function main() {
  const businessId = process.argv[2]
  const where = businessId ? { businessId } : {}
  const customers = await prisma.customer.findMany({ where, orderBy: { createdAt: 'asc' } })
  console.log(`Scanning ${customers.length} customer(s)${businessId ? ` in business ${businessId}` : ''}…\n`)

  // Group by business + canonical key (email preferred, else phone).
  const groups = new Map()
  for (const c of customers) {
    const email = normEmail(c.email)
    const phone = normPhone(c.phone)
    const key = `${c.businessId}::${email || phone || 'id:' + c.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }

  let dupGroups = 0
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    dupGroups++
    // Canonical preference.
    const canonical = [...list].sort((a, b) =>
      (b.userId ? 1 : 0) - (a.userId ? 1 : 0) ||
      (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
      a.createdAt - b.createdAt
    )[0]
    console.log(`── DUPLICATE GROUP: ${key} (${list.length} records) ──`)
    for (const c of list) {
      const [lOrders, cOrders, addrs, subs] = await Promise.all([
        prisma.laundryOrder.count({ where: { customerId: c.id } }).catch(() => 0),
        prisma.order.count({ where: { customerId: c.id } }).catch(() => 0),
        prisma.address.count({ where: { customerId: c.id } }).catch(() => 0),
        prisma.customerSubscription.count({ where: { customerId: c.id } }).catch(() => 0),
      ])
      const mark = c.id === canonical.id ? 'CANONICAL' : 'duplicate'
      console.log(`  [${mark}] ${c.customerCode} id=${c.id} userId=${c.userId || '—'} phone=${c.phone || '—'} email=${c.email || '—'} | laundryOrders=${lOrders} commerceOrders=${cOrders} addresses=${addrs} subs=${subs}`)
    }
    console.log('  → SAFE MERGE PLAN: relink laundryOrders/commerceOrders/addresses/subscriptions to CANONICAL, keep canonical customerCode, then deactivate duplicates. (Not executed — dry-run.)\n')
  }
  console.log(dupGroups === 0 ? 'No duplicate groups found.' : `\n${dupGroups} duplicate group(s) found. Review before any merge.`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
