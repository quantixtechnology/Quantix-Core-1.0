# BUSINESS WORKSPACE SPECIFICATION v1.0

**Status:** Architecture Specification  
**Date:** 2026-06-26  
**Scope:** Business module and workspace management interface  
**Baseline:** QUANTIX_CORE_MASTER_CONTEXT_v1.0.md, PRODUCT_PROVISIONING_SPEC_v1.0.md

---

## 1. PURPOSE

### What This Document Defines

The Business module in Quantix Core manages all business records and their associated workspaces. A business is the primary entity representing a customer in the Quantix ecosystem.

### Business vs. Workspace

**Business:**
- A customer organization (record in Business Registry)
- Has business type (Commerce, Laundry, CarWash)
- Has subscription (plan, pricing, features)
- Has owner and users
- Has storage allocation

**Workspace:**
- The deployed instance of a product for a specific business
- Runs on product infrastructure (commerce.quantix..., laundry.quantix...)
- Contains business operational data
- Has version, health status, deployment state
- Registered in Workspace Registry

**Relationship:** Every Business has exactly one Workspace (per Business Type)

---

## 2. BUSINESS REGISTRY

### What It Stores

The Business Registry is the authoritative record of all businesses in Quantix.

```
Business Record:
├─ Business ID (unique)
├─ Business Name
├─ Business Type (Commerce | Laundry | CarWash | Salon | etc.)
├─ Business Status (Provisioning | Active | Suspended | Archived | Failed)
├─ Owner Information
│  ├─ Owner Name
│  ├─ Owner Email
│  └─ Owner Phone
├─ Subscription Information
│  ├─ Subscription ID
│  ├─ Plan Name (Starter, Professional, Enterprise)
│  ├─ Billing Cycle
│  ├─ Monthly Price
│  ├─ Annual Price
│  └─ Renewal Date
├─ Storage
│  ├─ Allocated Quota (GB)
│  └─ Current Usage (GB)
├─ Dates
│  ├─ Created Date
│  ├─ Provisioned Date
│  ├─ Last Updated
│  └─ Archived Date (if archived)
└─ Metadata
   ├─ Lead ID (source)
   ├─ Sales Rep
   └─ Notes
```

### Business Status States

| Status | Meaning | Duration |
|--------|---------|----------|
| **Provisioning** | Being set up | 0-30 minutes |
| **Active** | Running and operational | Ongoing |
| **Suspended** | Temporarily disabled (non-payment, etc.) | Variable |
| **Archived** | Permanently inactive | Permanent |
| **Failed** | Provisioning failed | Until resolved |

### Registry Access

**Quantix Core reads/writes:** Full access (owns the registry)

**Products read:** Read-only access via API (get business info)

**Admin portal:** Full access (view, filter, search)

---

## 3. BUSINESS TYPE

### What It Determines

The Business Type field on every Business record determines:
1. Which product workspace to launch
2. Which subscription plans are available
3. Default storage quota
4. Default features and roles
5. Which APIs product uses
6. What operational workflows are available

### Supported Business Types

```
commerce           → Commerce OS (POS, Inventory, Orders)
laundry            → Laundry OS (Workflows, Processing, Quality)
carwash            → Car Wash OS (Services, Scheduling, Bay Management)
salon              → Salon OS (future)
restaurant         → Restaurant OS (future)
clinic             → Clinic OS (future)
warehouse          → Warehouse OS (future)
manufacturing      → Manufacturing OS (future)
```

### Business Type is Immutable

**Rule:** Business Type cannot be changed after creation.

**Rationale:**
- Workspace already deployed for specific product
- Changing type would require data migration
- Different products have incompatible data schemas

**Solution for Migration:** Create new business with new type, migrate data manually if needed

### Business Type Determines Everything

```
Business Type: Commerce
    ↓
Product: Commerce OS
    ↓
Available Plans: Starter, Professional, Enterprise
    ↓
Default Storage: 50 GB
    ↓
Default Roles: Store Owner, Manager, Sales Staff, etc.
    ↓
Workspace URL: commerce.quantixtechnology.in/{tenantId}
    ↓
Features: Products, Orders, Inventory, etc.
```

---

## 4. WORKSPACE REGISTRY

### What It Stores

The Workspace Registry is the operational record of every deployed product workspace.

```
Workspace Record:
├─ Workspace ID (unique)
├─ Business ID (foreign key)
├─ Business Type
├─ Workspace URL (e.g., https://commerce.quantix.../tenant-abc123)
├─ Deployment Information
│  ├─ Product Version (current running version)
│  ├─ Compatible Core Version (minimum Core version required)
│  ├─ Last Deployment Date
│  ├─ Deployment Status (Provisioning, Deploying, Running, Failed)
│  └─ Previous Version (for rollback)
├─ Health Status
│  ├─ Health State (Online, Offline, Warning, Maintenance, Failed)
│  ├─ Last Health Check
│  ├─ CPU Usage (%)
│  ├─ Memory Usage (%)
│  ├─ Request Latency (ms)
│  └─ Error Rate (%)
├─ Storage
│  ├─ Allocated Quota (GB)
│  ├─ Current Usage (GB)
│  └─ Usage Percentage
├─ Subscription
│  ├─ Plan Tier
│  ├─ Features Enabled (list)
│  └─ Feature Access Verified Date
├─ Domain & SSL
│  ├─ Domain Name
│  ├─ SSL Status (Active, Expiring, Failed)
│  └─ SSL Expiry Date
├─ Website
│  ├─ Website Status (Live, Deploying, Failed)
│  └─ Website URL
└─ Mobile App
   ├─ App Status (Configured, Building, Available)
   └─ Current Version
```

---

## 5. WORKSPACE STATUS

### Workspace Status States

Every workspace is in one of these states:

#### **Provisioning** (T+0 to T+10 min)
- Workspace being set up
- Database being created
- Storage being allocated
- Configuration being deployed
- Action: Wait, or show setup progress

#### **Deploying** (T+10 to T+25 min)
- Product code being deployed
- Database schema being initialized
- Features being configured
- Action: Wait, or show deployment progress

#### **Running** (T+25+ min)
- Workspace fully operational
- Ready to accept customer data
- Health checks passing
- Action: User can work normally

#### **Maintenance** (Variable)
- Planned maintenance happening
- Workspace temporarily unavailable
- Expected to return shortly
- Action: Show maintenance message

#### **Suspended** (Variable)
- Workspace disabled by admin
- Usually due to non-payment or policy violation
- Can be reactivated
- Action: Show "account suspended" message

#### **Failed** (Variable)
- Workspace encountered error
- Not currently operational
- Requires manual intervention
- Action: Show error, contact support

#### **Archived** (Permanent)
- Workspace no longer in use
- Data retained for compliance
- Cannot be reactivated
- Action: Show archived status

### Status Transitions

```
Provisioning → Deploying → Running → (Maintenance, Suspended, or Failed)
    ↓ (if failure)     ↓ (if failure)     ↓ (normal operation)
   Failed          Failed            Ongoing
                       ↓ (if admin)
                    Archived
```

---

## 6. WORKSPACE VERSION

### What Gets Tracked

Every workspace tracks its product version:

```
Current Version: 2.3.1
Compatible Core Version: 1.5.0 (minimum)
Compatible Core Version: 1.9.9 (maximum)
Last Upgrade Date: 2026-06-20
Last Upgrade Time: 14:35 UTC
Deployed By: Admin "deployment-bot"
Previous Version: 2.3.0
Can Rollback To: 2.3.0 (yes)
Rollback Deadline: 2026-06-27 (7 days)
```

### Version Semantics

**Product Versions:** Defined by product team
- Commerce 2.3.1 (major.minor.patch)
- Laundry 1.8.2
- Car Wash 1.0.0

**Core Version Compatibility:**
- Product specifies minimum Core version
- Product specifies maximum Core version
- Core validates compatibility before deploy
- Prevents incompatible combinations

### Rollback Window

**Automatic Rollback Available For:** 7 days after upgrade

**After 7 Days:** Only manual rollback available (requires support)

**Never Rollback:** To versions older than 90 days

---

## 7. STORAGE USAGE

### Storage Quota vs. Usage

**Quota:** Allocated storage (purchased with plan)
```
Commerce Starter: 50 GB quota
Commerce Professional: 250 GB quota
Laundry Starter: 30 GB quota
etc.
```

**Usage:** Actual storage consumed
```
Current usage: 12 GB
Usage percentage: 24%
```

### Storage by Folder

```
Total: 12 GB
├─ /products/          3 GB (product images)
├─ /orders/            4 GB (order documents)
├─ /invoices/          2 GB (generated reports)
├─ /documents/         2 GB (customer uploads)
└─ /backups/           1 GB (automatic backups)
```

### Storage Alerts

| Usage | Alert | Action |
|---|---|---|
| 50% | Info only | None required |
| 75% | Email warning | Optional upgrade |
| 90% | Email urgent | Recommended upgrade |
| 100% | Blocked | Upgrade required |

### Storage Upgrade

**When customer reaches quota:**
1. New uploads blocked with error
2. Owner receives urgent email
3. Owner can request quota increase
4. Admin approves new quota
5. System immediately allows new uploads

---

## 8. DEPLOYMENT STATUS

### What Gets Tracked

```
Current Deployment:
├─ Status: Running
├─ Product Version: 2.3.1
├─ Started At: 2026-06-20 14:35 UTC
├─ Completed At: 2026-06-20 14:40 UTC
├─ Duration: 5 minutes
└─ Deployed By: Admin user

Last Deployment:
├─ Status: Success
├─ Product Version: 2.3.0
├─ Completed At: 2026-06-15 10:20 UTC
└─ Can Rollback: Yes

Previous Deployments: (history)
├─ 2.2.9 (Success, 2026-06-10)
├─ 2.2.8 (Success, 2026-06-05)
└─ ... (older deployments)
```

### Deployment Triggers

Who can trigger deployments:
- **Automatic:** Product team (via deployment API)
- **Manual:** Admin user (via dashboard)
- **Rollback:** Admin user (manual trigger)

### Deployment Notifications

**Before Deployment:**
- Email to business owner: "Upgrade scheduled"
- Email to support team

**During Deployment:**
- Workspace marked as "Deploying"
- User sees "maintenance mode" message

**After Deployment:**
- Success: Workspace marked "Running"
- Failure: Workspace marked "Failed", rollback triggered
- Owner notified of result

---

## 9. SUBSCRIPTION

### Subscription Information on Workspace

```
Subscription:
├─ Plan Name: Professional
├─ Tier: professional
├─ Monthly Price: ₹4,999
├─ Annual Price: ₹49,999
├─ Billing Cycle: Monthly
├─ Renewal Date: 2026-07-26
├─ Status: Active
├─ Features Enabled:
│  ├─ Multi-store support
│  ├─ Advanced analytics
│  ├─ API access
│  ├─ Priority support
│  └─ ... (20 features)
└─ Storage Allocated: 250 GB
```

### Feature Access Control

**Core validates feature access:**
```
Feature: "API Access"
  ├─ Starter Plan: No
  ├─ Professional Plan: Yes
  └─ Enterprise Plan: Yes

Feature: "Advanced Analytics"
  ├─ Starter Plan: No
  ├─ Professional Plan: Yes
  └─ Enterprise Plan: Yes
```

**Product checks:** "Can this user use API?" → Core API

**Core responds:** "Yes (Professional plan includes it)" or "No (Starter plan doesn't)"

---

## 10. WEBSITE STATUS

### Website Deployment Status

```
Website:
├─ Status: Live
├─ URL: https://business-name.quantixtechnology.in
├─ Domain: business-name.quantixtechnology.in
├─ SSL Status: Active
├─ SSL Expiry: 2027-06-26
├─ Last Deployed: 2026-06-15
├─ Deployment Status: Success
└─ Health:
   ├─ Uptime: 99.9%
   ├─ Last Health Check: 2 minutes ago
   └─ Status: Online
```

### Website Features

**Core provisions:**
- Domain and DNS
- SSL certificate
- Web server
- CDN

**Product controls:**
- Website content
- Website design
- Website features
- Website analytics

---

## 11. OPEN WORKSPACE

### Workspace Launch Flow (Detailed)

**Step 1: User Clicks "Open Workspace"**
```
User sees button on Business card or Business Details page
Button is labeled: "Open Workspace"
Button is disabled if: Status = Provisioning, Failed, Suspended, or Archived
```

**Step 2: Core Prepares Launch**
```
Read Business record:
  ├─ Business Type: "commerce"
  ├─ Business Status: "Active"
  └─ Subscription Status: "Active"

Read Workspace Registry:
  ├─ Workspace URL: "https://commerce.quantix.../tenant-abc123"
  └─ Health Status: "Online"

Generate JWT Token:
  ├─ userId: <user-id>
  ├─ businessId: <business-id>
  ├─ role: <user-role>
  ├─ permissions: [list of permissions]
  ├─ expiresIn: 8 hours
  └─ signature: <HMAC-signed>
```

**Step 3: Core Routes to Product**
```
Determine destination:
  IF business_type = "commerce":
    destination = "commerce.quantixtechnology.in"
  ELSE IF business_type = "laundry":
    destination = "laundry.quantixtechnology.in"
  ELSE IF business_type = "carwash":
    destination = "carwash.quantixtechnology.in"

Redirect user:
  GET destination/?jwt=<token>&tenantId=<tenant-id>
```

**Step 4: Product Validates Token**
```
Product workspace receives request
Product validates JWT with Core:
  POST /api/v1/auth/validate-token
  {token: <jwt>}

Core responds:
  {
    valid: true,
    userId: <user-id>,
    role: <user-role>,
    permissions: [...]
  }

Product allows access if valid
```

**Step 5: Product Loads Configuration**
```
Product requests configuration from Core:
  GET /api/v1/config/business/<business-id>

Core responds:
  {
    businessName: "Ray's Store",
    businessType: "commerce",
    subscription: {...},
    features: [...],
    storage: {...}
  }

Product loads configuration into session
```

**Step 6: Product Renders Dashboard**
```
Product displays workspace dashboard
User can now operate the business
```

### Button Visibility Logic

**"Open Workspace" button is shown when:**
- ✅ Business Status = Active
- ✅ Subscription Status = Active
- ✅ Workspace Status = Running
- ✅ User has permission to access workspace

**Button is disabled when:**
- ❌ Business Status = Provisioning (wait for setup)
- ❌ Business Status = Suspended (contact support)
- ❌ Business Status = Failed (contact support)
- ❌ Business Status = Archived (no longer available)
- ❌ Workspace Status = Deploying (wait for deployment)
- ❌ Workspace Status = Failed (contact support)
- ❌ User doesn't have workspace access

### Error Handling During Launch

**If workspace is offline:**
```
Show error: "Workspace is temporarily unavailable. Please try again."
Show retry button
Log incident for support team
```

**If token validation fails:**
```
Show error: "Authentication failed. Please log in again."
Redirect to login
```

**If configuration loading fails:**
```
Show error: "Could not load workspace configuration."
Retry automatically
Show support contact info
```

---

## BUSINESS MANAGEMENT GRID

### Purpose: Platform Management View

The Business Management grid is **Super Admin's control panel** for managing platform infrastructure and business provisioning.

- Shows subscription status, workspace health, deployment versions, storage allocation
- Does NOT show operational business data (orders, products, customers, services, workflows)
- Super Admin uses this to manage infrastructure, subscriptions, and platform operations
- Business Owners do NOT see this grid; they only see their individual workspace

### What the Grid Shows

The Business Management grid displays all businesses and their key status information:

```
┌─────────────────┬──────────┬────────┬─────────────┬────────┬─────────┬─────────┬──────────┬────────────────┐
│ Business Name   │ Type     │ Plan   │ Subscription│Version │ Status  │ Storage │ Health   │ Open Workspace │
├─────────────────┼──────────┼────────┼─────────────┼────────┼─────────┼─────────┼──────────┼────────────────┤
│ Ray's Store     │ Commerce │ Prof   │ Active      │ 2.3.1  │ Running │ 120/250 │ 🟢 Good  │ [Open]         │
│ Raj's Laundry   │ Laundry  │ Start  │ Active      │ 1.8.2  │ Running │ 15/30   │ 🟢 Good  │ [Open]         │
│ Demo Business   │ Commerce │ Prof   │ Suspended   │ 2.3.0  │ Suspended│ 80/250 │ ⚫ N/A   │ [Disabled]     │
│ Test Co.        │ Laundry  │ Ent    │ Active      │ 1.8.2  │ Deploying│ 25/500 │ 🟡 Deploy│ [Disabled]     │
│ Archived Biz    │ Commerce │ Start  │ Active      │ 2.1.0  │ Archived│ 45/50  │ ⚫ N/A   │ [Disabled]     │
└─────────────────┴──────────┴────────┴─────────────┴────────┴─────────┴─────────┴──────────┴────────────────┘
```

### Column Definitions

| Column | Shows | Updates | Admin Can Edit |
|--------|-------|---------|---|
| **Business Name** | Name from Business record | Static | No |
| **Type** | Business Type (Commerce, Laundry, etc.) | Static | No |
| **Plan** | Current subscription plan (Starter, Professional, Enterprise) | On renewal | No (through subscription) |
| **Subscription** | Subscription status (Active, Suspended, Expired) | Real-time | Yes (suspend/unsuspend) |
| **Version** | Current product version (2.3.1) | On deployment | No (automatic) |
| **Status** | Workspace status (Running, Provisioning, Failed, etc.) | Real-time | Yes (resume/suspend) |
| **Storage** | Used/Allocated (120/250 GB) | Real-time | Yes (increase quota) |
| **Health** | 🟢 Good, 🟡 Warning, 🔴 Critical | Real-time | No (automatic) |
| **Open Workspace** | Button or disabled state | Real-time | No (automatic) |

### Grid Features

**Sorting:**
- Business Name (A-Z)
- Business Type (Commerce, Laundry, etc.)
- Status (Running, Suspended, Failed)
- Storage Used (ascending/descending)

**Filtering:**
- By Business Type
- By Status
- By Subscription Status
- By Health Status

**Actions:**
- Click business row → Business Details
- Open Workspace button → Launch product workspace
- Suspend business (admin) → Block access
- Upgrade plan (customer) → Increase features/storage

---

## BUSINESS DETAILS PAGE

### Purpose: Platform Management Only

**The Business Details page is a PLATFORM MANAGEMENT screen, not a business operational screen.**

- **Super Admin View:** Manages platform infrastructure, subscriptions, and workspace deployment
- **Business Owner View:** Can view their subscription and workspace status, but cannot modify platform settings
- **Operational Data:** Is NOT shown here. Orders, Products, Inventory, Customers, Workflows all belong inside the Product workspace

**Rule:** If a Business Owner would not manage it on a daily basis, it does NOT belong on this page.

### Page Structure

The Business Details page shows complete information about a single business:

```
┌─ Business Details ───────────────────────────────────────┐
│                                                           │
│  [Business Name]                                          │
│  Status: Active | Type: Commerce | ID: biz-abc123       │
│  [Edit] [Suspend] [Archive] [More Actions]              │
│                                                           │
├─ Business Information ───────────────────────────────────┤
│  • Owner: John Smith (john@example.com)                  │
│  • Phone: +91-98765-43210                               │
│  • Address: 123 Main St, Bangalore                      │
│  • Created: June 1, 2026                                │
│  • Storage Allocated: June 1, 2026                      │
│                                                           │
├─ Subscription ───────────────────────────────────────────┤
│  • Plan: Professional                                    │
│  • Price: ₹4,999/month                                  │
│  • Renewal Date: July 26, 2026                          │
│  • Features: (20 features listed)                       │
│  • Storage: 250 GB                                      │
│  [Upgrade Plan] [Change Billing Cycle]                 │
│                                                           │
├─ Workspace ──────────────────────────────────────────────┤
│  • Status: Running                                       │
│  • Version: 2.3.1 (Compatible with Core 1.5.0+)        │
│  • Last Deployment: June 20, 2026 @ 14:35 UTC          │
│  • Website: Live at https://raystore.in                │
│  • Mobile App: Available (v2.3.1)                       │
│  [Open Workspace] [View Deployment History]            │
│                                                           │
├─ Storage ───────────────────────────────────────────────┤
│  • Allocated: 250 GB                                    │
│  • Used: 120 GB (48%)                                   │
│  • By Folder:                                           │
│    - /products: 45 GB (products images)                │
│    - /orders: 50 GB (order documents)                  │
│    - /invoices: 20 GB (reports)                        │
│    - /media: 5 GB (user uploads)                       │
│  [Increase Quota] [View Storage Report]                │
│                                                           │
├─ Deployment ─────────────────────────────────────────────┤
│  • Current Version: 2.3.1                               │
│  • Status: Running                                       │
│  • Rollback Available: Yes (until June 27)             │
│  • Health: 🟢 Good                                       │
│  • CPU: 45% | Memory: 62% | Latency: 125ms            │
│  [View Full Health Report] [Rollback]                   │
│                                                           │
├─ Website ───────────────────────────────────────────────┤
│  • Domain: raystore.in                                  │
│  • Status: Live                                          │
│  • SSL: Active (expires June 26, 2027)                 │
│  • Website URL: https://raystore.in                    │
│  • Last Deployed: June 15, 2026                        │
│  [Visit Website] [Manage Website Content]              │
│                                                           │
├─ Audit ──────────────────────────────────────────────────┤
│  Recent Actions:                                         │
│  • June 20, 14:35 - Deployment completed (v2.3.1)     │
│  • June 15, 10:20 - Website updated                    │
│  • June 10, 09:15 - Plan upgraded to Professional     │
│  [View Full Audit Log]                                  │
│                                                           │
├─ Recent Activity ────────────────────────────────────────┤
│  • 25 active users this month                           │
│  • 1,250 orders processed this month                    │
│  • 50 GB storage used this month                        │
│  • 0 errors or warnings                                 │
│  [View Detailed Analytics]                              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Key Principle: Platform Only

**What's shown:**
- ✅ Business information (owner, subscription, storage)
- ✅ Workspace status (version, health, deployment)
- ✅ Website infrastructure (domain, SSL, uptime)
- ✅ Subscription and billing
- ✅ Audit trail and activity

**What's NOT shown:**
- ❌ Orders (belongs in product workspace)
- ❌ Products (belongs in product workspace)
- ❌ Inventory (belongs in product workspace)
- ❌ Customer data (belongs in product workspace)
- ❌ Laundry workflows (belongs in product workspace)
- ❌ Any business operations (all in product workspace)

**Core manages platform. Products manage operations.**

---

## SECTION SUMMARY

| Section | Owner | Purpose |
|---------|-------|---------|
| Business Information | Core | Owner contact, dates, metadata |
| Subscription | Core | Plans, features, pricing, renewal |
| Workspace | Core | Status, version, deployment, health |
| Storage | Core | Quota, usage, alerts, upgrades |
| Deployment | Core | Version history, rollback, status |
| Website | Core | Domain, SSL, uptime, deployment |
| Audit | Core | Compliance, change tracking |
| Recent Activity | Core | High-level metrics (no operations) |

---

## CONCLUSION

The Business Workspace Specification defines:

✅ **What Core manages:** Business records, workspaces, provisioning, subscriptions, storage
✅ **What Products manage:** Business operational data, workflows, features
✅ **How users access products:** Via intelligent workspace routing
✅ **How admins manage businesses:** Through Business Management grid and Details page
✅ **How status is tracked:** Real-time monitoring of workspace health and deployment

**The Business module is purely a provisioning and status interface. All operations happen in product workspaces.**

---

**Document Status:** Complete - Architecture Specification Ready

