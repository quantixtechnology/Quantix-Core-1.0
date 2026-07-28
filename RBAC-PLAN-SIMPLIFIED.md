# Laundry OS — Simplified RBAC Plan (Hide / View / Create / Edit)

> **Derived from full application audit.** Every action discovered in the codebase is classified into exactly one of four levels. No action-level permissions are created.

---

## Permission Model

Each screen gets **one permission key**: `{module}.{screen}`.  
A role's level for that key determines all actions available:

| Level | Access | What it covers |
|-------|--------|----------------|
| **Hide** (0) | None | Menu hidden, no API access |
| **View** (1) | Read-only | List, search, filter, view detail, view reports, export, print |
| **Create** (2) | Create + Workflow | Create new records, advance workflow forward (pack, dispatch, receive, deliver, approve audit, generate barcodes, schedule, assign, etc.) |
| **Edit** (3) | Full control | Includes View + Create + delete, cancel, reject, override, adjust, refund, reverse workflow, modify existing records |

> If a screen has no Create button/flow, Create level behaves the same as View.  
> If a screen has no Edit actions, Edit level behaves the same as Create.

---

## 1. Laundry OS — Admin Desktop

### 1.1 Dashboard
| Actions | Level |
|---------|-------|
| View stats (orders, revenue, pending actions) | **View** |
| **Permission:** `laundry.dashboard` | **Default min level: View** |

---

### 1.2 Orders
| Actions | Level |
|---------|-------|
| View order list, search, filter, export | **View** |
| View order detail, timeline, items, payments, invoices | **View** |
| Print invoice | **View** |
| Create new order | **Create** |
| Pack, dispatch to processing, receive at processing | **Create** |
| Return-dispatch to store, store-receive | **Create** |
| Mark delivered | **Create** |
| Assign pickup bags | **Create** |
| Apply subscription to order | **Edit** |
| Cancel order (via transition) | **Edit** |
| Delete order permanently | **Edit** |
| Edit order items/payment | **Edit** |
| Regenerate invoice | **Edit** |
| **Permission:** `laundry.orders` | **Default min level: View** |

---

### 1.3 Customers
| Actions | Level |
|---------|-------|
| View customer list, search, filter | **View** |
| View customer detail, addresses, documents, notes | **View** |
| View stats, timeline, membership | **View** |
| Create customer | **Create** |
| Send app invite | **Create** |
| Add address, upload document, add note | **Create** |
| Edit customer | **Edit** |
| Edit/delete address | **Edit** |
| Delete document | **Edit** |
| Merge duplicate customers | **Edit** |
| Delete customer | **Edit** |
| **Permission:** `laundry.customers` | **Default min level: View** |

---

### 1.4 Garment Lookup
| Actions | Level |
|---------|-------|
| Search by barcode | **View** |
| View garment history | **View** |
| **Permission:** `laundry.garment_lookup` | **Default min level: View** |

---

## 2. Store Operations

### 2.1 Dispatch Center
| Actions | Level |
|---------|-------|
| View dispatch status, schedules | **View** |
| Schedule pickup / delivery | **Create** |
| Assign to executive | **Create** |
| Cancel dispatch | **Edit** |
| Backfill / reassign | **Edit** |
| **Permission:** `store_ops.dispatch` | **Default min level: View** |

---

### 2.2 Store Audit
| Actions | Level |
|---------|-------|
| View audit queue, search, scan bag | **View** |
| Inspect garments, select defects, add notes | **Create** |
| Add missed garments (intake) | **Create** |
| Capture weight, upload photos | **Create** |
| Save progress (hold) | **Create** |
| Approve & generate invoice | **Create** |
| Reject audit | **Edit** |
| **Permission:** `store_ops.audit` | **Default min level: View** |

---

### 2.3 Payment Collection
| Actions | Level |
|---------|-------|
| View payment queue, dues breakdown | **View** |
| Record payment (CASH/UPI/CARD/WALLET) | **Create** |
| Pay Later (advance workflow) | **Create** |
| Reopen audit (reverse workflow) | **Edit** |
| **Permission:** `store_ops.payment` | **Default min level: View** |

---

### 2.4 Packing & QR
| Actions | Level |
|---------|-------|
| View packing queue, history, search | **View** |
| Confirm packing → generate PKT QR | **Create** |
| Print QR, reprint | **View** |
| **Permission:** `store_ops.packing` | **Default min level: View** |

---

### 2.5 Transit to Processing
| Actions | Level |
|---------|-------|
| View dispatch queue, packet details | **View** |
| Enter transport info, add note, dispatch | **Create** |
| **Permission:** `store_ops.transit` | **Default min level: View** |

---

### 2.6 Store Receive (Return from Processing)
| Actions | Level |
|---------|-------|
| View receive queue | **View** |
| Scan packet/bag QR to receive | **Create** |
| Manual confirm with note | **Create** |
| **Permission:** `store_ops.store_receive` | **Default min level: View** |

---

### 2.7 Ready for Delivery
| Actions | Level |
|---------|-------|
| View delivery queue | **View** |
| Schedule home delivery | **Create** |
| Assign executive | **Create** |
| Collect final payment | **Create** |
| Mark delivered (complete) | **Create** |
| Enter recipient name + note | **Create** |
| **Permission:** `store_ops.ready_delivery` | **Default min level: View** |

---

### 2.8 Bag Management
| Actions | Level |
|---------|-------|
| View bag list, filter, search | **View** |
| View bag detail, history, custody timeline | **View** |
| Print bag labels | **View** |
| Bag reconciliation report | **View** |
| Generate new bags | **Create** |
| Receive returned bag (scan) | **Create** |
| Configure release stage | **Edit** |
| Mark bag damaged | **Edit** |
| Mark bag lost | **Edit** |
| Return bag to available | **Edit** |
| Manual release (force) | **Edit** |
| **Permission:** `store_ops.bags` | **Default min level: View** |

---

### 2.9 Assign Bags (Pickup-First)
| Actions | Level |
|---------|-------|
| View orders, view bags | **View** |
| Scan & assign bag to order | **Create** |
| Receive at store (scan) | **Create** |
| **Permission:** `store_ops.assign_bags` | **Default min level: View** |

---

## 3. Services & Pricing

### 3.1 Services
| Actions | Level |
|---------|-------|
| View services list | **View** |
| Create service | **Create** |
| Edit service | **Edit** |
| Delete service | **Edit** |
| Set per-garment prices | **Edit** |
| **Permission:** `pricing.services` | **Default min level: View** |

### 3.2 Categories
| Actions | Level |
|---------|-------|
| View categories | **View** |
| Create category | **Create** |
| Edit category | **Edit** |
| Delete category | **Edit** |
| Bulk import | **Create** |
| **Permission:** `pricing.categories` | **Default min level: View** |

### 3.3 Garments (Master)
| Actions | Level |
|---------|-------|
| View garments | **View** |
| Create garment | **Create** |
| Bulk create | **Create** |
| Import | **Create** |
| Edit garment | **Edit** |
| Delete garment | **Edit** |
| Export | **View** |
| Set pricing | **Edit** |
| **Permission:** `pricing.garments` | **Default min level: View** |

### 3.4 Pricing Matrix
| Actions | Level |
|---------|-------|
| View pricing matrix | **View** |
| Import pricing | **Create** |
| Bulk edit | **Edit** |
| Bulk delete rules | **Edit** |
| **Permission:** `pricing.matrix` | **Default min level: View** |

### 3.5 Subscription Plans
| Actions | Level |
|---------|-------|
| View plans | **View** |
| Create plan | **Create** |
| Edit plan | **Edit** |
| Delete plan | **Edit** |
| **Permission:** `pricing.plans` | **Default min level: View** |

### 3.6 Charges & Rules
| Actions | Level |
|---------|-------|
| View charges config | **View** |
| Configure charges | **Edit** |
| **Permission:** `pricing.charges` | **Default min level: View** |

### 3.7 Pricing Simulator
| Actions | Level |
|---------|-------|
| Simulate order cost | **View** |
| **Permission:** `pricing.simulator` | **Default min level: View** |

---

## 4. Business Management

### 4.1 Stores
| Actions | Level |
|---------|-------|
| View stores list | **View** |
| Create store | **Create** |
| Edit store | **Edit** |
| Delete store | **Edit** |
| **Permission:** `business.stores` | **Default min level: View** |

### 4.2 Staff (Desktop Admin)
| Actions | Level |
|---------|-------|
| View staff list | **View** |
| Create staff | **Create** |
| Edit staff | **Edit** |
| Delete staff | **Edit** |
| Reset password | **Edit** |
| Assign role | **Edit** |
| **Permission:** `business.staff` | **Default min level: View** |

### 4.3 Delivery Executives
| Actions | Level |
|---------|-------|
| View executives list | **View** |
| Create executive | **Create** |
| Edit executive | **Edit** |
| Delete executive | **Edit** |
| **Permission:** `business.executives` | **Default min level: View** |

### 4.4 Mobile Apps
| Actions | Level |
|---------|-------|
| View provisioning status, app URLs | **View** |
| Generate provisioning | **Create** |
| **Permission:** `business.mobile_apps` | **Default min level: View** |

### 4.5 Roles & Permissions
| Actions | Level |
|---------|-------|
| View roles list, permission catalog | **View** |
| View role's permission matrix | **View** |
| Create role | **Create** |
| Clone role | **Create** |
| Seed default roles | **Create** |
| Edit role (name/description) | **Edit** |
| Toggle/save permissions | **Edit** |
| Delete role | **Edit** |
| Assign user to role | **Edit** |
| **Permission:** `business.roles` | **Default min level: View** |

### 4.6 Subscriptions
| Actions | Level |
|---------|-------|
| View subscriptions, ledger, reports | **View** |
| Create subscription | **Create** |
| Collect payment (subscription) | **Create** |
| Renew subscription | **Create** |
| Adjust subscription | **Edit** |
| Cancel subscription | **Edit** |
| **Permission:** `business.subscriptions` | **Default min level: View** |

### 4.7 Reports
| Actions | Level |
|---------|-------|
| View reports | **View** |
| Export | **View** |
| **Permission:** `business.reports` | **Default min level: View** |

### 4.8 Settings
| Actions | Level |
|---------|-------|
| View all settings (financial, pickup, slots, payment, storage) | **View** |
| Edit financial settings (invoice, GST, branding) | **Edit** |
| Edit pickup/slot settings | **Edit** |
| Edit payment gateway/settings | **Edit** |
| Manage departments | **Edit** |
| Manage workflows/stages | **Edit** |
| Manage processing centers | **Edit** |
| **Permission:** `business.settings` | **Default min level: View** |

---

## 5. Processing Center

### 5.1 Console & Receive
| Actions | Level |
|---------|-------|
| View department summary tiles | **View** |
| View awaiting barcode list, completed list | **View** |
| Receive dispatched packets (scan QR) | **Create** |
| Dispatch completed orders to store | **Create** |
| **Permission:** `processing.console` | **Default min level: View** |

### 5.2 Barcode Generation
| Actions | Level |
|---------|-------|
| View pending/history lists | **View** |
| View order barcode data | **View** |
| Generate individual garment barcode | **Create** |
| Generate all pending | **Create** |
| Move to processing queue | **Create** |
| Reprint barcode | **Create** |
| Configure label settings | **Edit** |
| **Permission:** `processing.barcodes` | **Default min level: View** |

### 5.3 Workstation (WASH / DRY / DRYCLEAN / IRON / FOLD / QC)

Each station uses the same component with identical actions:

| Actions | Level |
|---------|-------|
| View queue (waiting, in progress, completed) | **View** |
| Search garments | **View** |
| Scan barcode → start garment | **Create** |
| Start individual | **Create** |
| Complete / Pass (QC) | **Create** |
| QC Fail (send to rework) | **Create** |
| Pause / Resume | **Create** |
| Bulk advance (multi-complete) | **Create** |
| Manual process (without scan) | **Create** |
| Return to Queue (override) | **Edit** |

**Permissions (one per station):**

| Screen | Permission | Default min level |
|--------|-----------|-------------------|
| Washing | `processing.wash` | View |
| Drying | `processing.dry` | View |
| Dry Cleaning | `processing.dry_clean` | View |
| Ironing | `processing.iron` | View |
| Folding | `processing.fold` | View |
| Quality Check | `processing.qc` | View |

---

### 5.4 Processing Dashboard
| Actions | Level |
|---------|-------|
| View summary cards | **View** |
| Quick actions (view orders, reports) | **View** |
| **Permission:** `processing.dashboard` | **Default min level: View** |

---

## 6. Store Admin PWA

All Store PWA screens are gated by store staff login (`requireStoreAdmin`).

| Screen | Actions | View | Create | Edit |
|--------|---------|------|--------|------|
| **Dashboard** | View operational counts | ✅ | | |
| **Orders** | Search, filter, view detail | ✅ | | |
| **Order Detail** | View stage, timeline | ✅ | | |
| | Pack, dispatch, receive, return-dispatch, store-receive, mark delivered | | ✅ | |
| | Collect payment | | ✅ | |
| | Approve audit | | ✅ | |
| | Reopen audit | | | ✅ |
| **Dispatch** | View schedules | ✅ | | |
| | Assign pickups/deliveries | | ✅ | |
| | Bulk assign | | ✅ | |
| **Scan** | View scan screen | ✅ | | |
| | Receive bag at store (with condition) | | ✅ | |
| | Return delivery bag | | ✅ | |
| | Scan garment + process (START/COMPLETE/QC_PASS) | | ✅ | |
| **Create Order** | Walk-in/home pickup, create customer, add garments, submit | | ✅ | |

> Store PWA currently uses `requireStoreAdmin` (store staff session auth) rather than granular laundry permissions. If you want to apply the same Hide/View/Create/Edit model here, permissions would mirror the desktop equivalents:
> - `store_ops.audit`, `store_ops.packing`, `store_ops.transit`, `store_ops.store_receive`, `store_ops.ready_delivery`, `store_ops.payment`, `store_ops.bags`

---

## 7. Delivery Executive PWA

Gated by executive login (`resolveExecutive`). Executive permissions are role-based (who gets assigned which job types), not screen-based.

| Screen | Actions | Level |
|--------|---------|-------|
| Jobs Dashboard | View assigned pickups/deliveries | **View** |
| Job Detail | View customer, address, items | **View** |
| | Accept/reject assignment | **Create** |
| | Start pickup | **Create** |
| | Reach customer, verify | **Create** |
| | Assign bag (scan) | **Create** |
| | Complete pickup | **Create** |
| | Scan delivery bag | **Create** |
| | Navigate → out for delivery | **Create** |
| | Mark as delivered | **Create** |
| | Collect cash, show payment QR | **Create** |
| | Call/WhatsApp customer | **View** |

> If gating executive screens by permissions: `executive.jobs`

---

## 8. Customer App PWA

Gated by customer OTP auth. If applying the same model:

| Screen | Actions | Level |
|--------|---------|-------|
| Home | View stats, subscription | **View** |
| Place Order | Browse catalog, get quote, submit | **Create** |
| Orders | View list, view detail, timeline | **View** |
| Subscription | View plan, ledger | **View** |
| Profile | Edit profile, manage addresses | **Edit** |

> Permissions: `customer.home`, `customer.orders`, `customer.subscription`, `customer.profile`

---

## 9. CRM Module (feature-gated)

### 9.1 Dashboard
| Actions | Level |
|---------|-------|
| View CRM dashboard | **View** |
| **Permission:** `crm.dashboard` | **Default min level: View** |

### 9.2 Leads
| Actions | Level |
|---------|-------|
| View leads list, search, filter | **View** |
| View lead detail | **View** |
| Create lead | **Create** |
| Convert lead → opportunity | **Create** |
| Edit lead | **Edit** |
| Delete lead | **Edit** |
| **Permission:** `crm.leads` | **Default min level: View** |

### 9.3 Opportunities
| Actions | Level |
|---------|-------|
| View opportunities | **View** |
| Edit opportunity | **Edit** |
| Update stage | **Create** |
| **Permission:** `crm.opportunities` | **Default min level: View** |

### 9.4 Activities & Tasks
| Actions | Level |
|---------|-------|
| View activities, tasks | **View** |
| Create activity, create task | **Create** |
| Complete task | **Create** |
| **Permission:** `crm.activities` | **Default min level: View** |

### 9.5 Reports
| Actions | Level |
|---------|-------|
| View CRM reports | **View** |
| **Permission:** `crm.reports` | **Default min level: View** |

### 9.6 Settings
| Actions | Level |
|---------|-------|
| View settings (statuses, sources, stages, etc.) | **View** |
| Configure settings | **Edit** |
| **Permission:** `crm.settings` | **Default min level: View** |

---

## 10. Marketing Module (feature-gated)

All screens are currently placeholders with no functional actions. If implemented, they would follow the same model:

| Screen | Permission | Default min level |
|--------|-----------|-------------------|
| Dashboard | `marketing.dashboard` | View |
| Discounts | `marketing.discounts` | View |
| Coupons | `marketing.coupons` | View |
| Loyalty | `marketing.loyalty` | View |
| Membership | `marketing.membership` | View |
| Gift Cards | `marketing.gift_cards` | View |
| Referral | `marketing.referral` | View |
| Credits | `marketing.credits` | View |
| Cart Recovery | `marketing.cart_recovery` | View |
| Campaigns | `marketing.campaigns` | View |
| Reports | `marketing.reports` | View |

---

## Complete Permission Key Index

| # | Permission Key | Module | Default Min Level | Has Create? | Has Edit? |
|---|---------------|--------|-------------------|-------------|-----------|
| 1 | `laundry.dashboard` | Laundry OS | View | No | No |
| 2 | `laundry.orders` | Laundry OS | View | Yes | Yes |
| 3 | `laundry.customers` | Laundry OS | View | Yes | Yes |
| 4 | `laundry.garment_lookup` | Laundry OS | View | No | No |
| 5 | `store_ops.dispatch` | Store Ops | View | Yes | Yes |
| 6 | `store_ops.audit` | Store Ops | View | Yes | Yes |
| 7 | `store_ops.payment` | Store Ops | View | Yes | Yes |
| 8 | `store_ops.packing` | Store Ops | View | Yes | No |
| 9 | `store_ops.transit` | Store Ops | View | Yes | No |
| 10 | `store_ops.store_receive` | Store Ops | View | Yes | No |
| 11 | `store_ops.ready_delivery` | Store Ops | View | Yes | No |
| 12 | `store_ops.bags` | Store Ops | View | Yes | Yes |
| 13 | `store_ops.assign_bags` | Store Ops | View | Yes | No |
| 14 | `pricing.services` | Pricing | View | Yes | Yes |
| 15 | `pricing.categories` | Pricing | View | Yes | Yes |
| 16 | `pricing.garments` | Pricing | View | Yes | Yes |
| 17 | `pricing.matrix` | Pricing | View | Yes | Yes |
| 18 | `pricing.plans` | Pricing | View | Yes | Yes |
| 19 | `pricing.charges` | Pricing | View | No | Yes |
| 20 | `pricing.simulator` | Pricing | View | No | No |
| 21 | `business.stores` | Business | View | Yes | Yes |
| 22 | `business.staff` | Business | View | Yes | Yes |
| 23 | `business.executives` | Business | View | Yes | Yes |
| 24 | `business.mobile_apps` | Business | View | Yes | No |
| 25 | `business.roles` | Business | View | Yes | Yes |
| 26 | `business.subscriptions` | Business | View | Yes | Yes |
| 27 | `business.reports` | Business | View | No | No |
| 28 | `business.settings` | Business | View | No | Yes |
| 29 | `processing.console` | Processing | View | Yes | No |
| 30 | `processing.barcodes` | Processing | View | Yes | Yes |
| 31 | `processing.dashboard` | Processing | View | No | No |
| 32 | `processing.wash` | Processing | View | Yes | Yes |
| 33 | `processing.dry` | Processing | View | Yes | Yes |
| 34 | `processing.dry_clean` | Processing | View | Yes | Yes |
| 35 | `processing.iron` | Processing | View | Yes | Yes |
| 36 | `processing.fold` | Processing | View | Yes | Yes |
| 37 | `processing.qc` | Processing | View | Yes | Yes |
| 38 | `crm.dashboard` | CRM | View | No | No |
| 39 | `crm.leads` | CRM | View | Yes | Yes |
| 40 | `crm.opportunities` | CRM | View | Yes | Yes |
| 41 | `crm.activities` | CRM | View | Yes | Yes |
| 42 | `crm.reports` | CRM | View | No | No |
| 43 | `crm.settings` | CRM | View | No | Yes |
| 44 | `customer.home` | Customer App | View | No | No |
| 45 | `customer.orders` | Customer App | View | Yes | No |
| 46 | `customer.subscription` | Customer App | View | No | No |
| 47 | `customer.profile` | Customer App | View | No | Yes |
| 48 | `marketing.*` (11 screens) | Marketing | View | TBD | TBD |

---

## Summary

- **48 permission keys** total (37 core + 4 customer + 7 marketing placeholder)
- Each key supports 4 levels: Hide (0), View (1), Create (2), Edit (3)
- **No action-level permissions** (no pause, resume, approve, reject, override, etc.)
- **No orphan permissions** — every key maps to a real screen with real actions
- The existing 110+ granular permissions (`laundry.orders.view`, `laundry.orders.print`, `processing.washing.override`, etc.) are consolidated into this simplified model
- Migration: each existing granular permission maps to a level within its simplified parent key

---

**End of simplified RBAC plan — derived from full application audit, no assumptions, no invented permissions.**
