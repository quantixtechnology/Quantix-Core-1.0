import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  isProcessingCapable, requiresProcessingCenterAssignment, processingAssignmentRefusal,
  resolveProcessingCenterId, needsProcessingCenterBackfill, processingCapableStoreWhere,
  isCustomerFacingStore,
  NO_PROCESSING_CENTER, PROCESSING_CENTER_INACTIVE, PROCESSING_CENTER_INVALID,
  PROCESSING_CENTER_NOT_FOUND, PROCESSING_CENTER_SELF,
  STORE_TYPE_RETAIL, STORE_TYPE_BOTH, STORE_TYPE_PROCESSING,
} from '@/lib/laundry-store-eligibility'
import { findNearestServiceLocation, type ServiceLocation } from '@/lib/core/service-location'

// ============================================================================
// Every ACTIVE retail store must name the location that processes its
// garments. It is an ADMINISTRATIVE decision, never inferred from distance:
// once Store A is assigned to PC-A, PC-A is the source of truth even when PC-B
// is closer.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const CREATE = read('src/app/api/laundry/businesses/[id]/stores/route.ts')
const UPDATE = read('src/app/api/laundry/stores/[id]/route.ts')
const DISPATCH = read('src/app/api/laundry/orders/[id]/dispatch/route.ts')
const UI = read('src/components/admin/laundry/laundry-stores-view.tsx')
const SCHEMA = read('prisma/schema.prisma')

const centre = (over: Record<string, unknown> = {}) => ({ id: 'pc1', storeType: STORE_TYPE_PROCESSING, isActive: true, ...over })
const refuse = (o: Parameters<typeof processingAssignmentRefusal>[0]) => processingAssignmentRefusal(o)

// ── Cases 1–7 ──────────────────────────────────────────────────────────────
describe('assignment rules', () => {
  it('1. creating a Retail Store with NO Processing Center is blocked', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: null, requestedCentreId: null }))
      .toBe(NO_PROCESSING_CENTER)
  })

  it('2. creating a Retail Store WITH a valid Processing Center is allowed', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: centre(), requestedCentreId: 'pc1' })).toBeNull()
  })

  it('3. an INACTIVE Processing Center is blocked', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: centre({ isActive: false }), requestedCentreId: 'pc1' }))
      .toBe(PROCESSING_CENTER_INACTIVE)
  })

  it('4. a Retail-only store cannot serve as a Processing Center', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: centre({ storeType: STORE_TYPE_RETAIL }), requestedCentreId: 'pc1' }))
      .toBe(PROCESSING_CENTER_INVALID)
  })

  it('5. a Both (Retail + Processing) location IS a valid centre', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: centre({ storeType: STORE_TYPE_BOTH }), requestedCentreId: 'pc1' })).toBeNull()
    expect(isProcessingCapable({ storeType: STORE_TYPE_BOTH, isActive: true })).toBe(true)
  })

  it('6. a Processing-Center-only store needs no assignment of its own', () => {
    expect(requiresProcessingCenterAssignment(STORE_TYPE_PROCESSING)).toBe(false)
    expect(refuse({ storeType: STORE_TYPE_PROCESSING, isActive: true, centre: null, requestedCentreId: null })).toBeNull()
  })

  it('7. a Both store needs none either — it processes its own work', () => {
    expect(requiresProcessingCenterAssignment(STORE_TYPE_BOTH)).toBe(false)
    expect(refuse({ storeType: STORE_TYPE_BOTH, isActive: true, centre: null, requestedCentreId: null })).toBeNull()
    expect(resolveProcessingCenterId({ id: 'both1', storeType: STORE_TYPE_BOTH })).toBe('both1')
  })

  it('a centre chosen from another business reads as "not found"', () => {
    // The route scopes the lookup by tenant, so a foreign id resolves to null.
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, centre: null, requestedCentreId: 'other-tenant-pc' }))
      .toBe(PROCESSING_CENTER_NOT_FOUND)
  })

  it('a retail store cannot point at itself', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: true, storeId: 's1', centre: centre({ id: 's1' }), requestedCentreId: 's1' }))
      .toBe(PROCESSING_CENTER_SELF)
  })

  it('an INACTIVE store may be saved without one — the rule gates ACTIVATION', () => {
    expect(refuse({ storeType: STORE_TYPE_RETAIL, isActive: false, centre: null, requestedCentreId: null })).toBeNull()
  })

  it('the dropdown offers only ACTIVE processing-capable locations', () => {
    expect(processingCapableStoreWhere).toEqual({ isActive: true, storeType: { in: ['PROCESSING_CENTER', 'BOTH'] } })
    expect(isProcessingCapable({ storeType: STORE_TYPE_PROCESSING, isActive: false })).toBe(false)
    expect(isProcessingCapable({ storeType: STORE_TYPE_RETAIL, isActive: true })).toBe(false)
  })
})

// ── Cases 8–9 — existing data ──────────────────────────────────────────────
describe('existing stores are surfaced, never auto-assigned', () => {
  it('8. an active legacy Retail Store with no assignment is identified', () => {
    expect(needsProcessingCenterBackfill({ storeType: STORE_TYPE_RETAIL, isActive: true, processingCenterStoreId: null })).toBe(true)
  })

  it('9. an assigned store is left alone', () => {
    expect(needsProcessingCenterBackfill({ storeType: STORE_TYPE_RETAIL, isActive: true, processingCenterStoreId: 'pc1' })).toBe(false)
    // A self-processing location is never flagged.
    expect(needsProcessingCenterBackfill({ storeType: STORE_TYPE_BOTH, isActive: true, processingCenterStoreId: null })).toBe(false)
  })

  it('nothing guesses an assignment from distance or location', () => {
    for (const f of [CREATE, UPDATE, UI]) {
      expect(f).not.toContain('haversine')
      expect(f).not.toContain('nearestProcessing')
      expect(f).not.toContain('findNearestServiceLocation')
    }
  })
})

// ── Cases 10–12 — history and footprints ───────────────────────────────────
describe('history survives reassignment', () => {
  it('10/11. the order freezes the centre at dispatch, and only once', () => {
    // Written at Dispatch to Processing — the point garments leave the store.
    expect(DISPATCH).toContain('resolveProcessingCenterId(order.store)')
    expect(DISPATCH).toContain('processingCenterStoreId: centre.id')
    // `!order.processingCenterStoreId` — a re-dispatch never overwrites it, so
    // reassigning Store A from PC1 to PC2 leaves old orders reading PC1.
    expect(DISPATCH).toContain('if (!order.processingCenterStoreId && order.store)')
  })

  it('the code and name are frozen too, so a later rename cannot rewrite history', () => {
    expect(DISPATCH).toContain('processingCenterCode: centre.storeCode')
    expect(DISPATCH).toContain('processingCenterName: centre.storeName')
    expect(DISPATCH).toContain('processingCenterAt: now')
  })

  it('the snapshot columns exist on the order', () => {
    expect(SCHEMA).toContain('processingCenterStoreId String?')
    expect(SCHEMA).toContain('processingCenterCode    String?')
    expect(SCHEMA).toContain('processingCenterName    String?')
  })

  it('12. an assignment change writes an audit footprint with old AND new', () => {
    expect(UPDATE).toContain('section: "STORE_PROCESSING_CENTER"')
    expect(UPDATE).toContain('oldValue: label(prev)')
    expect(UPDATE).toContain('newValue: label(centre)')
    expect(UPDATE).toContain('actorName: guard.ctx?.userName')
  })

  it('the footprint reuses the existing audit table — no new audit model', () => {
    expect(UPDATE).toContain('prisma.laundryAuditLog.create')
    expect(SCHEMA).not.toContain('model LaundryStoreAssignmentAudit')
    expect(SCHEMA).not.toContain('model ProcessingCenterAssignment')
  })
})

// ── Cases 13–15 — customer-facing selection still correct ──────────────────
describe('customer-facing store selection is unaffected', () => {
  const kmToDeg = (km: number) => km / 111.32
  const loc = (name: string, storeType: string, km: number): ServiceLocation & { storeType: string } => ({
    id: name, businessId: 'b1', kind: 'laundryStore', name, storeType,
    latitude: kmToDeg(km), longitude: 0, serviceRadiusKm: 10, maxDeliveryDistanceKm: 10, isActive: true,
  })
  const nearest = (all: (ServiceLocation & { storeType: string })[]) =>
    findNearestServiceLocation(all.filter(isCustomerFacingStore), 0, 0)

  it('13. a Processing-Center-only store is never selected', () => {
    expect(nearest([loc('PC', STORE_TYPE_PROCESSING, 1), loc('Retail', STORE_TYPE_RETAIL, 3)]).location?.name).toBe('Retail')
  })

  it('14. a Retail Store can be selected', () => {
    expect(nearest([loc('Retail', STORE_TYPE_RETAIL, 3)]).location?.name).toBe('Retail')
  })

  it('15. a Both store can be selected', () => {
    expect(nearest([loc('Both', STORE_TYPE_BOTH, 2)]).location?.name).toBe('Both')
  })
})

// ── Backend enforcement ────────────────────────────────────────────────────
describe('the backend enforces it — the UI is not the gate', () => {
  it('the create route validates before writing', () => {
    expect(CREATE).toContain('processingAssignmentRefusal(')
    expect(CREATE).toContain('PROCESSING_CENTER_REQUIRED')
    // Tenant-scoped lookup: a centre from another business cannot be used.
    expect(CREATE).toContain('where: { id: centreId, laundryBusinessId }')
  })

  it('the update route validates the EFFECTIVE state after the edit', () => {
    // Catches activating a legacy store and switching BOTH → retail-only.
    expect(UPDATE).toContain('const effectiveType = storeType !== undefined ? storeType : existing.storeType')
    expect(UPDATE).toContain('const effectiveActive = isActive !== undefined ? !!isActive : existing.isActive')
    expect(UPDATE).toContain('processingAssignmentRefusal(')
  })

  it('a self-processing location does not keep a dangling assignment', () => {
    expect(UPDATE).toContain('requiresProcessingCenterAssignment(effectiveType)')
  })

  it('both routes refuse with the same shared messages', () => {
    // One rule, three surfaces — the UI never invents its own wording.
    for (const f of [CREATE, UPDATE]) expect(f).toContain('@/lib/laundry-store-eligibility')
    expect(UI).toContain('@/lib/laundry-store-eligibility')
  })
})

// ── UI ─────────────────────────────────────────────────────────────────────
describe('the Stores screen', () => {
  it('offers only active processing-capable locations, excluding itself', () => {
    expect(UI).toContain('s.storeType === "PROCESSING_CENTER" || s.storeType === "BOTH"')
    expect(UI).toContain('s.id !== editingStore?.id')
  })

  it('shows the required warning and the no-centre-available state', () => {
    expect(UI).toContain('No Processing Center Available')
    expect(UI).toContain('Processing Center Not Assigned')
    expect(UI).toContain('created before Processing Center assignment became mandatory')
  })

  it('keeps the entered store information when the server refuses', () => {
    // The dialog stays open and shows the reason — the form is not reset.
    expect(UI).toContain('setSaveError(j.error')
    expect(UI).not.toContain('setDialogOpen(false)\n    setSaveError')
  })

  it('reports a refused activation instead of failing silently', () => {
    expect(UI).toContain('setToggleError(j.error')
  })

  it('shows the assignment in the store list', () => {
    expect(UI).toContain('<TableHead>Processing Center</TableHead>')
    expect(UI).toContain('Self')
  })
})

// ── No new architecture ────────────────────────────────────────────────────
describe('no new architecture was introduced', () => {
  it('the assignment is a self-relation on the existing store table', () => {
    expect(SCHEMA).toContain('processingCenter   LaundryStore?              @relation("StoreProcessingCenter"')
    expect(SCHEMA).toContain('servedStores       LaundryStore[]             @relation("StoreProcessingCenter")')
  })

  it('it is per store, not a business-level setting', () => {
    expect(SCHEMA).not.toContain('defaultProcessingCenterId')
    expect(SCHEMA).not.toContain('businessProcessingCenterId')
  })

  it('deleting a centre does not delete the stores it served', () => {
    expect(SCHEMA).toContain('references: [id], onDelete: SetNull)')
  })

  it('no routing engine or automatic geographic assignment was added', () => {
    for (const f of [CREATE, UPDATE, DISPATCH]) {
      expect(f).not.toContain('nearest')
      expect(f).not.toContain('distance')
    }
  })
})
