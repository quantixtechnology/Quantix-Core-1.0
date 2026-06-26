======================================
QUANTIX CORE ARCHITECTURE
FROZEN - SINGLE SOURCE OF TRUTH
======================================

This document is the ONLY architecture source of truth for Quantix Core.

If any other document conflicts with this document, THIS DOCUMENT WINS.

All AI assistants must read this document before writing code.

Roadmaps, audits, migration notes, release notes and task documents are reference material only.
They DO NOT define architecture.

---

# QUANTIX CORE MASTER ARCHITECTURE

**Last Updated:** 2026-06-27  
**Status:** FROZEN - Architecture Locked  
**Scope:** Complete Platform Controller Architecture & Product Ecosystem  
**Approval:** User Approved (2026-06-27)  
**Current Revision:** 2.1

---

## REVISION HISTORY

| Revision | Date | Summary | Approved By |
|----------|------|---------|-------------|
| 1.0 | 2026-06-26 | Initial architecture freeze, merged from v1.0 + specifications | User |
| 2.0 | 2026-06-27 | Business Provisioning inserted into Business Creation lifecycle. Feature Assignment moved into provisioning (not operational feature). Workspace Launch occurs only after provisioning completes. | User |
| 2.1 | 2026-06-27 | Added Golden Rules 12, 13, 14. Added Architecture Validation Checklist. Permanent governance framework established. | User |

---

## EXECUTIVE SUMMARY

Quantix Core is the **Platform Controller** for the Quantix SaaS ecosystem. It manages provisioning, billing, users, infrastructure, and support. Products are independent business operating systems that handle workflows.

**Key Principle:** Quantix is a SaaS company selling business software, not a cloud provider.

---

## CORE PHILOSOPHY

These principles are permanent and define all future development:

1. **Quantix is a SaaS company, not a cloud provider.** We sell business software, not infrastructure.
2. **Quantix Super Admin manages the platform.** Only Super Admin controls infrastructure, deployments, domains, SSL, and feature toggles.
3. **Business Owners manage only their business.** They configure products and manage business operations, never infrastructure.
4. **Products operate businesses.** Each product is a complete operating system for a specific business type.
5. **Clean separation.** Core handles platform provisioning, billing, and management. Products handle workflows and business content.
6. **Product independence.** Products are independently deployable, independently versioned, and independently scalable.

---

## SECTION 1: VISION & SUCCESS CRITERIA

### What Quantix Core Is

Quantix Core (app.quantixtechnology.in) is the **Platform Controller** for the entire Quantix ecosystem. It is NOT a business operating system—it is the management layer that controls provisioning, configuration, billing, and operations of all products.

### Success Criteria

Quantix Core is successful when:
1. Multiple products can be deployed to multiple workspaces
2. Each product operates independently without impacting others
3. Customers can manage their entire Quantix experience from Core
4. Products focus entirely on their domain (Commerce, Laundry, etc.)
5. New products can be added without modifying Core business logic

---

## SECTION 2: PRODUCT ECOSYSTEM

### Current Products

#### **Commerce OS**
- **Purpose:** Complete operating system for retail and e-commerce businesses
- **Deployment:** commerce.quantixtechnology.in
- **Versioning:** Independent (e.g., Commerce OS v2.1.0)
- **Ownership:** Managed by Commerce product team
- **Launch From:** Quantix Core directs merchants to Commerce workspace
- **Completion:** 85-90% (Audit: COMMERCE_OS_ARCHITECTURE_AUDIT.md)

#### **Laundry OS**
- **Purpose:** Complete operating system for laundry service businesses
- **Deployment:** laundry.quantixtechnology.in
- **Versioning:** Independent (e.g., Laundry OS v1.3.0)
- **Ownership:** Managed by Laundry product team
- **Launch From:** Quantix Core directs laundry businesses to Laundry workspace
- **Completion:** 78-82% (Audit: LAUNDRY_OS_ARCHITECTURE_AUDIT.md)

#### **Car & Bike Wash OS**
- **Purpose:** Complete operating system for automotive wash services
- **Deployment:** carwash.quantixtechnology.in
- **Versioning:** Independent (to be determined)
- **Ownership:** To be assigned to wash product team
- **Launch From:** Quantix Core will direct wash businesses to Wash workspace

### Product Lifecycle

Each product:
- Is developed independently with its own team
- Is versioned independently
- Can be deployed independently
- Can be updated independently without affecting other products
- Has dedicated infrastructure and databases
- Receives tenant-specific configuration from Quantix Core
- Never contains platform-level concerns (billing, subscriptions, users)

### Future Products

The Quantix ecosystem is designed to scale to unlimited products:
- Food Delivery OS
- Salon & Spa OS
- Fitness & Wellness OS
- Healthcare Services OS
- Education Management OS
- Restaurant OS
- Clinic OS
- Warehouse OS
- Manufacturing OS
- And more...

Each future product follows the same architecture, provisioning, and integration patterns defined in this document.

---

## SECTION 3: PRODUCT ARCHITECTURE

### Quantix Core Is The Platform Controller

Quantix Core manages:
- Businesses
- Products
- Sales
- CRM
- Account & Billing
- Website Management (Infrastructure)
- Users
- Employees
- Feature Management
- Storage
- Notifications
- Support
- Reports
- Platform Settings

### Products Are Business Operating Systems

Products are business operating systems. Initially:
- Commerce OS
- Laundry OS
- Car Wash OS

Every Product owns:
- Feature Catalog
- Default Roles
- Default Permissions
- Default Storage
- Default Subscription Plans

Products DO NOT own platform management.

### One Business Belongs to One Product Only

Businesses belong to exactly one **Business Type**, which determines:
- Which product the business uses
- Which workspace opens
- Which features and pricing are available
- Which operational system runs the business

### Business Creation Flow

```
Business Information
    ↓
Select Product
    ↓
Select Subscription Plan
    ↓
Create Business
    ↓
Business Provisioning
    ↓
Assign Licensed Features
    ↓
Generate Product Workspace
    ↓
Activate Workspace
    ↓
Customer Login
```

### Business Provisioning

Business Provisioning is a Quantix Core responsibility executed immediately after Business Creation. It is the automated process that prepares a business for operation before any customer access is granted.

**Provisioning includes:**
- Validate Product exists and is active
- Validate Subscription Plan exists
- Create Product Assignment (productCode, productVersion, subscriptionPlanCode)
- Assign Licensed Features from subscription plan
- Apply Product Default Settings (currency, timezone, prefixes, notifications)
- Apply Default Roles (product-specific roles for business)
- Apply Default Permissions (based on roles)
- Allocate Storage Quota (per subscription plan)
- Generate Website Configuration (domain, SSL, branding)
- Generate Workspace Configuration (features, permissions, settings)
- Register Workspace (create workspace entry, set status = PROVISIONING)
- Mark Workspace Ready (set status = READY, ready for first login)

**Key Principle:** Business Owners never perform provisioning. All provisioning is automated by Quantix Core.

**Idempotency:** Provisioning is fully idempotent—retrying failed steps does not cause duplication or data loss.

**Failure Handling:** If provisioning fails:
- Business status set to "Provisioning Failed"
- Support team notified
- Customer contacted with resolution steps
- Provisioning can be retried

### Feature Hierarchy & Assignment

**Feature Definition and Assignment Flow:**

```
Product (owns feature definitions and catalog)
    ↓
Subscription Plan (selects licensed features for tier)
    ↓
Licensed Features (assigned to business during provisioning)
    ↓
Business (stores assigned features)
    ↓
Workspace (receives only licensed features)
    ↓
RBAC (controls which users access which features)
    ↓
User Access (final permission level)
```

**Important Clarification:** Feature Assignment is NOT an operational feature allowing customers to change their features. Feature Assignment is an internal Business Provisioning step that occurs automatically when a business is created. It assigns the licensed features from the selected subscription plan to the business record, which is then provided to the workspace.

**Licensed Features Principle:** A business should receive ONLY the features it has licensed via its subscription plan. No unlicensed features should be visible or accessible to the business.

### Platform Super Admin Authority

Only Quantix Super Admin can:
- Create Products
- Configure Subscription Plans
- Configure Default Roles
- Configure Default Permissions
- Configure Default Storage
- Configure Websites (Infrastructure)
- Configure Infrastructure
- Provision Businesses
- Assign Licensed Features
- Activate Workspaces (make them ready for first login)
- Override Feature Assignments (future capability)

### Business Owner Limitations

Business Owners can only:
- Operate their assigned Product
- Manage business content within their product
- Configure product settings
- Never manage infrastructure
- Never manage billing
- Never manage platform features

---

## SECTION 4: QUANTIX CORE RESPONSIBILITIES

Quantix Core owns and operates the following platform-level concerns:

### Sales & Customer Acquisition
- Sales CRM (customer relationship management)
- Lead tracking and management
- Lead qualification and routing
- Sales pipeline visualization
- Sales team performance tracking

### Proposal & Quotation Management
- Quote generation and customization
- Proposal document creation
- Pricing configuration per business type
- Template management
- Version control and approval workflows

### Account & Billing
- Customer billing information
- Invoice generation and delivery
- Payment tracking and reconciliation
- Refund and dispute management
- Tax and compliance calculations

### Subscription Management
- Plan selection and configuration
- License allocation per tenant
- Feature tier management
- Billing cycle management
- Subscription status tracking

### Renewal Management
- Renewal notifications and workflows
- Renewal pricing and discounts
- Auto-renewal configuration
- Renewal lifecycle tracking
- Churn prevention

### Commission Management
- Sales commission calculation
- Commission rate configuration by product
- Commission payout tracking
- Commission reconciliation
- Sales incentive management

### People Management
- Sales team management
- Sales rep onboarding and offboarding
- Sales rep territory and assignment
- Sales performance tracking
- Employee directory

### HRMS (Human Resource Management System)
- Employee payroll
- Leave management
- Attendance tracking
- Performance reviews
- Employee benefits administration
- Compliance and statutory reporting

### Tenant & Business Provisioning
- Business registration and onboarding
- Tenant database provisioning
- Tenant isolation and security
- Tenant configuration storage
- Tenant credential management
- Multi-workspace support

### Website Provisioning & Management (Super Admin Only)

**PERMANENT RULE:** Only Quantix Super Admin creates and manages websites.

- Domain registration and mapping
- SSL certificate provisioning and renewal
- Web hosting and infrastructure
- CDN configuration
- Website deployment and updates
- DNS management
- Performance monitoring
- Backup and disaster recovery
- Website analytics integration

**Business Owners do NOT create websites.** They only manage business content within their product workspace (e.g., products in Commerce OS, services in Laundry OS).

### Mobile App Provisioning
- App registration and configuration
- Push notification setup
- Analytics integration
- Feature flag management
- A/B testing framework

### Deployment Management
- Product deployment orchestration
- Version rollout tracking
- Canary deployment management
- Rollback procedures
- Blue-green deployment support

### Monitoring & Infrastructure
- System uptime monitoring
- Performance monitoring
- Error tracking and alerting
- Log aggregation
- Infrastructure health
- Capacity planning

### Analytics & Reporting
- Platform-wide analytics
- Customer usage analytics
- Revenue analytics
- Product adoption metrics
- Cohort analysis
- Custom report builder

### Notifications & Communication
- Email notification system
- SMS notification system
- In-app notification system
- Notification template management
- Notification delivery and retry logic
- Unsubscribe management

### Brand Studio
- Logo and branding asset management
- Color palette and design tokens
- Font and typography management
- UI component library
- Design system documentation
- White-labeling support

### Global Roles & Permissions
- Platform-level user roles
- Permission matrix definition
- Role-based access control
- Permission inheritance and defaults
- Audit of permission changes

### Audit Logs & Compliance
- User action auditing
- Data change auditing
- API call logging
- Compliance reporting
- Data retention policies
- GDPR and regulatory compliance

### Backup & Disaster Recovery
- Automated backup scheduling
- Point-in-time recovery
- Backup verification and testing
- Disaster recovery planning
- Geographic redundancy
- Data replication

---

## SECTION 5: WHAT PRODUCTS NEVER OWN

To maintain architectural simplicity, products NEVER manage:

### Platform Concerns (Always in Quantix Core)
- Subscription management
- Billing and invoicing
- Payment processing
- User authentication (Super Admin only)
- Role and permission management (Super Admin only)
- Website creation and management (Super Admin only)
- Domain and SSL management (Super Admin only)
- Feature toggles and deployment
- Infrastructure and hosting
- Backup and disaster recovery
- Monitoring and alerting
- Compliance and audit logs

### Business Ownership Rule

Ask: "Would a Business Owner ever manage this?"
- If NO → It belongs in Quantix Core (platform responsibility)
- If YES → It belongs in the Product (business responsibility)

Examples:
- Products own: Orders, Customers, Services, Pricing → YES (Business Owner manages)
- Core owns: Subscription, Billing, Domains, SSL, Users → NO (Super Admin only manages)

---

## SECTION 6: FEATURE TOGGLE MANAGEMENT

Every business has Feature Toggles that control which product features are available.

### Super Admin Only Control
- Only Quantix Super Admin can enable/disable features
- Business Owners cannot modify feature toggles
- Features are assigned during business provisioning based on plan

### Example Features by Product

**Commerce OS Features:**
Inventory, Products, Delivery, Wallet, POS, Coupons, Wholesale, ERP

**Laundry OS Features:**
CRM, Marketing, Pickup, Delivery, Processing, Queue, Batch, Machine, QC, WhatsApp, Subscriptions

### Business Owner Limitation
- Can only use features assigned by Super Admin
- Cannot unlock or enable additional features
- Cannot modify feature configuration

---

## SECTION 7: PLATFORM OWNERSHIP MATRIX

This matrix defines which system owns every major capability.

### Quantix Core Owns
- Sales CRM, Leads, Quotations, Proposal Documents
- Business Creation, Tenant Provisioning, Subscription Management, Billing, Renewals, Commission Management
- HRMS, User Management, RBAC, Brand Studio
- Storage Quotas, Website Provisioning, Domain Management, SSL, DNS, CDN, Deployment, APK Build, Monitoring
- Audit Logs, Notifications

### Commerce OS Owns
- Products, Categories, Inventory, Orders, Delivery, Coupons
- Commerce Website Content, Commerce CRM, Commerce Marketing

### Laundry OS Owns
- Laundry Workflow, Store Audit, Processing Center, Queue Management, Batch Management
- Machine Operations, Quality Check, Packing Validation, Delivery Workflow
- Laundry CRM, Laundry Marketing, Laundry Website Content

### Car Wash OS Owns (Future)
- Service Types and Packages, Service Scheduling, Queue Management, Service Execution
- Machine Operations, Bay Management, Service Quality Checks, Inventory Management (supplies)
- Car Wash CRM, Car Wash Marketing, Car Wash Website Content

### Critical Ownership Rules
1. **No Product Logic in Core:** Core never implements product-specific workflows
2. **No Platform Logic in Products:** Products never manage subscriptions or billing
3. **No Data Duplication:** If data is owned by System A, System B must not replicate it
4. **Single Source of Truth:** For every capability, exactly one system is authoritative
5. **Clear Dependencies:** If B depends on A, B consumes A's APIs; A never depends on B
6. **Independent Scaling:** Each system must be scalable independently

---

## SECTION 8: PRODUCT BOUNDARY & CLEAN SEPARATION

### The Clean Separation

Quantix Core and Products must maintain a clean architectural boundary.

#### **Core Owns**
- Customer & Account Management
- Billing & Subscription
- Provisioning & Infrastructure
- Monitoring & Operations
- Analytics (Platform-level)
- Support & Compliance

#### **Products Own**
- Business Workflows
- User Interfaces
- Domain Logic
- Product Databases
- Product APIs
- Product Analytics
- Product-specific Features

### Boundary Rules

1. **Quantix Core never contains Commerce workflows**
2. **Quantix Core never contains Laundry workflows**
3. **Quantix Core never contains Car Wash workflows**
4. **Products never duplicate Core responsibilities**

### Communication Pattern

```
Product → Quantix Core API (Request configuration, check subscription)
Core → Product API (Notify of provisioning, send configuration)
Product → Product Database (All operational data)
Core → Core Database (All platform data)
```

---

## SECTION 9: BUSINESS TYPES

### Business Type Definition

Every business belongs to exactly one **Business Type**, which determines:
- Which product the business uses
- Which workspace opens
- Which features and pricing are available
- Which operational system runs the business

### Business Type Classification

```
Business → Business Type
├── Commerce
├── Laundry
├── Car & Bike Wash
├── Food Delivery (future)
├── Salon & Spa (future)
└── [More as products are added]
```

### Business Type Attributes
- **Type Key** (unique: "commerce", "laundry", "carwash")
- **Type Name** (display: "Commerce OS", "Laundry OS")
- **Product Code** (maps to deployment)
- **Workspace URL** (where product runs)
- **Feature Tiers** (available subscription plans)
- **Default Storage Quota** (starting allocation)
- **Provisioning Template** (configuration defaults)
- **Status** (active, beta, deprecated, planned)

### Examples

#### **Commerce Business Type**
- Type Key: "commerce"
- Workspace URL: "https://commerce.quantixtechnology.in"
- Feature Tiers: [Starter, Professional, Enterprise]
- Default Storage: 50 GB

#### **Laundry Business Type**
- Type Key: "laundry"
- Workspace URL: "https://laundry.quantixtechnology.in"
- Feature Tiers: [Starter, Professional, Enterprise]
- Default Storage: 30 GB

### Implications
- **Single Type per Business:** Cannot operate as both Commerce and Laundry
- **Type Determines Workspace:** Business Type determines which workspace opens
- **Immutable:** Type shouldn't change after initial setup
- **Subscription Plans:** Each type has its own plans and pricing

---

## SECTION 10: WORKSPACE ROUTING

### Routing Model

```
User Login → Quantix Core → Check Business Type →
Commerce → commerce.quantixtechnology.in
Laundry → laundry.quantixtechnology.in
CarWash → carwash.quantixtechnology.in
[Future] → [product].quantixtechnology.in
```

### Routing Flow
1. User opens app.quantixtechnology.in
2. User logs in with credentials
3. Quantix Core authenticates user
4. Quantix Core checks user's business(es)
5. **Quantix Core verifies provisioning is complete** (REQUIRED)
6. Quantix Core determines Business Type
7. Quantix Core redirects to appropriate workspace
8. Product workspace authenticates with token from Core
9. Product loads tenant-specific configuration from Core
10. User operates within product workspace

### Workspace Activation Readiness

Before a business owner can access their product workspace, Quantix Core must verify all provisioning steps have completed:

**Required Conditions for Workspace Access:**
- ✓ Product Assignment exists (productCode, productVersion)
- ✓ Subscription Plan exists and is valid
- ✓ Licensed Features are assigned
- ✓ Default Roles are applied
- ✓ Default Permissions are applied
- ✓ Storage Quota is allocated
- ✓ Website Configuration exists
- ✓ Workspace Configuration exists
- ✓ Workspace Status = READY
- ✓ All provisioning steps completed without errors

**Access Denied If:**
- Provisioning not completed
- Business status = "Provisioning Failed"
- Workspace status ≠ READY
- Product is disabled
- Subscription is cancelled
- User lacks access permission

**Principle:** Business Owners must never access a workspace before it is fully provisioned and ready.

### Routing Decision Tree

```
USER OPENS APPLICATION → Check authentication
├─ NO → Redirect to login
└─ YES → Read user's business(es)
    ├─ ONE business → Read type → Redirect to workspace
    ├─ MULTIPLE businesses → Show selector → User chooses → Redirect
    └─ NO businesses → Show message → Offer setup/support
```

### Routing Decision Matrix

| User Scenario | Decision | Action | Destination |
|---|---|---|---|
| 1 Business, Commerce | Single path | Direct | commerce.quantix... |
| 1 Business, Laundry | Single path | Direct | laundry.quantix... |
| 2 Businesses | Choose | Show selector | commerce.quantix... or laundry.quantix... |
| Admin User | Superuser | Admin routing | admin.quantix... |
| No Business | No routing | Setup message | Stay at core |
| Disabled User | Access denied | Deny | Stay at login |

### Multi-Workspace Support

Users can operate businesses in different products:
```
User: Raj Kumar
├── Business 1: "Raj's Store" (Commerce) → commerce workspace
├── Business 2: "Raj's Laundry" (Laundry) → laundry workspace
└── Business 3: "Raj's Dry Cleaning" (Laundry) → laundry workspace
```

### Session Management
- Session timeout: 30 minutes of inactivity
- Token expiry: 8 hours
- On timeout: Core redirects to re-authentication
- On token expiry: Product requests refresh from Core

---

## SECTION 11: WEBSITE ARCHITECTURE

### Website Provisioning Model

Quantix Core provisions infrastructure. The product provides content.

### What Quantix Core Provisions
- Domain registration and management
- DNS configuration
- SSL/TLS certificates and renewal
- CDN provisioning
- Web server provisioning
- Deployment infrastructure
- Storage and assets
- Monitoring and analytics (infrastructure)
- Security infrastructure (WAF, DDoS)

### What Product Owns
- Website content and copy
- Design and theming
- Features (booking forms, contact forms, etc.)
- Website SEO and meta data
- Website analytics (product-specific)
- Website maintenance and updates

### Website Responsibility Matrix

#### **Quantix Core Website Responsibilities (Infrastructure)**
- Domain registration and renewal
- DNS configuration
- SSL/TLS certificates and renewal
- HTTPS enforcement and security headers
- CDN provisioning and configuration
- Cache invalidation and purging
- Performance optimization (compression)
- DDoS protection and rate limiting
- Web server provisioning
- Load balancer configuration
- Automatic scaling policies
- Deployment pipeline and rollbacks
- Static asset storage provisioning
- Automatic backup scheduling
- Point-in-time recovery capability
- Uptime monitoring and alerting
- Performance monitoring
- Error tracking and alerts
- Traffic analytics
- Infrastructure health checks

#### **Product Website Responsibilities (Content)**
- Business content (products, services, pricing)
- Website design and branding
- Layout and navigation
- Theme customization and colors
- Logo usage and placement
- Functional features (forms, bookings, shopping)
- Product/service listing pages
- Customer testimonials and reviews
- Blog posts and articles
- Page meta descriptions and titles
- URL structure and routing
- Keyword research and SEO
- XML sitemap generation
- Structured data (schema markup)
- Conversion tracking
- User behavior analytics
- A/B testing
- Content updates and publishing
- Feature announcements

#### **Core Does NOT Do**
- Edit business content
- Modify product descriptions
- Change pricing displays
- Update service listings
- Write or publish articles
- Create marketing content
- Design website layouts
- Select business branding

#### **Products Do NOT Do**
- Manage domains
- Install SSL certificates
- Configure DNS
- Manage CDN settings
- Deploy website code
- Manage backups
- Monitor infrastructure
- Handle infrastructure scaling

### Website Content Governance
- **Products own business content** - Authority to update pricing, services, information
- **Core owns infrastructure** - Authority to update security, scale, deploy

---

## SECTION 12: STORAGE ARCHITECTURE

### Storage Isolation Model

Each tenant receives isolated storage allocation. Core manages quota; products consume storage.

### Storage Structure
```
Storage Root
└── /uploads/
    ├── {tenantId_1}/
    │   ├── inventory/
    │   ├── orders/
    │   ├── documents/
    │   ├── media/
    │   └── reports/
    ├── {tenantId_2}/
    └── ...
```

### Storage Allocation Model
- **Default allocation:** Commerce: 50GB, Laundry: 30GB, CarWash: 40GB
- **Maximum allocation:** Can be increased with upgrade
- **Overage handling:** Warning at 80%, blocked at 100%
- **Storage tiers:** Free → Starter → Professional → Enterprise

### Storage Management
- **Quota enforcement:** Core prevents writes beyond quota
- **Usage tracking:** Real-time monitoring
- **Cleanup policies:** Automatic cleanup of old files
- **Archival:** Automatic archival to cold storage

### Quantix Core Responsibilities
- Define storage quota per Business Type
- Enforce storage limits
- Track storage usage in real-time
- Provide storage usage APIs to products
- Manage storage billing
- Archive and compress old data

### Product Responsibilities
- Store operational data in tenant-specific directory
- Check available storage before writes
- Implement cleanup of temporary files
- Optimize storage usage
- Report metrics back to Core
- Request expansion when needed

---

## SECTION 13: DATABASE ARCHITECTURE

### Database Isolation Strategy

Each tenant's data is isolated for security, performance, and compliance.

### Current Database Model

```
PostgreSQL Database
├── Platform Schema
│   ├── users (global platform users)
│   ├── businesses (tenant configurations)
│   ├── subscriptions
│   ├── audit_logs
│   └── [Core tables]
└── Per-Tenant Data
    ├── Customer data
    ├── Transaction data
    ├── Configuration data
    └── [Tenant-specific tables]
```

**Isolation Method:** Row-level security (RLS) using `tenantId` column

### Database Isolation Rules
1. **Explicit Tenant Association:** Every table has a `tenantId` column
2. **RLS Policies:** Database enforces isolation at row level
3. **No Cross-Tenant Queries:** Queries must always filter by `tenantId`
4. **Audit Logging:** All data access is logged
5. **Encryption at Rest:** Sensitive data is encrypted
6. **Encryption in Transit:** All connections use TLS

### Scaling Strategy (Future)

- **Phase 1 (Current):** Shared database with RLS (suitable for <1000 tenants)
- **Phase 2 (Future):** Database sharding (1000-100K tenants)
- **Phase 3 (Future):** Multi-database (>100K tenants)

### Database Provisioning

When new tenant is provisioned:
1. Business record created with unique `businessId`
2. Tenant context created with `tenantId`
3. Initial schema rows created with `tenantId`
4. Configuration stored
5. Storage allocation created
6. Subscription record created
7. Audit log entry written

**No new database created** - all tenant data coexists with RLS enforcement

---

## SECTION 14: BUSINESS PROVISIONING SEQUENCE

### End-to-End Provisioning Journey

```
Lead Closed → Business Created → Business Type Selected → 
Subscription Assigned → Tenant Provisioned → Database Allocated → 
Storage Provisioned → Website Provisioned → Mobile App Reserved → 
Workspace Enabled → Credentials Generated → Customer Begins Operations
```

### Detailed Steps

| Step | Time | Responsible | Output |
|------|------|---|---|
| Lead Closed | T+0 | Sales | Closed deal record |
| Business Created | T+5 min | Core | Business ID assigned |
| Business Type Selected | T+5 min | Core | Business Type assigned |
| Subscription Assigned | T+5 min | Core | Subscription ID created |
| Tenant Provisioned | T+10 min | Core | Tenant context created |
| Database Allocated | T+10 min | Core | Database access credentials |
| Storage Provisioned | T+10 min | Core | Storage path and quota |
| Website Provisioned | T+20 min | Core | Live website at domain |
| Mobile App Reserved | T+20 min | Core | App configuration ready |
| Workspace Enabled | T+25 min | Product | Workspace ready |
| Credentials Generated | T+30 min | Core | Access credentials delivered |
| Customer Begins Operations | T+30 min | Product | Business operational |

### Total Time to Ready: ~30 minutes (automated)

### Failure Recovery
- Business status set to "Provisioning Failed"
- Support team notified
- Customer contacted
- Issue diagnosed and resolved
- Provisioning retried
- Customer updated

### Idempotency
Each step is idempotent - retrying doesn't create duplicates or data loss

---

## SECTION 15: AUTHENTICATION MODEL

### Centralized Authentication Architecture

Authentication is centralized in Quantix Core. All users authenticate once in Core, and products trust tokens issued by Core.

### Authentication Flow
```
User Opens Application → Quantix Core
→ User enters credentials
→ Core validates credentials
→ Core checks subscription status
→ Core generates JWT token
→ Core redirects to workspace
→ Workspace validates JWT with Core
→ User operates within workspace
```

### Token Structure

**JWT Token contains:**
- `userId` - Unique user identifier
- `businessId` - Business being accessed
- `businessType` - Product type
- `role` - User role
- `permissions` - Granted permissions
- `iat` - Issued at timestamp
- `exp` - Expiry (8 hours)
- `iss` - Issuer (Quantix Core)

**Token is signed with Core's private key** - only Core can issue valid tokens

### Session Management
- **Core maintains:** Session state, session ID, timeout (30 minutes)
- **Products maintain:** Connection state, JWT validation cache

### Multi-Business User Authentication

User with multiple businesses can switch between them:
1. Click "Switch to [Business]"
2. Core validates access
3. Core generates new JWT for that business
4. Redirect to appropriate workspace
5. Each business has separate session and token

### Token Refresh
- When token expiring (within 1 hour): Product requests refresh
- Core validates session still active
- Core generates new JWT
- Product uses new token

### Token Validation
- Products call: `POST /api/v1/auth/validate-token`
- Core returns: `{ valid: true, user: {...}, permissions: [...] }`
- Can be cached for 5 minutes

### Role-Based Access Control (RBAC)
- **Global roles:** SUPER_ADMIN, BUSINESS_OWNER, BUSINESS_ADMIN, MANAGER, STAFF, CUSTOMER, ACCOUNTANT
- **Product roles:** Products can define additional roles
- **Permissions:** Checked by `GET /api/v1/permissions/user/{userId}`

### Password Management
- **Core handles:** Password storage, reset workflows, policy enforcement, login throttling
- **Products handle:** Nothing - all delegated to Core

### Session Revocation
Sessions revoked when:
- User explicitly logs out
- User account disabled
- Subscription cancelled
- Password reset
- Admin revokes session
- Token expires

---

## SECTION 16: PRODUCT COMMUNICATION ARCHITECTURE

### Communication Flows

```
Sales Team → Quantix Core → Business → Business Type → 
Commerce OS | Laundry OS | Car Wash OS | [Future Product]
```

### Synchronous Communication
- Authentication validation
- Configuration retrieval
- Subscription verification
- Storage quota checks
- Health checks
- Token validation

### Asynchronous Communication (Webhooks)
- Subscription changes
- Billing updates
- User management events
- Audit events
- Significant operations

### Key Principles
- **Products are clients of Core** - Products request, Core responds
- **Core is source of truth** - Only Core knows subscription status and user permissions
- **No direct product-to-product communication** - All flows through Core
- **Failures must not cascade** - Systems degrade gracefully

---

## SECTION 17: PLATFORM API OWNERSHIP

### Quantix Core APIs (Not Comprehensive, See Audits)

**Business Management APIs**
- GET /api/v1/businesses/{businessId}
- POST /api/v1/businesses
- PATCH /api/v1/businesses/{businessId}

**Subscription Management APIs**
- GET /api/v1/subscriptions/{subscriptionId}
- POST /api/v1/subscriptions
- PATCH /api/v1/subscriptions/{subscriptionId}

**Storage Management APIs**
- GET /api/v1/storage/quota/{tenantId}
- GET /api/v1/storage/usage/{tenantId}
- POST /api/v1/storage/request-increase

**User & Permissions APIs**
- GET /api/v1/users/{userId}
- GET /api/v1/permissions/user/{userId}
- GET /api/v1/roles/{businessId}

**Configuration APIs**
- GET /api/v1/config/business/{businessId}
- GET /api/v1/config/subscription/{subscriptionId}
- GET /api/v1/config/features/{businessId}

### API Versioning Strategy
- **Core:** Breaking changes require new version (v2, v3), maintains backward compatibility
- **Products:** Version independently, free to iterate rapidly

### API Consumption Rules
**Products must never:**
- Call other product APIs directly
- Assume Core API responses
- Cache beyond recommended time
- Modify Core API data
- Skip validation

**Products should always:**
- Validate tokens on secure operations
- Handle failures gracefully
- Implement exponential backoff
- Log API calls
- Check subscription before features

---

## GOLDEN RULES

These rules are permanent and override all other considerations:

1. **Quantix Core is the Platform Controller.** It manages provisioning, not business operations.

2. **Products manage business operations.** They never manage platform concerns.

3. **One Business belongs to one Product only.** No cross-product businesses.

4. **One Product owns one Feature Catalog.** Products don't share feature definitions.

5. **Billing exists only once inside Account & Billing.** No product manages billing.

6. **Website infrastructure is managed only by Quantix Super Admin.** Business Owners never manage infrastructure.

7. **Business Owners never manage infrastructure.** They only manage business content.

8. **Never duplicate functionality.** If Core owns it, Products don't implement it.

9. **Every module has one owner.** Clear ownership, no ambiguity.

10. **Business Owners must never see unlicensed functionality.** All licensing and feature provisioning must be completed before first login. Every workspace receives only the features licensed by its subscription plan.

11. **Platform First.** Quantix Core must remain a Platform Controller. Every new feature must answer: "Does this belong to the Platform or to a Product?" If it belongs to a Product, it must never be implemented inside Quantix Core. Quantix Core grows very slowly after v1.5.0. Future innovation happens inside Products, while Quantix Core remains stable, lightweight, and responsible only for platform services.

12. **Products Never Communicate Directly.** Products must never directly depend on another Product. A Product must never call another Product's API directly, read another Product's database, publish directly to another Product's queue, depend on another Product's internal models, or know another Product's deployment location. All communication must occur through Platform-managed contracts provided by Quantix Core. Quantix Core owns: Service Discovery, Authentication, Authorization, Routing, API Contracts, Event Contracts, Version Compatibility, Tenant Isolation, and Audit Logging. Products know the Platform. Products never know each other.

13. **Products Own Their Own Data.** Every Product owns its business data. Quantix Core must never become a business database. Quantix Core stores only platform metadata: Businesses, Users, Authentication, RBAC, Product Registry, Runtime Registry, Provisioning, Licensing, Subscriptions, Workspaces, Audit Logs, and Platform Configuration. Products own all business data including Commerce (Products, Categories, Inventory, Orders, Customers, POS, Payments, Delivery), Laundry (Laundry Orders, Garments, Services, Processing Centers, QC, Pickup & Delivery, Store Audit), Car Wash (Services, Packages, Bookings, Queue, Bays, Scheduling), and all future Products' operational data. If a table exists because a business operates, it belongs to the Product. If a table exists because the SaaS platform operates, it belongs to Quantix Core.

14. **Platform Metadata Only.** Quantix Core is a Platform Controller. Products are Business Applications. Quantix Core never implements business workflows. Quantix Core only: Creates Businesses, Assigns Products, Assigns Plans, Assigns Licenses, Provisions Workspaces, Routes Users, Manages Runtime, Monitors Health, Manages Platform Users, Manages Billing, Manages Audit. Products implement: Business workflows, Operational rules, Industry logic, Product UI, Product APIs, Product databases. Never move Product functionality into Quantix Core.

---

## AI DEVELOPMENT RULE

**Before writing any code, every AI assistant must:**

1. **Read QUANTIX_CORE_MASTER_CONTEXT.md completely.**

2. **Validate that the requested implementation follows this architecture exactly.**

3. **If any conflict exists:**
   - STOP
   - Explain the conflict clearly
   - Do not write code until conflict is resolved

4. **Document any architectural assumptions in the code comment block at the top of implementation files.**

5. **If architecture needs updating, update THIS DOCUMENT FIRST before writing code.**

---

## MASTER CONTEXT CHANGE POLICY

This document is the constitutional foundation of Quantix Core.

It must only be updated when **permanent architectural decisions** change.

### When to Update QUANTIX_CORE_MASTER_CONTEXT.md

Update this document ONLY when one of these changes:

- Platform architecture fundamentally changes
- Ownership boundaries shift (Core vs Products)
- Product boundaries are redefined
- Platform responsibilities expand or contract
- Product responsibilities expand or contract
- Golden Rules are added, modified, or deprecated
- Governance policies are established or changed

### When NOT to Update QUANTIX_CORE_MASTER_CONTEXT.md

Do NOT update this document for:

- Feature implementation
- Milestone completion
- Bug fixes
- Refactoring
- New APIs or endpoints
- UI changes or improvements
- Database migrations or schema changes
- Product enhancements
- Performance improvements
- Testing additions
- Documentation clarifications
- Code reorganization

**These belong in:** Milestone documentation, release notes, technical guides, or API documentation.

### The Three-Question Test

Before proposing any Master Context change, answer these questions:

1. **Does this permanently change the architecture?**
   - Will the architecture be fundamentally different after this change?
   - Will the change apply for 5+ years?

2. **Will every future developer need this knowledge?**
   - Is this essential context for understanding Quantix Core's direction?
   - Will new team members need to know this to make decisions?

3. **Is this still true five years from now?**
   - Will this principle hold in 2031?
   - Or is it specific to the current implementation phase?

**If the answer to ANY question is NO:** Do not modify the Master Context.

### Purpose of This Policy

This policy ensures:
- ✅ Master Context remains concise and authoritative
- ✅ Master Context doesn't become an implementation log
- ✅ Master Context stays stable and reliable for reference
- ✅ Clear distinction between architecture and implementation
- ✅ Future developers can read one document for architecture

---

## ARCHITECTURE VALIDATION CHECKLIST

**Before ANY future implementation, automatically verify:**

- [ ] Does this belong to the Platform?
- [ ] Does this belong to a Product?
- [ ] Is any Product logic entering Core?
- [ ] Is any Product data entering Core?
- [ ] Is any Product calling another Product?
- [ ] Is every Product accessed only through Platform contracts?
- [ ] Does this preserve independent deployment?
- [ ] Does this preserve independent versioning?
- [ ] Does this preserve independent scaling?
- [ ] Does this preserve backward compatibility?

**If ANY answer fails:**

**STOP IMPLEMENTATION.**

Explain the architectural violation before writing code. Update QUANTIX_CORE_MASTER_CONTEXT.md if necessary, then proceed.

---

## QUANTIX CORE DEVELOPMENT ROADMAP

This roadmap shows the planned implementation phases for Quantix Core Platform Controller.

### v1.0.0 — Initial Platform Foundation (Complete)
- User authentication and authorization
- Business creation and provisioning basics
- Role-based access control (RBAC)
- Basic platform settings and configuration

### v1.1.0 — Platform Foundation (Complete)
- Product Registry with feature catalogs
- Subscription Plans (Starter/Professional/Enterprise)
- Product management and configuration
- Website templates and mobile app definitions
- Role and permission definitions per product

### v1.2.0 — Business → Product Assignment (Complete)
- Product selection during business creation
- Subscription plan selection
- Licensed feature assignment from plan
- Business product reference storage
- Product selection UI component

### v1.3.0 — Business Provisioning Engine (Complete)
- Pure platform orchestrator (zero product logic)
- Product provisioner delegation via registry
- Automated business provisioning
- Workspace preparation and readiness

### v1.3.1 — Product Provisioner Registry (Complete)
- Dynamic product registration mechanism
- Zero core modifications for new products
- Decoupled product provisioning

### v1.4.0 — Product Runtime Registry (Complete)
- Runtime deployment information
- Workspace URL management
- API endpoint configuration
- Health check monitoring
- Deployment mode support (LOCAL_MODULE, SUBDOMAIN, REMOTE_SERVICE, CONTAINER)

### v1.5.0 — Business Creation with Products (Next)
- Integrated Business Creation Wizard
- Product selection in creation flow
- Plan selection with feature display
- Real-time provisioning visualization
- Direct workspace launch
- Seamless product onboarding

### v1.6.0 — Laundry OS Activation (Future)
- Laundry-specific Business Creation flow
- Laundry provisioning integration
- Laundry workspace launch

### v1.7.0 — Car Wash OS Activation (Future)
- Car Wash-specific Business Creation flow
- Car Wash provisioning integration
- Car Wash workspace launch

### v1.8.0 — Commerce OS Extraction (Future)
- Physical extraction to independent repository
- After v1.5.0, v1.6.0, v1.7.0 validation
- Same pattern applies to other products

### v1.9.0+ — Additional Products (Future)
- Salon OS
- Restaurant OS
- Clinic OS
- Warehouse OS
- Manufacturing OS
- Education OS
- Healthcare OS
- And unlimited others via registry mechanism

---

## PLATFORM FREEZE

**Status:** ACTIVE

**Effective Version:** Revision 2.1

**Platform State:** STABLE

**Architecture State:** FROZEN

---

## Platform Stability

Quantix Core is considered architecturally stable.

No new Product functionality may be introduced into Quantix Core.

Quantix Core may only evolve for:
- Multi-tenancy
- Identity & Authentication
- RBAC
- Business Lifecycle
- Product Registry
- Runtime Registry
- Provisioning
- Billing
- Licensing
- Monitoring
- Health
- Audit
- Infrastructure
- Platform APIs
- Platform UI

Everything else belongs to Products.

---

## Product Innovation

All future business innovation happens inside Products.

**Examples:**

**Commerce OS:**
- Inventory
- Orders
- POS
- Products
- Delivery

**Laundry OS:**
- Laundry workflow
- Processing
- QC
- Pickup & Delivery

**Car Wash OS:**
- Packages
- Queue
- Scheduling

**Future Products:**
- Own 100% of their business domain

---

## Platform Freeze Rule

Before implementing ANY feature, answer:

**1. Is this Platform functionality?**

YES → Continue.

NO →

**2. Does it belong to a Product?**

YES → STOP.

Implement inside the Product instead.

---

## Extraction Policy

The remaining Commerce business data currently inside Quantix Core is a legacy implementation.

It is an approved temporary exception.

**No NEW Product tables or Product business logic may be added to Quantix Core.**

Existing legacy Commerce modules remain until the planned extraction (v1.8.0+).

---

## Permanent Architecture Goal

**Target Architecture:**

```
Quantix Core
   ↓
Platform Services
   ↓
Products
   ↓
Business Logic
   ↓
Business Data → Products
Platform Metadata → Core
```

This architecture is now considered the permanent long-term direction of Quantix.

---

## AUDIT REFERENCES

These documents are audits of existing systems. They are NOT architecture:

- COMMERCE_OS_ARCHITECTURE_AUDIT.md (85-90% complete)
- LAUNDRY_OS_ARCHITECTURE_AUDIT.md (78-82% complete)

These documents track progress. They are NOT architecture:

- CHANGELOG.md
- PROJECT_STATUS.md
- TASK DELIVERABLES
- TASK MIGRATION NOTES
- RELEASE NOTES

---

## DOCUMENT STATUS

**Architecture Status:** FROZEN (Revision 2.1)  
**Last Update:** 2026-06-27  
**Golden Rules:** 14 permanent rules  
**Validation Checklist:** 10-point architecture gate  
**Next Review:** Before any new feature implementation  
**Approval Status:** APPROVED  
**Current Revision:** 2.0 (Business Provisioning Architecture)  
**Next Allowed Change:** Architecture Review (user initiated only)

**This document is the ONLY source of truth for Quantix Core architecture.**

All implementation decisions must trace back to this document.

If any document conflicts with this document, THIS DOCUMENT WINS.

---

**END OF QUANTIX CORE ARCHITECTURE DOCUMENT**
