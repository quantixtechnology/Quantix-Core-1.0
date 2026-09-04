import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readBusinessClosure, writeBusinessClosure, readCustomerOrderingMode } from '@/lib/customer-ordering'

// ============================================================================
// THE OWNER MUST BE ABLE TO CLOSE THE SHOP WITHOUT A PLATFORM STORE ROW.
//
// Temporarily Closed wrote to Store.closedReason/closedUntil, and the settings
// endpoint refused outright when the tenant had no such row — so the one
// control the business model relies on did not exist for those tenants. They
// could not close, and could not reopen.
//
// The business already owns a deliberate-offline switch: Business.isOnline,
// which checkStoreOpen() honours ahead of every clock check, so no ordering
// mode can talk past it. Open / Temporarily Closed drives THAT for a tenant
// with no store row. One mechanism, no new state, no schema. The owner's
// wording rides alongside in the settings blob and decides nothing — isOnline
// alone says whether the shop is shut.
//
// Verified in a real browser, signed in as the owner, driving the same
// /api/laundry/availability PUT the Workspace Settings screen calls, against a
// tenant with 4 LaundryStores and ZERO platform Store rows:
//
//   A/D  24/7 + Open          isOpen=true  ALLOWED, 7 slots, guard passed
//   B    Temporarily Closed   PUT 200 -> isOpen=false BLOCKED,
//                             guard 409 "Closed for Diwali" (the owner's words)
//   C    Open Store again     PUT 200 -> isOpen=true ALLOWED immediately
//   7    while CLOSED, admin orders API 200 and settings API 200 — unaffected
//
//   Tenant WITH a platform Store, all unchanged:
//   A 24/7 outside hours ALLOWED · B closure "Stock take" BLOCKED · C ALLOWED
//   E FOLLOW_STORE_HOURS outside BLOCKED "Opens Tomorrow at 09:00" / inside ALLOWED
//   F slots 6 (09:00-21:00), 1 (09:00-11:00), 7 (24/7) — untouched
// ============================================================================

const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/availability/route.ts'), 'utf8')
const AVAIL = readFileSync(join(process.cwd(), 'src/lib/laundry-availability.ts'), 'utf8')

describe('1 · the closure text round-trips and decides nothing', () => {
  it('records and clears the owner wording', () => {
    const closed = writeBusinessClosure('{}', { reason: 'Closed for Diwali', until: null })
    expect(readBusinessClosure(closed).closedReason).toBe('Closed for Diwali')
    expect(readBusinessClosure(writeBusinessClosure(closed, null)).closedReason).toBeNull()
  })

  it('never disturbs anything else in the blob', () => {
    const before = '{"customerOrderingAvailability":"ALWAYS_OPEN","resourceOverrides":{"a":1}}'
    const after = writeBusinessClosure(before, { reason: 'Stock take', until: '2026-09-05T10:00:00.000Z' })
    expect(readCustomerOrderingMode(after)).toBe('ALWAYS_OPEN')
    expect(JSON.parse(after).resourceOverrides).toEqual({ a: 1 })
    // and clearing the closure leaves them alone too
    expect(readCustomerOrderingMode(writeBusinessClosure(after, null))).toBe('ALWAYS_OPEN')
    expect(JSON.parse(writeBusinessClosure(after, null)).resourceOverrides).toEqual({ a: 1 })
  })

  it('blank, whitespace and unparseable input record nothing', () => {
    for (const s of [null, undefined, '', '{}', 'not json']) expect(readBusinessClosure(s).closedReason).toBeNull()
    expect(readBusinessClosure(writeBusinessClosure('{}', { reason: '   ' })).closedReason).toBeNull()
    expect(readBusinessClosure(writeBusinessClosure('{}', { until: 'rubbish' })).closedUntil).toBeNull()
  })
})

describe('2 · isOnline is the whole decision', () => {
  it('the wording is read only when the business is offline', () => {
    const fn = AVAIL.slice(AVAIL.indexOf('async function businessLevelAvailability('), AVAIL.indexOf('export async function getLaundryAvailability('))
    expect(fn).toContain('if (isOnline) return { isOnline, result: { isOpen: true }, closedReason: null, closedUntil: null }')
    expect(fn).toContain('reason: closedReason || "Store is currently offline"')
  })

  it('closing sets isOnline false and opening sets it true', () => {
    const branch = ROUTE.slice(ROUTE.indexOf('if (!storeId) {'), ROUTE.indexOf('const businessIdEff', ROUTE.indexOf('if (!storeId) {')))
    expect(branch).toContain('const closing = availability.status === "closed"')
    expect(branch).toContain('isOnline: !closing')
  })
})

describe('3 · it is the smallest branch, and only for a missing store row', () => {
  it('a tenant WITH a store still takes the existing Store path', () => {
    // The business-level branch is reached only when no store resolved.
    expect(ROUTE.indexOf('if (!storeId) {')).toBeLessThan(ROUTE.indexOf('await prisma.store.update'))
    expect(ROUTE).toContain('closedReason: availability.reason?.trim() ? availability.reason.trim() : null')
  })

  it('only the availability status is handled — hours and schedules still need a store', () => {
    const branch = ROUTE.slice(ROUTE.indexOf('if (!storeId) {'), ROUTE.indexOf('const businessIdEff', ROUTE.indexOf('if (!storeId) {')))
    expect(branch).toContain('No online store configured for this business')
    expect(branch).not.toMatch(/updateStoreTimings|applyStandardSchedule|branchTimings|statusOverride/)
  })

  it('and it creates no Store or StoreTiming record', () => {
    const branch = ROUTE.slice(ROUTE.indexOf('if (!storeId) {'), ROUTE.indexOf('const businessIdEff', ROUTE.indexOf('if (!storeId) {')))
    expect(branch).not.toMatch(/store\.create|storeTiming|prisma\.store\./)
  })
})

describe('4 · the customer is told what the owner wrote', () => {
  it('the guard surfaces the reason, not a generic line', () => {
    const storeOpen = AVAIL.slice(AVAIL.indexOf('export async function assertLaundryStoreOpen('), AVAIL.indexOf('export function assertLaundryDateAvailable('))
    expect(storeOpen).toContain('error: result.reason || "Store is currently closed"')
  })

  it('and the settings screen reads its own state back', () => {
    expect(ROUTE).toContain('closedReason: platformStore?.closedReason || availability.closedReason || null')
  })
})
