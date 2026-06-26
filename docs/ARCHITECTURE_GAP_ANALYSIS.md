# ARCHITECTURE GAP ANALYSIS

**Status:** Comprehensive Gap Analysis (Pre-Implementation)  
**Date:** 2026-06-26  
**Baseline:** QUANTIX_CORE_MASTER_CONTEXT_v1.0.md  
**Scope:** Current implementation vs. approved architecture

---

## EXECUTIVE SUMMARY

### Current State

Quantix Core is currently a **monolithic application** with:
- Single shared PostgreSQL database containing all data (Core, Commerce, Laundry)
- All business logic co-located in one codebase
- Mixed responsibilities between platform and product concerns
- Laundry OS logic embedded within Core (30+ models)
- Commerce features accessible through Core APIs
- Website management in Core without clear separation
- No explicit workspace routing for products

### Target State (Per Approved Architecture)

Quantix Core must become a **Platform Controller** with:
- Clear separation: Core owns platform, Products own business operations
- Multiple independent product workspaces (Commerce, Laundry, CarWash)
- Intelligent workspace routing based on Business Type
- Explicit tenant isolation enforcement (RLS)
- Isolated databases per product (eventual evolution)
- Platform APIs only for provisioning and configuration
- Business operations removed from Core
- Products independently deployable and versioned

### Migration Complexity

**Overall Assessment:** MODERATE TO HIGH

- **Breaking Changes:** 2-3 (with backward compatibility layer)
- **New APIs Required:** 15-20 new platform APIs
- **Database Changes:** Significant (additive, RLS enforcement required)
- **Product Extraction:** Laundry (30+ models) must gradually move to Laundry OS
- **Customer Impact:** LOW if phased correctly with backward compatibility

### Timeline Estimate

- **Phase 1 (Foundation):** 4-6 weeks
- **Phase 2-3 (Business Type & Routing):** 6-8 weeks
- **Phase 4-5 (Product Extraction):** 8-12 weeks
- **Phase 6 (Integration & Cleanup):** 4-6 weeks
- **Total:** 6-9 months (conservative estimate)

---

## CURRENT STATE DETAILED ANALYSIS

### Module Inventory

#### **PLATFORM CONTROL MODULES** (Core Responsibility)

| Module | Current | Status | Gaps |
|--------|---------|--------|------|
| Dashboard | Exists (/admin) | Aligned | None - Keep as is |
| Businesses | Exists (Business model) | Aligned | Needs Business Type routing |
| Sales & Leads | Exists (Lead model, SalesTeamMember) | Aligned | None - Keep as is |
| Quotes & Proposals | Exists (ProposalDocument model) | Aligned | None - Keep as is |
| Billing | Exists (extensive billing models) | Aligned | None - Keep as is |
| Subscription Management | Exists (SubscriptionPlan, BusinessSubscription) | Aligned | None - Keep as is |
| Payment Plugins | Exists (PlatformPaymentPlugin, PaymentGateway) | Aligned | None - Keep as is |
| User Management | Exists (User, BusinessUser models) | Aligned | None - Keep as is |
| Roles & RBAC | Exists (BusinessRole, RolePermission) | Aligned | None - Keep as is |
| Audit Logging | Exists (PlatformAuditLog, BusinessAuditLog) | Aligned | None - Keep as is |
| Admin Settings | Exists (PlatformSettings, BusinessModule) | Aligned | None - Keep as is |
| Website Management | Exists (15 WebsiteXXX models) | Partially Aligned | Needs content/infra separation |
| Deployment | Exists (Deployment model, /api/deploy) | Aligned | None - Keep as is |

**Assessment:** Core platform modules are MOSTLY ALIGNED. Only website management needs clarification.

#### **LAUNDRY OS MODULES** (Currently in Core, Should Move to Product)

**Critical Issue:** 30+ Laundry-specific models embedded in Core database

Models that should move:
- LaundryBusiness, LaundryOrder, LaundryOrderService
- LaundryProcessingCenter, LaundryStore
- LaundryWorkflowConfiguration, LaundryWorkflowStage, LaundryWorkflowQualityConfig
- LaundryDepartment, LaundryRole, LaundryStagePermission
- LaundrySubscription, LaundryPlatformProvisioning
- LaundryAuditLog, LaundryBrandingConfig, LaundryOperationalConfig
- LaundryScalingLimit, LaundryUserAssignment
- LaundryStageTimestamp

APIs that should move:
- `/api/laundry/*` (15+ endpoints)
- All Laundry-specific business logic

**Impact:** CRITICAL - Laundry logic extraction is the biggest architectural work

#### **COMMERCE MODULES** (Partially in Core, Some Should Move)

Models in Core that should move to Commerce OS:
- Product, ProductVariant, Category, Inventory, InventoryLog
- Order, OrderItem, OrderStatusHistory
- Customer, CustomerNote, CustomerSubscription
- Delivery, DeliveryPartner, DeliveryZone
- PromoCode, Banner
- Cart, CartItem

Models that should stay in Core:
- BillingInvoice, BillingPayment, Payment, Refund (billing)
- User, BusinessUser (user management)

APIs in Core that should move:
- `/api/v1/products`, `/api/v1/categories`, `/api/v1/orders`
- `/api/v1/storefront/*`, `/api/v1/cart`, `/api/v1/addresses`

**Assessment:** Commerce extraction is HIGH priority but LOWER than Laundry (can run in parallel with Core)

#### **WEBSITE MANAGEMENT MODULES**

Current Implementation:
- 15 WebsiteXXX models for content (pricing, features, testimonials, etc.)
- Website infrastructure APIs (domain, SSL, CDN not coded but referenced)
- Website content APIs for admin and public

**Gap:** Unclear ownership
- Pricing: Should Core or Commerce own? Currently Core.
- Features: Should Core or product own? Currently Core.
- Testimonials: Should Core or product own? Currently Core.
- General settings: Core should own ✓
- Theme: Core should own ✓
- Communication: Core should own ✓

**Action:** Clarify which WebsiteXXX models are infrastructure (stay in Core) vs. content (move to product)

---

### Database Analysis

#### **Current Schema Overview**

**Total Models:** 160+

**Organization:**
- Platform models (40): User, Business, Subscription, Lead, Payment, etc.
- Commerce models (25): Product, Order, Customer, Inventory, etc.
- Laundry models (30+): LaundryBusiness, LaundryOrder, LaundryWorkflow, etc.
- Website models (15): WebsiteXXX (content + infrastructure)
- HRMS models (5): Employee, EmployeeTimeline, etc.
- Supporting models (45): Audit logs, notifications, features, etc.

**Current Tenant Isolation:**
- ✅ `tenantId` field exists in many tables
- ❌ Row-level security NOT enforced
- ❌ All queries must manually filter by tenantId (error-prone)
- ❌ No database-level guarantee of isolation

#### **Database Gaps**

| Item | Current | Required | Gap Severity |
|---|---|---|---|
| Explicit Business Type field | Exists ✓ | Needed | LOW |
| Row-level security | None ❌ | Required | CRITICAL |
| Tenant isolation enforcement | Manual | Automatic | CRITICAL |
| Product database separation | None | Planned | MEDIUM |
| Schema partitioning | None | Planned | MEDIUM |
| Backup strategy | Not visible | Required | MEDIUM |

#### **Database Migration Path**

**Phase 1 (Immediate):** Add RLS policies
- Enforce tenant isolation at database level
- Audit all queries for tenantId filtering
- Add RLS policies to critical tables

**Phase 2 (Months 2-3):** Partition data
- Create schema partitions for Laundry
- Plan for future sharding
- Support reading from both locations

**Phase 3+ (Months 4+):** Migrate to product databases
- Move Laundry models when Laundry OS deploys
- Move Commerce models when Commerce OS deploys
- Core keeps only platform models

**Backward Compatibility:** ✅ All data remains accessible, just reorganized

---

### API Analysis

#### **Current API Structure**

**API Paths in Codebase:**

```
/api/v1/*           - Version 1 APIs (products, orders, etc.)
/api/core/*         - Core platform APIs (businesses, leads, users, etc.)
/api/laundry/*      - Laundry-specific APIs (15+ endpoints)
/api/admin/*        - Admin APIs (rbac, payment-config, audit)
/api/auth/*         - Authentication APIs
/api/payment/*      - Payment processing APIs
/api/website/*      - Website infrastructure APIs
/api/deploy/*       - Deployment APIs
```

#### **API Classification by Architecture**

**Platform APIs (Correct Location):**
- ✅ `/api/core/businesses` - Business management
- ✅ `/api/core/leads` - Sales leads and opportunities
- ✅ `/api/core/users` - User management
- ✅ `/api/core/payments` - Payment configuration
- ✅ `/api/auth/*` - Authentication
- ✅ `/api/admin/rbac` - Roles and permissions
- ✅ `/api/admin/audit-logs` - Audit logging
- ✅ `/api/deploy/*` - Deployment management
- ✅ `/api/website/*` - Website infrastructure (core manages)

**Product APIs (Currently in Core, Should Eventually Move):**
- ❌ `/api/v1/products` - Should be in Commerce OS
- ❌ `/api/v1/categories` - Should be in Commerce OS
- ❌ `/api/v1/orders` - Should be in Commerce OS
- ❌ `/api/v1/cart` - Should be in Commerce OS
- ❌ `/api/v1/addresses` - Should be in Commerce OS
- ❌ `/api/v1/storefront/*` - Should be in Commerce OS
- ❌ `/api/laundry/*` - CRITICAL: Should be in Laundry OS

#### **API Gaps**

| Category | Current | Missing | Severity |
|---|---|---|---|
| Business Type APIs | Partial | Full routing APIs | MEDIUM |
| Provisioning APIs | None | Product initialization | HIGH |
| Configuration APIs | Partial | Product configuration | HIGH |
| Subscription APIs | Exists | Subscription feature checking | MEDIUM |
| Health Check APIs | None | Product workspace monitoring | MEDIUM |
| Workspace Routing | Implicit | Explicit routing API | HIGH |

#### **API Migration Strategy**

**Phase 1:** Keep all APIs working (no changes)

**Phase 2:** Add new platform APIs
- Provisioning APIs
- Configuration delivery APIs
- Subscription validation APIs
- Health monitoring APIs

**Phase 3:** Create product workspace APIs
- Duplicate Laundry APIs at product workspace
- Keep old `/api/laundry/*` working
- Support both paths in parallel

**Phase 4:** Gradual client migration
- Deprecate old API paths
- Encourage migration to product paths
- Support both for 6-12 months

**Backward Compatibility:** ✅ Old APIs continue working, new paths available in parallel

---

### Workspace Routing Analysis

#### **Current Implementation**

**Workspace Button:**
- Basic "Open Workspace" button in dashboard
- Hard-coded routes based on business type:
  - Laundry businesses → `/laundry/...`
  - Commerce businesses → `/business/...`
  - Admins → `/admin/...`

**Current Limitations:**
- ❌ No multi-business switching visible
- ❌ No product workspace separation
- ❌ No JWT token generation
- ❌ No intelligent routing

#### **Required by Architecture**

```
User Login → Quantix Core Authentication
    ↓
Check user's business(es)
    ↓
Single business?
    ├─ YES → Detect Business Type
    └─ NO → Show business selector
    ↓
Generate JWT token
    ↓
Route to workspace:
  ├─ Commerce → commerce.quantixtechnology.in
  ├─ Laundry → laundry.quantixtechnology.in
  ├─ CarWash → carwash.quantixtechnology.in
  └─ [Future] → [product].quantixtechnology.in
```

#### **Gaps**

| Component | Current | Required | Gap |
|---|---|---|---|
| Business Type detection | Partial | Explicit | MEDIUM |
| Product workspace URLs | None | Defined | HIGH |
| Multi-business selector | Not visible | Required UI | MEDIUM |
| JWT generation | Not visible | Required | HIGH |
| Token refresh | Not visible | Required | MEDIUM |
| Workspace monitoring | None | Health checks | MEDIUM |

#### **Migration Path**

**Phase 1:** Enhance existing button
- Add multi-business detection
- Keep existing routes working

**Phase 2:** Add workspace routing
- Define product workspace URLs
- Route based on Business Type

**Phase 3:** Implement JWT authentication
- Generate tokens in Core
- Pass to product workspace
- Product validates token

**Phase 4:** Deprecate old routes
- Keep working 6-12 months
- Encourage migration
- Eventually remove

**Backward Compatibility:** ✅ Existing routes continue working throughout

---

## RISK ASSESSMENT

### Critical Risks (Mitigate Immediately)

1. **Tenant Isolation Bypass**
   - Risk: Cross-tenant data visibility
   - Likelihood: MEDIUM (if RLS not enforced)
   - Impact: CRITICAL (security breach)
   - Mitigation: Implement RLS policies immediately
   
2. **Laundry Extraction Failure**
   - Risk: Laundry logic stays embedded
   - Likelihood: MEDIUM (complexity)
   - Impact: CRITICAL (architecture not achieved)
   - Mitigation: Clear extraction criteria, phased approach

3. **Breaking Changes to APIs**
   - Risk: Existing clients break
   - Likelihood: LOW (if planned correctly)
   - Impact: CRITICAL (customer impact)
   - Mitigation: Version APIs, support multiple paths

### High Risks (Plan Carefully)

1. **Database Performance Issues**
   - Risk: RLS queries slow down
   - Likelihood: LOW
   - Impact: HIGH (user experience)
   - Mitigation: Performance testing early, optimization

2. **Product Workspace Unavailability**
   - Risk: Product workspace fails
   - Likelihood: MEDIUM
   - Impact: HIGH (customers can't operate)
   - Mitigation: Health checks, failover mechanisms

3. **Data Loss During Migration**
   - Risk: Data corrupted/lost during phases
   - Likelihood: LOW
   - Impact: CRITICAL (business impact)
   - Mitigation: Backup before each phase, verify

### Medium Risks (Standard Mitigation)

1. **Customer Confusion**
   - Risk: Customers unclear about changes
   - Likelihood: MEDIUM
   - Impact: MEDIUM (support load)
   - Mitigation: Clear communication, guides

2. **API Version Conflicts**
   - Risk: Clients using wrong API versions
   - Likelihood: MEDIUM
   - Impact: MEDIUM (functionality breaks)
   - Mitigation: Clear versioning, migration paths

---

## ZERO-BREAKING-CHANGE STRATEGY

### Core Principle: Backward Compatibility First

All changes must maintain:
- ✅ All existing APIs continue working
- ✅ All existing UI continues working
- ✅ All existing databases continue working
- ✅ All existing integrations continue working

### Implementation Approach

**For APIs:**
- Old paths work forever (with deprecation notice)
- New paths available in parallel
- Clients migrate at their own pace
- Support multiple API versions

**For Routes:**
- Old routes work forever
- Smart routing handles both
- Transparent to users
- No forced upgrades

**For Database:**
- All existing data remains accessible
- RLS policies added (enforces, not breaks)
- Data reorganized, not deleted
- Queries still work

**For UI:**
- Existing pages keep working
- New features added gradually
- Feature flags for toggles
- Users don't see breaking changes

### Breaking Changes Deferred

The following are **deferred to Phase 7** (cleanup):
1. Removal of old API paths (AFTER all clients migrate, 6-12 months)
2. Removal of old UI routes (AFTER workspaces deployed)
3. Consolidation of database (AFTER products extract)
4. Removal of product code (AFTER products deploy)

---

## IMPLEMENTATION ROADMAP

### PHASE 1: FOUNDATION (Weeks 1-4)

**Objective:** Establish architectural foundation without breaking changes

**Deliverables:**
1. Enhanced Business Type support
2. API classification matrix
3. RLS implementation plan
4. Database audit report

**Key Tasks:**
- Verify Business Type field in Business model
- Classify all 100+ APIs as Platform/Product
- Audit all queries for tenantId filtering
- Design RLS policies

**Breaking Changes:** NONE

---

### PHASE 2: BUSINESS TYPE SUPPORT (Weeks 5-8)

**Objective:** Make Business Type central to all operations

**Deliverables:**
1. Business Type management APIs
2. Workspace routing system
3. RLS policies implemented
4. Tenant isolation enforced

**Key Tasks:**
- Create Business Type configuration APIs
- Implement workspace configuration
- Deploy RLS policies
- Audit critical queries

**Breaking Changes:** NONE (RLS is additive)

---

### PHASE 3: WORKSPACE ROUTING (Weeks 9-12)

**Objective:** Implement intelligent workspace routing

**Deliverables:**
1. Workspace routing engine
2. Product workspace configurations
3. JWT authentication system
4. Token refresh mechanism

**Key Tasks:**
- Create routing logic
- Setup commerce.quantix... and laundry.quantix...
- Implement JWT generation
- Test multi-workspace switching

**Breaking Changes:** NONE

---

### PHASE 4: PRODUCT PROVISIONING (Weeks 13-16)

**Objective:** Enable product initialization from Core

**Deliverables:**
1. Provisioning APIs (`/api/v1/provisioning/*`)
2. Product configuration APIs
3. Health monitoring system
4. Documentation for products

**Key Tasks:**
- Design provisioning workflow
- Implement initialization APIs
- Create health check endpoints
- Document product integration

**Breaking Changes:** NONE

---

### PHASE 5: LAUNDRY EXTRACTION (Weeks 17-24)

**Objective:** Gradual extraction of Laundry logic

**Deliverables:**
1. Laundry product APIs
2. Laundry database partition
3. Feature flags for migration
4. Client migration guides

**Key Tasks:**
- Duplicate Laundry APIs for product
- Create schema partition
- Implement feature flags
- Update Laundry clients

**Breaking Changes:** MINOR (feature flags)

---

### PHASE 6: COMMERCE INTEGRATION (Weeks 25-30)

**Objective:** Support Commerce OS as independent product

**Deliverables:**
1. Commerce product workspace
2. Commerce API exposure
3. Commerce configuration system
4. Multi-workspace fully operational

**Key Tasks:**
- Setup commerce.quantix workspace
- Expose Commerce APIs for product
- Implement feature flags
- Complete workspace integration

**Breaking Changes:** NONE

---

### PHASE 7: CLEANUP (Weeks 31+)

**Objective:** Clean up and optimize

**Deliverables:**
1. Clean platform APIs
2. Optimized database
3. Complete documentation
4. Production-ready system

**Key Tasks:**
- Deprecate old APIs
- Remove duplicate code
- Archive old data
- Complete migration guides

**Breaking Changes:** MAJOR (API deprecation) - but only AFTER all clients migrate

---

## MIGRATION MATRIX: WHAT STAYS, WHAT CHANGES, WHAT MOVES

| Module | Keep in Core | Move to Product | Change | Stay Unchanged |
|--------|---|---|---|---|
| **Businesses** | ✅ | | Enhance routing | ✅ Model stays |
| **Sales/Leads** | ✅ | | None | ✅ Everything |
| **Billing** | ✅ | | None | ✅ Everything |
| **Users/RBAC** | ✅ | | None | ✅ Everything |
| **Website** | Partial | Partial | Clarify separation | Partial |
| **Laundry Logic** | ❌ | ✅ MOVE | Complete extraction | ✅ Stays until moved |
| **Commerce** | Partial | ✅ MOVE | Extract gradually | ✅ Stays until moved |
| **Database** | ✅ Core | ✅ Products (eventual) | Add RLS, partition | ✅ Data stays |

---

## SUCCESS CRITERIA

### Phase 1 (Foundation)
- ✅ Business Type routing implemented
- ✅ 100+ APIs classified
- ✅ RLS plan documented
- ✅ ZERO breaking changes

### Phase 2-3 (Business Type & Routing)
- ✅ Workspace routing operational
- ✅ Multi-business switching enabled
- ✅ Product workspace URLs defined
- ✅ All existing functionality preserved

### Phase 4-5 (Product Extraction)
- ✅ Laundry extraction possible
- ✅ Commerce workspace deployed
- ✅ Products independently operational
- ✅ Platform Controller functioning

### Final (Production)
- ✅ Multiple products supported
- ✅ Zero breaking changes to customers
- ✅ Backward compatibility maintained
- ✅ Architecture aligned with Master Context

---

## RECOMMENDED NEXT STEPS

### Immediate (This Week)

1. ✅ Read and approve ARCHITECTURE_GAP_ANALYSIS.md
2. ✅ Review current database schema
3. ✅ Classify all 100+ APIs
4. ✅ Document RLS plan

### Next Week

1. Start Phase 1 implementation
2. Enhance Business Type support
3. Begin RLS policy design
4. Audit critical queries

### This Month

1. Complete Phase 1 foundation
2. Have RLS ready for deployment
3. Workspace routing designed
4. Approval to proceed to Phase 2

---

**Document Status:** Complete - Ready for Approval  
**Next Step:** Approve Phase 1 implementation plan

