# PRODUCT PROVISIONING SPECIFICATION v1.0

**Status:** Architecture Specification  
**Date:** 2026-06-26  
**Scope:** Complete product provisioning lifecycle for all Quantix ecosystem products  
**Baseline:** QUANTIX_CORE_MASTER_CONTEXT_v1.0.md

---

## 1. PURPOSE

### Design Philosophy

Quantix is a SaaS company, not a cloud provider. This specification focuses on **business value and customer experience**, not infrastructure complexity.

**Guiding Question:** "Would a Business Owner ever manage this?"
- If NO → Quantix Core manages it (hidden infrastructure)
- If YES → The Product manages it (business operations)

### What This Document Defines

Quantix Core provisions all businesses and their workspaces but **never executes business operations**. 

- **Quantix Core:** Manages provisioning, infrastructure, billing, configuration (Super Admin only)
- **Products:** Execute all business workflows, operations, and domain logic (Business Owner uses)

This document specifies exactly how Quantix Core provisions every future product to run independently, keeping the experience simple for customers.

### Core Responsibility: Provisioning, Not Operations

When a business is created:

1. ✅ **Core provisions:** Infrastructure, database access, storage, workspace, deployment
2. ✅ **Core manages:** Subscription, billing, user permissions, monitoring
3. ❌ **Core never manages:** Business workflows, operational data, product features
4. ❌ **Core never contains:** Commerce workflows, Laundry workflows, domain logic

### Product Responsibility: Operations

When a product workspace launches:

1. ✅ **Product executes:** All business workflows specific to that product
2. ✅ **Product manages:** Operational data, domain logic, business intelligence
3. ❌ **Product manages:** Subscriptions, billing, platform provisioning
4. ❌ **Product contains:** Platform concerns

---

## 2. SUPPORTED PRODUCTS

### Current Products

#### **Commerce OS**
- **Purpose:** Complete POS, inventory, order management system
- **Deployment:** commerce.quantixtechnology.in
- **Provisioning:** Full marketplace features, multi-store support
- **Version:** Independent (e.g., Commerce 2.1.0)

#### **Laundry OS**
- **Purpose:** Complete laundry workflow automation system
- **Deployment:** laundry.quantixtechnology.in
- **Provisioning:** Full processing center, queue management, batch workflows
- **Version:** Independent (e.g., Laundry 1.3.0)

#### **Car Wash OS** (Planned Q3 2026)
- **Purpose:** Complete automotive wash service system
- **Deployment:** carwash.quantixtechnology.in
- **Provisioning:** Service scheduling, bay management, vehicle tracking
- **Version:** Independent (e.g., Car Wash 1.0.0)

### Future Products

Every future product follows the identical provisioning specification:

#### **Salon OS** (Planned Q4 2026)
- Beauty services, appointment scheduling, staff management

#### **Restaurant OS** (Planned Q1 2027)
- Restaurant management, table booking, kitchen operations, delivery

#### **Clinic OS** (Planned Q2 2027)
- Healthcare management, appointment scheduling, patient records

#### **Warehouse OS** (Planned Q3 2027)
- Inventory, logistics, fulfillment automation

#### **Manufacturing OS** (Planned Q4 2027)
- Production planning, machine operations, quality control

### Provisioning Principle

Every product, regardless of domain, is provisioned identically by following this specification. The provisioning lifecycle is product-agnostic.

---

## 3. BUSINESS PROVISIONING LIFECYCLE

### End-to-End Flow

```
Sales Lead
    ↓
Lead Closed (Sales closes deal)
    ↓
Business Created (Core creates Business record)
    ↓
Business Type Selected (Determines which product)
    ↓
Subscription Assigned (Determines features & storage)
    ↓
Storage Allocated (Core reserves storage)
    ↓
Database Provisioned (Core creates tenant database context)
    ↓
Website Provisioned (Core deploys website infrastructure)
    ↓
Workspace Registered (Core registers in Workspace Registry)
    ↓
Mobile App Reserved (Core configures mobile app)
    ↓
Admin User Created (Core creates initial admin user)
    ↓
Credentials Generated (Core securely delivers credentials)
    ↓
Workspace Ready (Product workspace initialized)
    ↓
Customer Begins Operations (Business uses product)
```

### Responsibility Assignment by Step

| Step | Responsible | Duration | What Happens |
|------|---|---|---|
| Lead Closed | Sales Team | T+0 | Deal information captured |
| Business Created | Quantix Core | T+5 min | Business ID assigned, record created |
| Business Type Selected | Quantix Core | T+5 min | Business Type determines product |
| Subscription Assigned | Quantix Core | T+5 min | Features, storage, pricing determined |
| Storage Allocated | Quantix Core | T+10 min | Storage directory created, quota set |
| Database Provisioned | Quantix Core | T+10 min | Tenant database context created |
| Website Provisioned | Quantix Core | T+20 min | Website infrastructure deployed |
| Workspace Registered | Quantix Core | T+25 min | Business registered in Workspace Registry |
| Mobile App Reserved | Quantix Core | T+25 min | App configuration created |
| Admin User Created | Quantix Core | T+30 min | Admin credentials prepared |
| Credentials Generated | Quantix Core | T+30 min | Login credentials delivered |
| Workspace Ready | Product | T+30 min | Product initializes, awaits access |
| Operations Begin | Customer | T+30+ min | Customer logs in, starts using product |

**Total Time to Ready:** ~30 minutes (automated)

### Failure Recovery

If any step fails:
1. Business marked as "Provisioning Failed"
2. Support team notified automatically
3. Customer contacted with issue
4. Issue diagnosed and corrected
5. Provisioning retried from failure point
6. Customer notified when ready

---

## 4. PROVISIONING COMPONENTS

Every product requires these Quantix Core provisioning components:

### Business Registry

**Responsibility:** Quantix Core

**Stores:**
- Business ID (unique)
- Business Name
- Business Type (Commerce, Laundry, CarWash, etc.)
- Owner information
- Subscription ID
- Creation date
- Status (Provisioning, Active, Suspended, Archived)

**Used for:** Business lookup, type determination, subscription validation

---

### Tenant Registry

**Responsibility:** Quantix Core

**Stores:**
- Tenant ID (unique per business)
- Business ID (foreign key)
- Database connection string
- Tenant isolation parameters
- Data residency location

**Used for:** Query routing, tenant isolation enforcement, data access control

---

### Workspace Registry

**Responsibility:** Quantix Core

**Stores:**
- Workspace ID (unique)
- Business ID (foreign key)
- Business Type
- Workspace URL (configuration-driven)
- Current Version (product version)
- Deployed Version
- Compatible Core Version
- Deployment Status
- Last Deployment Date
- Health Status
- Storage Allocation (GB)
- Storage Used (GB)
- Subscription Tier
- Features Enabled
- Domain Name
- SSL Status
- Website URL
- Mobile App Status

**Used for:** Workspace routing, health monitoring, version management, feature access control

---

### Storage Manager

**Responsibility:** Quantix Core

**Manages:**
- Quota allocation per business type (Commerce: 50GB, Laundry: 30GB, CarWash: 40GB)
- Per-tenant storage directory (`/uploads/{tenantId}/`)
- Usage tracking (real-time)
- Quota enforcement (prevent writes beyond quota)
- Warning levels (80% usage → warning, 100% → blocked)
- Upgrade flow (request larger quota)

**Provides:** Storage quota APIs, usage reports, upgrade management

---

### Database Provisioning

**Responsibility:** Quantix Core

**Manages:**
- Tenant database context creation
- Row-level security (RLS) policies per tenant
- Tenant-specific schema initialization
- Backup scheduling per tenant
- Database user/password per tenant
- Connection pooling per tenant
- Query routing by tenantId

**Provides:** Database access credentials, connection strings, RLS enforcement

---

### Website Provisioning

**Responsibility:** Quantix Core

**Manages:**
- Domain registration (if new)
- DNS configuration
- SSL/TLS certificate provisioning
- CDN configuration
- Web server provisioning
- Website deployment (product code)
- Website health monitoring
- Website backup scheduling
- Website rollback capability

**Provides:** Live website at configured domain, monitoring, deployment APIs

---

### Mobile App Provisioning

**Responsibility:** Quantix Core

**Manages:**
- App registration
- App configuration per business
- APK build infrastructure
- App store listing (configuration)
- Push notification setup
- Analytics configuration
- Feature flag provisioning

**Provides:** App configuration APIs, build infrastructure, distribution support

---

### Notification Engine

**Responsibility:** Quantix Core

**Delivers:**
- Welcome email to business owner
- Login credentials (securely)
- Onboarding guides
- Payment notifications
- Subscription renewal reminders
- Storage usage alerts
- System alerts and maintenance notices

**Uses:** Centralized notification service (email, SMS, in-app)

---

### Subscription Engine

**Responsibility:** Quantix Core

**Manages:**
- Subscription plan assignment
- Feature tier determination
- Storage quota per tier
- Billing cycle setup
- Auto-renewal configuration
- Renewal reminders
- Upgrade/downgrade handling
- Cancellation workflow

**Provides:** Feature access validation, quota enforcement, subscription APIs

---

### Deployment Engine

**Responsibility:** Quantix Core

**Manages:**
- Workspace deployment orchestration
- Version management (product versions)
- Canary deployments
- Blue-green deployments
- Rollback capability
- Health check monitoring
- Automatic failure recovery
- Deployment notifications

**Provides:** Deployment APIs, version tracking, rollback triggers

---

### Audit Engine

**Responsibility:** Quantix Core

**Tracks:**
- Business provisioning events
- Subscription changes
- Storage modifications
- Deployment history
- User access and changes
- System alerts and errors
- Compliance events

**Provides:** Audit logs, compliance reports, debugging support

---

## 5. PRODUCT TEMPLATES

### What Every Product Defines

Before a product can be provisioned, it must define templates that Quantix Core uses:

### Default Roles Template

Every product defines its default roles:

**Example: Commerce OS**
```
- Store Owner (full access to store)
- Store Manager (manage operations)
- Sales Staff (place orders, manage sales)
- Inventory Manager (manage stock)
- Delivery Partner (manage deliveries)
- Accountant (financial reports)
- Support (help customers)
```

**Example: Laundry OS**
```
- Laundry Owner (full access)
- Processing Center Manager (manage center)
- Quality Checker (QC workflows)
- Driver (manage deliveries)
- Accountant (billing)
- Support (customer support)
```

**Provisioning:** Core creates these roles automatically when workspace initializes

---

### Default Permissions Template

Every product defines permissions per role:

**Commerce OS Example:**
```
Store Owner:
  - create_store, read_store, update_store, delete_store
  - manage_inventory, manage_orders, manage_staff
  - view_analytics, export_reports
  - configure_settings, manage_payment_gateways
  
Sales Staff:
  - create_order, read_order, update_order
  - view_inventory, search_products
  - (no delete, no analytics, no settings)
```

**Provisioning:** Core applies these permissions when users are created

---

### Default Plans Template

Every product defines subscription plans:

**Commerce OS Example:**
```
Starter Plan:
  - 1 store
  - 50 GB storage
  - 1,000 orders/month
  - Basic reports
  - Email support

Professional Plan:
  - 5 stores
  - 250 GB storage
  - 50,000 orders/month
  - Advanced reports
  - Priority support
  - API access

Enterprise Plan:
  - Unlimited stores
  - 1 TB storage
  - Unlimited orders
  - Custom reports
  - 24/7 support
  - Dedicated account manager
```

**Provisioning:** Core assigns features based on selected plan

---

### Default Storage Template

Every product defines storage allocation:

**Commerce OS:** 50 GB (Starter), 250 GB (Professional), 1 TB (Enterprise)

**Laundry OS:** 30 GB (Starter), 150 GB (Professional), 500 GB (Enterprise)

**CarWash OS:** 40 GB (Starter), 200 GB (Professional), 750 GB (Enterprise)

**Provisioning:** Core allocates storage based on plan

---

### Default Branding Template

Every product defines branding:

**Core maintains:**
- Logo (platform logo)
- Primary color
- Secondary color
- Typography

**Product can override:**
- Logo per business
- Business name in UI
- Business colors (within limits)
- Custom domains

**Provisioning:** Core applies default branding, allows customization

---

### Default Website Template

Every product defines website template:

**Provisioning:**
- Core deploys website from product's template
- Product configures content (pricing, features, etc.)
- Product manages design and theming
- Core provides infrastructure

---

### Default Workspace Template

Every product defines workspace capabilities:

**Provisioning:**
- Core creates workspace with product's features
- Product initializes workspace UI
- Product loads default configuration
- Product awaits customer data entry

---

## 6. WORKSPACE REGISTRATION

### Workspace Registry

**Purpose:** Central registry of all active workspaces

**Location:** Quantix Core database

**Data per Workspace:**
```
workspace_id          → Unique identifier
business_id           → Linked business
business_type         → Commerce | Laundry | CarWash | etc.
workspace_url         → https://commerce.quantix.../tenant-id
product_version       → 2.1.0 (current running version)
compatible_core_version → 1.5.0 (minimum compatible Core version)
deployment_status     → Provisioning | Deploying | Running | Maintenance | Failed
last_deployment_at    → Timestamp
health_status         → Online | Offline | Warning | Maintenance
storage_quota_gb      → 50
storage_used_gb       → 12
cpu_usage_percent     → 45
memory_usage_percent  → 62
request_latency_ms    → 125
error_rate_percent    → 0.1
last_health_check_at  → Timestamp
feature_flags         → [list of enabled features]
```

### Registry Usage

**Quantix Core uses Registry for:**
1. Workspace routing (find correct product)
2. Health monitoring (detect failures)
3. Version management (track upgrades)
4. Feature access control (check enabled features)
5. Storage enforcement (block if quota exceeded)
6. Performance monitoring (track metrics)
7. Deployment orchestration (coordinate upgrades)

**Products query Registry for:**
1. Business information (read-only)
2. Subscription tier (read-only)
3. Enabled features (read-only)
4. Quota information (read-only)

---

## 7. WORKSPACE LAUNCH

### Launch Flow (User Perspective)

```
User clicks "Open Workspace" button in Quantix Core
    ↓
Core reads Business (to get Business Type)
    ↓
Core queries Workspace Registry (to get workspace details)
    ↓
Core generates JWT token (contains: userId, businessId, permissions)
    ↓
Core reads Business Type
    ↓
IF Commerce:
    ├─ Workspace URL = commerce.quantixtechnology.in/{tenantId}
    └─ Route to Commerce OS
ELSE IF Laundry:
    ├─ Workspace URL = laundry.quantixtechnology.in/{tenantId}
    └─ Route to Laundry OS
ELSE IF CarWash:
    ├─ Workspace URL = carwash.quantixtechnology.in/{tenantId}
    └─ Route to Car Wash OS
    ↓
Product workspace validates JWT with Core
    ↓
Product loads tenant configuration from Core API
    ↓
Product renders dashboard
    ↓
User operates within product workspace
```

### Key Principle: Configuration-Driven Routing

**Workspace URLs are NEVER hardcoded**

Instead:
1. Business Type → Workspace URL mapping stored in Core config
2. URL can be changed without code changes
3. Products can be deployed to different URLs
4. Easy to support multiple deployments (prod, staging, dev)
5. Easy to move products to different infrastructure

---

## 8. STORAGE PROVISIONING

### Storage Allocation per Business Type

| Business Type | Starter | Professional | Enterprise |
|---|---|---|---|
| Commerce | 50 GB | 250 GB | 1 TB |
| Laundry | 30 GB | 150 GB | 500 GB |
| Car Wash | 40 GB | 200 GB | 750 GB |

### Storage Folder Structure

```
/storage/{tenantId}/
├── /uploads/
│   ├── /products/          (Commerce product images)
│   ├── /inventory/         (Inventory attachments)
│   ├── /orders/            (Order documents)
│   ├── /invoices/          (Generated invoices)
│   ├── /reports/           (Exported reports)
│   ├── /documents/         (Business documents)
│   └── /media/             (User uploads)
└── /backups/
    ├── /database/          (Database backups)
    └── /files/             (File backups)
```

### Usage Tracking

**Quantix Core tracks:**
- Total allocated quota
- Current usage (real-time)
- Usage by folder
- Usage growth rate
- Last update timestamp

**Products:** Can query storage usage before accepting uploads

### Warning Levels & Enforcement

| Usage | Action |
|---|---|
| 0-79% | Operating normally |
| 80-99% | Warning email sent to owner |
| 100% | Uploads blocked, error to user |

### Upgrade Flow

**When customer reaches 99% quota:**

1. Warning email sent to business owner
2. Owner can request storage increase
3. Admin approves/adjusts quota
4. Core updates storage allocation
5. Uploads resume immediately

---

## 9. DEPLOYMENT LIFECYCLE

### Deployment Stages

#### **1. Provision**
- Register workspace in registry
- Create database access
- Allocate storage
- Prepare deployment environment

#### **2. Deploy**
- Deploy product code to workspace
- Initialize database schema
- Run migrations
- Load default configuration

#### **3. Health Check**
- Verify product startup
- Check database connectivity
- Verify storage access
- Test API endpoints

#### **4. Version**
- Record deployed version
- Record compatible Core version
- Set deployment timestamp
- Mark as "Running"

#### **5. Monitoring**
- Continuous health checks (every 5 minutes)
- Performance metrics tracking
- Error rate monitoring
- Resource usage monitoring

#### **6. Rollback**
- If deployment fails or product becomes unhealthy
- Revert to previous version
- Restore from backup if needed
- Notify customer

---

## 10. FAILURE HANDLING

### Business Provision Failure

**When:** Any step from Business Creation to Workspace Ready fails

**Response:**
1. Business marked as "Provisioning Failed"
2. Support team notified automatically
3. Error logged in Audit Engine
4. Customer contacted
5. Issue resolved manually
6. Provisioning retried

**Recovery:** Idempotent (safe to retry from failure point)

---

### Workspace Failure

**When:** Product workspace becomes unresponsive

**Response:**
1. Health check detects failure
2. Core marks workspace as "Offline"
3. Support team notified
4. Customer notified via email
5. Automatic rollback attempted (if applicable)
6. Manual investigation if needed

**Recovery:** Restart workspace or rollback version

---

### Storage Failure

**When:** Storage becomes unavailable or quota exceeded

**Response:**
1. Storage write fails
2. Product catches error
3. User sees error message
4. Core marks storage as "Warning" in registry
5. Support team notified
6. Customer prompted to increase quota or delete files

**Recovery:** Increase quota or cleanup storage

---

### Deployment Failure

**When:** Product deployment fails during upgrade

**Response:**
1. Deployment detected as failed
2. Automatic rollback to previous version
3. Workspace marked as "Deployment Failed"
4. Support team notified
5. Customer notified (workspace still running on old version)
6. Manual investigation initiated

**Recovery:** Fix deployment, retry with new version

---

### Domain Failure

**When:** Domain registration or SSL certificate fails

**Response:**
1. Website becomes inaccessible
2. Core marks website as "Failed"
3. Support team notified
4. Customer notified
5. Manual intervention required

**Recovery:** Fix domain or certificate, restart website

---

### Credential Failure

**When:** Admin credentials can't be created or delivered

**Response:**
1. Provisioning marked as "Failed"
2. Support team notified
3. Manual credentials generated
4. Delivered to customer via support

**Recovery:** Manual credential delivery

---

### Rollback Strategy

**Before Deploying New Version:**
1. Take full backup of current version
2. Record previous version number
3. Create rollback script

**If Deployment Fails:**
1. Stop new version immediately
2. Run rollback script
3. Restore previous version
4. Verify health checks pass
5. Notify team and customer

**Rollback is Automatic** (no manual intervention needed)

---

## PROVISIONING IDEMPOTENCY

### Critical Principle

Every provisioning operation must be **idempotent**:
- Running it twice = running it once
- Safe to retry on failure
- No duplicate data created
- No data lost on retry

### Implementation Pattern

```
IF provisioning_step_already_done:
  RETURN success
ELSE:
  DO provisioning_step
  MARK as done
  RETURN success
```

**Examples:**
- Creating admin user: Check if exists, return existing if present
- Creating storage: Check if exists, return existing if present
- Creating database: Check if exists, return existing if present
- Creating workspace: Check if exists, return existing if present

---

## FUTURE EXTENSIBILITY

### Adding New Products

To add a new product (e.g., Salon OS):

1. **Define Product Template**
   - Default roles
   - Default permissions
   - Default plans
   - Default storage allocation
   - Default branding

2. **Register in Product Registry**
   - Product ID
   - Product URL pattern
   - Compatibility requirements
   - Feature list

3. **Deploy Product Workspace**
   - Commerce.quantix... → SalonOS.quantix...
   - Same provisioning process
   - Same Workspace Registry
   - Same deployment lifecycle

4. **Test Provisioning**
   - Create test business with Salon business type
   - Verify all provisioning steps succeed
   - Test failure scenarios
   - Verify rollback works

**No Core changes required** - product integration is configuration-driven

---

## PROVISIONING CONFIGURATION

All provisioning is configuration-driven, not hardcoded:

```yaml
provisioning:
  business_types:
    commerce:
      product_url: https://commerce.quantixtechnology.in
      default_storage_gb: 50
      plans:
        starter: {storage: 50, features: [basic]}
        professional: {storage: 250, features: [advanced]}
        enterprise: {storage: 1000, features: [all]}
    laundry:
      product_url: https://laundry.quantixtechnology.in
      default_storage_gb: 30
      plans:
        starter: {storage: 30, features: [basic]}
        # ... etc
```

**Changing Product URL:** Update config, restart Core (no code change)

**Adding New Product Type:** Add to config, deploy, no other changes needed

---

## CONCLUSION

This specification defines how Quantix Core provisions every product independently and identically:

✅ **Quantix Core:** Provisions infrastructure, manages configuration, handles billing
✅ **Products:** Execute business operations using Core-provisioned infrastructure
✅ **Future Products:** Follow identical provisioning spec, fully supported

**No product-specific logic in Core**
**No business operations in Core**
**Provisioning is configuration-driven**
**Every product extensible without Core changes**

---

**Document Status:** Complete - Architecture Specification Ready

