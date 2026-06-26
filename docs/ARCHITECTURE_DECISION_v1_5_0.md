# Architecture Decision: Commerce Extraction Postponement (v1.5.0)

**Date:** 2026-06-27  
**Decision:** Postpone Physical Commerce OS Extraction  
**Rationale:** Focus on Product-Driven Business Creation  
**Status:** APPROVED - IMPLEMENTATION SEQUENCE CHANGED  

---

## THE DECISION

**Commerce OS Extraction is POSTPONED.**

Physical extraction of Commerce OS to an independent repository is not the next priority.

**Reason:** The architecture is already ready for modular products. The immediate business value is in making Business Creation completely product-driven, not in file reorganization.

---

## CURRENT ARCHITECTURE STATUS

### What's Already Built ✅

1. **Product Registry** (v1.1.0)
   - All products defined with catalogs, plans, features

2. **Provisioner Registry** (v1.3.1)
   - Products can register provisioners
   - Zero hardcoded product logic in Core

3. **Runtime Registry** (v1.4.0)
   - All runtime info centralized
   - Products can be at any URL/deployment mode

4. **Business Provisioning** (v1.3.0)
   - Fully automated provisioning
   - Uses registries, not hardcoding

### What's Missing ✅

The Business Creation flow is not yet fully product-driven.

Currently:
- Business is created
- Product can be assigned (v1.2.0)
- Provisioning is triggered
- Workspace is created

But there's no integrated **Business Creation Wizard** that:
- Presents products to user
- Shows plans and features
- Provisions in real-time
- Opens the workspace

This is the missing piece.

---

## WHY NOT EXTRACT NOW?

### The Argument for NOT Extracting
1. **Files are already isolated** (via registries)
2. **Dependencies are already managed** (via APIs)
3. **Products can already be independent** (via registries)
4. **Moving files doesn't add business value**
5. **Business Creation wizard is the real value**

### The Real Business Value
Making Business Creation fully product-aware:
- User creates business
- User selects which product to use
- User selects which plan to subscribe
- System automatically provisions
- User immediately enters product workspace

This flow is what customers pay for.
Moving files is infrastructure work.

---

## REVISED IMPLEMENTATION SEQUENCE

### Current Status
- ✅ v1.1.0 — Platform Foundation
- ✅ v1.2.0 — Business → Product Assignment
- ✅ v1.3.0 — Business Provisioning Engine
- ✅ v1.3.1 — Product Provisioner Registry
- ✅ v1.4.0 — Product Runtime Registry

### NEW Sequence

#### v1.5.0 — Business Creation with Products (NEW PRIORITY)
Implement integrated Business Creation Wizard:
- Product selection UI
- Plan selection UI
- Real-time provisioning
- Workspace launch
- Direct product access

#### v1.6.0 — Laundry OS Activation (NEXT)
Similar to v1.5.0 but for Laundry

#### v1.7.0 — Car Wash OS Activation (NEXT)
Similar to v1.5.0 but for Car Wash

#### v1.8.0 — Commerce Extraction (FUTURE)
When all products are proven:
- Move Commerce to separate repo
- Full product independence

#### v1.9.0+ — Other Products
- Salon OS
- Restaurant OS
- Clinic OS
- Etc.

---

## ARCHITECTURE VERIFICATION

**Question:** Do we need to change the architecture to support Business Creation with Products?

**Answer:** NO. Everything needed is already built.

### What's Needed for v1.5.0

| Component | Status | Ready? |
|-----------|--------|--------|
| Product Registry | ✅ Built | YES |
| Product Plans | ✅ Built | YES |
| Product Features | ✅ Built | YES |
| Product Provisioner Registry | ✅ Built | YES |
| Product Runtime Registry | ✅ Built | YES |
| Business Provisioning Engine | ✅ Built | YES |
| Provisioning APIs | ✅ Built | YES |
| Workspace Model | ✅ Built | YES |
| Runtime APIs | ✅ Built | YES |

**All components are ready. No architecture changes needed.**

---

## IMPLEMENTATION PLAN FOR v1.5.0

### 1. Create Business Creation Wizard UI
- Product selection step
- Plan selection step
- Real-time provisioning display
- Workspace launch confirmation

### 2. Integrate with Existing APIs
- GET /api/admin/businesses/products (existing)
- POST /api/admin/businesses/assign-product (existing)
- POST /api/admin/businesses/provision (existing)
- GET /api/admin/businesses/provision (existing)

### 3. Implement Business → Product → Workspace Flow
- Create business
- Assign product and plan
- Trigger provisioning
- Monitor provisioning progress
- Launch workspace when ready

### 4. Verify End-to-End
- Business creation works
- Product provisioning works
- Workspace is ready
- User can access product

---

## WHAT IS NOT CHANGING

### Commerce OS Remains Embedded
- Commerce code stays in Core
- No file reorganization
- No repository splitting
- No "products" folder yet

### Database Remains Unchanged
- All 42 commerce models in Core database
- No schema changes
- No migration scripts

### APIs Remain Unchanged
- All commerce APIs continue working
- No endpoint modifications
- No breaking changes

### Existing Functionality
- All existing features work
- All existing businesses continue
- All existing integrations function

---

## WHAT IS CHANGING

### Business Creation Experience
- NEW: Product selection integrated
- NEW: Plan selection integrated
- NEW: Real-time provisioning display
- NEW: Direct workspace launch

### User Journey
**Before:**
```
Create Business → Manually configure → Hope it works
```

**After:**
```
Create Business → Select Product → Select Plan → Automatic Provisioning → Workspace Ready
```

---

## COMMERCE EXTRACTION STATUS

### Audit (v1.5.0 Phase 1)
- ✅ COMPLETE
- ✅ 42 models identified
- ✅ 12 APIs identified
- ✅ 10+ components identified
- ✅ Dependency graph created
- ✅ Risk assessment completed

### Migration Plan
- ✅ DOCUMENTED
- ✅ Ready when needed
- ✅ Deferred until v1.8.0+

### When Extraction Will Happen
After v1.5.0, v1.6.0, v1.7.0 prove the product architecture works.

At that point, moving Commerce will be low-risk and high-confidence.

---

## DECISION RECORD

**Decision:** Do not physically extract Commerce OS now  
**Reason:** Extraction doesn't add business value; Business Creation wizard does  
**Alternative considered:** Extract now, then build wizard  
**Rationale:** Wizard requires fewer changes if code stays in place  
**Risk:** Low - All architecture is already modular  
**Reversibility:** High - Extraction can happen anytime  
**Timeline:** Deferred to v1.8.0+

---

## MASTER CONTEXT IMPACT

**Master Context remains valid and unchanged.**

All architectural principles still apply:
- ✅ Quantix Core is Platform Controller
- ✅ Products are business operating systems
- ✅ Clean separation via registries
- ✅ No duplication of data
- ✅ Single source of truth

The only change is **implementation sequencing**, not architecture.

---

## APPROVAL

This decision changes the v1.5.0 milestone from:
- "Commerce Extraction" → "Business Creation with Products"

All architectural principles remain the same.
All registry and provisioning systems remain the same.
Only the priority and focus change.

---

## NEXT MILESTONE

**v1.5.0 — Business Creation with Products**

Focus: Make Business Creation the integrated entry point to Products

Deliverables:
1. Business Creation Wizard UI
2. Product integration
3. Plan selection
4. Real-time provisioning
5. Workspace launch

All using existing Product Registry, Runtime Registry, and Provisioning Engine.

No file movement. No repository splitting. Pure business value.

---

**DECISION APPROVED ✅**

Commerce Extraction is postponed.

Business Creation with Products is the next priority.

All existing architecture remains valid.

Implementation can proceed with v1.5.0 Business Creation Wizard.
