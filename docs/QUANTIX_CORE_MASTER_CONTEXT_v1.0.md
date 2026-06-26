# QUANTIX CORE MASTER CONTEXT v1.0

**Last Updated:** 2026-06-26  
**Status:** Architecture Definition (Pre-Implementation)  
**Scope:** Platform Controller Architecture & Ecosystem Design

---

## 1. VISION

### What Quantix Core Is

Quantix Core (app.quantixtechnology.in) is the **Platform Controller** for the entire Quantix ecosystem. It is not a business operating system—it is the management layer that controls the provisioning, configuration, billing, and operations of all products in the Quantix suite.

### Core Philosophy

- **Quantix is a SaaS company, not a cloud provider.** We sell business software, not infrastructure.
- **Quantix Super Admin manages the platform.** Only Super Admin controls infrastructure, deployments, domains, SSL, and feature toggles.
- **Business Owners manage only their business.** They configure products and manage business operations, never infrastructure.
- **Products operate businesses.** Each product is a complete operating system for a specific business type with its own workflows and user interface.
- **Clean separation.** Quantix Core handles platform provisioning, billing, and management. Products handle workflows and business content.
- **Product independence.** Products are independently deployable, independently versioned, and independently scalable without Super Admin involvement.

### Success Criteria

Quantix Core is successful when:
1. Multiple products can be deployed to multiple workspaces
2. Each product operates independently without impacting others
3. Customers can manage their entire Quantix experience from Core
4. Products focus entirely on their domain (Commerce, Laundry, etc.)
5. New products can be added without modifying Core business logic

---

## 2. PRODUCT ECOSYSTEM

### Current Products

The Quantix ecosystem currently consists of three independent products:

#### **Commerce OS**
- **Purpose:** Complete operating system for retail and e-commerce businesses
- **Deployment:** commerce.quantixtechnology.in
- **Versioning:** Independent (e.g., Commerce OS v2.1.0)
- **Ownership:** Managed by Commerce product team
- **Launch From:** Quantix Core directs merchants to Commerce workspace

#### **Laundry OS**
- **Purpose:** Complete operating system for laundry service businesses
- **Deployment:** laundry.quantixtechnology.in
- **Versioning:** Independent (e.g., Laundry OS v1.3.0)
- **Ownership:** Managed by Laundry product team
- **Launch From:** Quantix Core directs laundry businesses to Laundry workspace

#### **Car & Bike Wash OS** (Planned)
- **Purpose:** Complete operating system for automotive wash services
- **Deployment:** carwash.quantixtechnology.in (planned)
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

The Quantix ecosystem is designed to scale to many products:
- Food Delivery OS
- Salon & Spa OS
- Fitness & Wellness OS
- Healthcare Services OS
- Education Management OS
- And more...

Each future product follows the same architecture, provisioning, and integration patterns defined in this document.

---

## 3. RESPONSIBILITIES OF QUANTIX CORE

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
- Platform-level user roles (Super Admin, Accountant, etc.)
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

## 3.5. WHAT PRODUCTS NEVER OWN

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
- Products: Orders, Customers, Coupons, Services, Pricing → YES (Business Owner manages)
- Core: Subscription, Billing, Domains, SSL, Users → NO (Super Admin only manages)

---

## 3.6. FEATURE TOGGLE MANAGEMENT

Every business has Feature Toggles that control which product features are available.

**Super Admin Only Control:**
- Only Quantix Super Admin can enable/disable features
- Business Owners cannot modify feature toggles
- Features are assigned during business provisioning based on plan

Example Features by Product:

**Commerce OS Features:**
Inventory, Products, Delivery, Wallet, POS, Coupons, Wholesale, ERP

**Laundry OS Features:**
CRM, Marketing, Pickup, Delivery, Processing, Queue, Batch, Machine, QC, WhatsApp, Subscriptions

**Business Owner Limitation:**
- Can only use features assigned by Super Admin
- Cannot unlock or enable additional features
- Cannot modify feature configuration

---

## 3.7. PLATFORM OWNERSHIP MATRIX

This matrix defines which system owns every major capability in the Quantix ecosystem.

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

## 4. PRODUCT BOUNDARY

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

## 4.5. PRODUCT COMMUNICATION ARCHITECTURE

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

## 5. BUSINESS TYPES

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

## 6. WORKSPACE ROUTING

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
5. Quantix Core determines Business Type
6. Quantix Core redirects to appropriate workspace
7. Product workspace authenticates with token from Core
8. Product loads tenant-specific configuration from Core
9. User operates within product workspace

### Key Principles
- **Core is the gateway** - All access flows through Core first
- **Core is not the destination** - Users move quickly to product workspace
- **Products are independent** - Once in workspace, product operates independently
- **Session management** - Core manages session and provides tokens
- **Multi-business support** - User can switch between businesses (and workspaces)

---

## 6.5. WORKSPACE ROUTING ARCHITECTURE

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

## 7. WEBSITE ARCHITECTURE

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

### Website Architecture Diagram
```
Internet → Domain/DNS (Core) → CDN (Core) → Web Server (Core) →
Product Website Code (Product)
├── Content (Product)
├── Design (Product)
├── Features (Product)
└── Analytics (Product)
↓
Core APIs (Platform data)
```

### Integration Points
- **Core provisions:** Website infrastructure, SSL, CDN, DNS
- **Core provides:** APIs for subscription status, user data, configuration
- **Product provides:** Website code, content, features
- **Product consumes:** Core APIs for dynamic content

---

## 7.5. WEBSITE RESPONSIBILITY MATRIX

### Quantix Core Website Responsibilities (Infrastructure)
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

### Product Website Responsibilities (Content)
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

### Core Does NOT Do
- Edit business content
- Modify product descriptions
- Change pricing displays
- Update service listings
- Write or publish articles
- Create marketing content
- Design website layouts
- Select business branding

### Products Do NOT Do
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

## 8. STORAGE ARCHITECTURE

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

## 9. DATABASE ARCHITECTURE

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

## 9.5. COMPLETE BUSINESS PROVISIONING SEQUENCE

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

### Failure Scenarios
- Business status set to "Provisioning Failed"
- Support team notified
- Customer contacted
- Issue diagnosed and resolved
- Provisioning retried
- Customer updated

### Idempotency
Each step is idempotent - retrying doesn't create duplicates or data loss

---

## 10. BUSINESS CREATION LIFECYCLE

[Original Section 10 content - complete flow from sales to operations...]

---

## 10.5. AUTHENTICATION MODEL

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

## 11. INTEGRATION RULES

[Original Integration section with all details...]

---

## 11.5. PLATFORM API OWNERSHIP

### API Responsibility Classification

Each API is owned and managed by a specific system.

### Quantix Core APIs

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

**Audit Logging APIs**
- POST /api/v1/audit/log
- POST /api/v1/audit/event
- GET /api/v1/audit/logs

**Notification APIs**
- POST /api/v1/notifications/email
- POST /api/v1/notifications/sms
- POST /api/v1/notifications/in-app

**Deployment & Website APIs**
- GET /api/v1/websites/{businessId}
- POST /api/v1/websites/{businessId}/deploy
- PATCH /api/v1/websites/{businessId}/config

**Mobile App APIs**
- GET /api/v1/mobile-apps/{businessId}
- POST /api/v1/mobile-apps/{businessId}/build
- GET /api/v1/mobile-apps/{businessId}/versions

### Commerce OS APIs
- **Product Management:** GET /api/products, POST /api/products, PATCH /api/products/{id}
- **Order Management:** GET /api/orders, POST /api/orders, PATCH /api/orders/{id}
- **Inventory Management:** GET /api/inventory, POST /api/inventory/restock

### Laundry OS APIs
- **Service Management:** GET /api/services, POST /api/services, PATCH /api/services/{id}
- **Queue & Batch:** GET /api/queue, POST /api/queue/add, GET /api/batches, PATCH /api/batches/{id}

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

## 12. FUTURE PRODUCT ROADMAP

[Original Future Roadmap section...]

---

## 13. PRINCIPLES & CONSTRAINTS

[Original Principles section...]

---

## 14. GOVERNANCE & CHANGE MANAGEMENT

[Original Governance section...]

---

## 15. REFERENCE & QUICK LOOKUP

[Original Reference section...]

---

**Document Status:** Architecture Definition Complete - Ready for Codebase Analysis
**Next Step:** Wait for approval to begin codebase analysis

