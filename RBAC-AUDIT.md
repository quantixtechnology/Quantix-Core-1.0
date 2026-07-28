# Laundry OS — RBAC Discovery & Permission Matrix Audit

> **Date:** 2026-07-27
> **Scope:** Entire Laundry OS application — Admin Desktop, Store PWA, Delivery Executive PWA, Processing Center, Customer PWA
> **Method:** Codebase audit (zero assumptions, application as source of truth)

---

## Phase 1–2: Complete Module & Screen Inventory

### 1. Laundry OS Module — Admin Desktop

#### 1.1 Dashboard
| Property | Value |
|---|---|
| Route | `/` (SPA: `laundryPage=dashboard`) |
| Component | `LaundryDashboard` in `views/laundry-dashboard.tsx` |
| Sidebar label | Dashboard |
| Min rank | 1 (operator+) |
| Permission | `laundry.dashboard.view` |

**Widgets:** Order stats summary, revenue snapshot, pending actions, recent orders, quick actions bar
**API:** `GET /api/laundry/orders/stats`, `GET /api/laundry/orders`, `GET /api/laundry/processing/summary`

---

#### 1.2 New Order
| Property | Value |
|---|---|
| Route | `laundryPage=new-order` |
| Component | `LaundryNewOrder` in `views/laundry-new-order.tsx` |
| Sidebar label | New Order |
| Min rank | 1 |
| Permission | `laundry.orders.create` |

**Actions:**
- Search/create customer
- Add garment lines (service + garment + quantity)
- Schedule pickup
- Submit order
- Walk-in mode
- Home pickup mode

**API:**
- `GET /api/laundry/services`
- `GET /api/laundry/garments`
- `GET /api/laundry/customers/search`
- `POST /api/laundry/customers`
- `POST /api/laundry/orders`

---

#### 1.3 Orders (List + Detail)
| Property | Value |
|---|---|
| Route | `laundryPage=orders` |
| Component | `LaundryOrdersView` in `views/laundry-orders-view.tsx` |
| Sidebar label | Orders |
| Min rank | 2 |
| Permission | `laundry.orders.view` |

**Actions:**
- Search by order number, customer, phone
- Filter by status
- Export list
- View order detail
- Create new order (button)
- Cancel order
- Delete order (permanent)
- Apply subscription
- Print invoice

**Sub-screen:** `LaundryOrderDetail` (`laundryPage=order-detail`) in `views/laundry-order-detail.tsx`
- View timeline
- View items/garments
- View invoices (regenerate)
- View payments
- View pickup bag assignments
- View dispatch info
- Print invoice

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/orders/stats`
- `GET /api/laundry/orders/[id]`
- `GET /api/laundry/orders/[id]/invoice`
- `POST /api/laundry/orders/[id]/invoice`
- `POST /api/laundry/orders/[id]/payment`
- `GET /api/laundry/orders/[id]/payment`
- `POST /api/laundry/orders/[id]/transition`
- `POST /api/laundry/orders/[id]/permanent-delete`
- `POST /api/laundry/orders/[id]/apply-subscription`
- `GET /api/laundry/dispatch/status`
- `GET /api/laundry/orders/[id]/pickup-bags`

---

#### 1.4 Customers
| Property | Value |
|---|---|
| Route | `laundryPage=customers` |
| Component | `LaundryCustomersView` in `views/laundry-customers-view.tsx` |
| Sidebar label | Customers |
| Min rank | 2 |
| Permission | `laundry.customers.view` |

**Actions:**
- Search customers
- View customer detail
- Create customer
- Edit customer
- Merge duplicate customers
- Delete customer
- Send invite (customer app)
- View addresses
- Add/edit/delete address
- Upload/manage documents
- View notes
- View stats (total orders, revenue, etc.)
- View membership
- View timeline

**API:**
- `GET /api/laundry/customers`
- `POST /api/laundry/customers`
- `GET /api/laundry/customers/search`
- `POST /api/laundry/customers/merge`
- `GET /api/laundry/customers/[id]`
- `PUT /api/laundry/customers/[id]`
- `GET /api/laundry/customers/[id]/addresses`
- `POST /api/laundry/customers/[id]/addresses`
- `PUT /api/laundry/customers/[id]/addresses/[addressId]`
- `DELETE /api/laundry/customers/[id]/addresses/[addressId]`
- `GET /api/laundry/customers/[id]/documents`
- `POST /api/laundry/customers/[id]/documents`
- `DELETE /api/laundry/customers/[id]/documents`
- `GET /api/laundry/customers/[id]/membership`
- `GET /api/laundry/customers/[id]/notes`
- `POST /api/laundry/customers/[id]/notes`
- `GET /api/laundry/customers/[id]/stats`
- `GET /api/laundry/customers/[id]/timeline`
- `POST /api/laundry/app/invite`

---

#### 1.5 Garment Lookup
| Property | Value |
|---|---|
| Route | `laundryPage=garment-lookup` |
| Component | `LaundryGarmentLookup` in `views/laundry-garment-lookup.tsx` |
| Sidebar label | Garment Lookup |
| Min rank | 1 |
| Permission | `laundry.orders.view` |

**Actions:**
- Search by barcode
- View garment detail + processing history

**API:**
- `GET /api/laundry/scan?barcode=`

---

### 2. Store Operations (Admin Desktop)

#### 2.1 Dispatch Center
| Property | Value |
|---|---|
| Route | `laundryPage=dispatch-center` |
| Component | `LaundryDispatchCenter` in `views/laundry-dispatch-center.tsx` |
| Sidebar label | Dispatch Center |
| Min rank | 2 |
| Permission | `laundry.orders.view` |

**Actions:**
- Bulk assign pickups to executives
- Bulk assign deliveries to executives
- View acceptance status
- Schedule pickups
- Schedule deliveries
- Cancel dispatch
- Backfill (reassign)

**API:**
- `GET /api/laundry/dispatch/status`
- `POST /api/laundry/dispatch/pickup`
- `POST /api/laundry/dispatch/delivery`
- `POST /api/laundry/dispatch/cancel`
- `POST /api/laundry/dispatch/backfill`
- `GET /api/laundry/pickup-scheduler`
- `POST /api/laundry/pickup-scheduler`
- `GET /api/laundry/delivery-executives`

---

#### 2.2 Bag Management
| Property | Value |
|---|---|
| Route | `laundryPage=bag-management` |
| Component | `LaundryBagManagement` in `views/laundry-bag-management.tsx` |
| Sidebar label | Bag Management |
| Min rank | 2 |
| Permission | `store_ops.store_audit.view` |

**Actions:**
- Generate reusable BAG-NNNNNN pool
- Print bag labels
- Filter by status
- Search bags
- Mark bag DAMAGED
- Mark bag LOST
- Return bag to AVAILABLE
- **Receive Returned Bag** (scan: delivery-return + generic return)
- **Manual Release** (permission-gated)
- View bag detail + history + custody timeline
- Manage reusable bag release stage setting
- Bag reconciliation (assigned vs returned per executive)

**API:**
- `GET /api/laundry/bags`
- `POST /api/laundry/bags`
- `GET /api/laundry/bags/[id]`
- `PATCH /api/laundry/bags/[id]`
- `POST /api/laundry/bags/delivery-return`
- `POST /api/laundry/bags/return`
- `POST /api/laundry/bags/manual-release`
- `GET /api/laundry/bags/reconciliation`
- `GET /api/laundry/bag-settings`
- `PUT /api/laundry/bag-settings`
- `GET /api/laundry/rbac/me`

---

#### 2.3 Assign Bags (Pickup-First)
| Property | Value |
|---|---|
| Route | `laundryPage=pickup-bags` |
| Component | `LaundryPickupBags` in `views/laundry-pickup-bags.tsx` |
| Sidebar label | Assign Bags |
| Min rank | 1 |
| Permission | `store_ops.store_audit.view` |

**Actions:**
- Tab 1: Assign Bags — search order, scan reusable bag, assign to service
- Tab 2: Receive at Store — scan bag to mark RECEIVED_AT_STORE

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/bags`
- `POST /api/laundry/bags/assign`
- `POST /api/laundry/bags/advance`

---

#### 2.4 Store Audit
| Property | Value |
|---|---|
| Route | `laundryPage=audit-queue` |
| Component | `LaundryStoreAudit` in `views/laundry-store-audit.tsx` |
| Sidebar label | Store Audit |
| Min rank | 1 |
| Permission | `store_ops.store_audit.view` |

**Actions:**
- Queue of pending audit orders
- Search orders
- Scan bag QR to jump to audit
- Inspect each garment (condition: Good/Damaged)
- Select defects
- Add notes
- Add missed garments (intake audit)
- Capture total weight
- Upload photos
- Save progress (HOLD → UNDER_AUDIT)
- Approve & Generate Invoice (→ PAYMENT_PENDING)
- Reject audit

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/orders/[id]`
- `GET /api/laundry/bags`
- `GET /api/laundry/pickup-bags`
- `GET /api/laundry/garments`
- `GET /api/laundry/services`
- `POST /api/laundry/orders/[id]/items`
- `PUT /api/laundry/orders/[id]/inspect`
- `POST /api/laundry/orders/[id]/transition`
- `POST /api/uploads`
- `POST /api/laundry/bags/order/[id]/advance`

---

#### 2.5 Payment Collection
| Property | Value |
|---|---|
| Route | `laundryPage=payment-queue` |
| Component | `LaundryPaymentCollection` in `views/laundry-store-stages.tsx` |
| Sidebar label | Payment Collection |
| Min rank | 2 |
| Permission | `store_ops.payment_collection.view` |

**Actions:**
- Record payment (CASH, UPI, CARD, WALLET)
- Pay Later (move to packing, balance due at delivery)
- Reopen Audit (return to PENDING_STORE_AUDIT)
- View dues breakdown

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/orders/[id]/payment`
- `POST /api/laundry/orders/[id]/payment`
- `POST /api/laundry/orders/[id]/transition`

---

#### 2.6 Packing & QR
| Property | Value |
|---|---|
| Route | `laundryPage=packing-queue` |
| Component | `LaundryPacking` in `views/laundry-store-stages.tsx` |
| Sidebar label | Packing & QR |
| Min rank | 1 |
| Permission | `store_ops.packing_qr.view` |

**Actions:**
- Confirm packing → generate PKT packet QR
- Print QR label
- View packed history
- Search packed orders
- Reprint QR

**API:**
- `GET /api/laundry/orders`
- `POST /api/laundry/orders/[id]/pack`
- `GET /api/laundry/packets`

---

#### 2.7 Transit to Processing
| Property | Value |
|---|---|
| Route | `laundryPage=dispatch-queue` |
| Component | `LaundryDispatch` in `views/laundry-store-stages.tsx` |
| Sidebar label | Transit to Processing |
| Min rank | 2 |
| Permission | `store_ops.transit.view` |

**Actions:**
- View packet details
- Enter transport/runner info
- Add dispatch note
- Dispatch to processing center

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/packets`
- `POST /api/laundry/orders/[id]/dispatch`

---

#### 2.8 Store Receive (Return from Processing)
| Property | Value |
|---|---|
| Route | `laundryPage=store-receive-queue` |
| Component | `LaundryStoreReceive` in `views/laundry-store-stages.tsx` |
| Sidebar label | Store Receive |
| Min rank | 2 |
| Permission | `store_ops.store_receive.view` |

**Actions:**
- Scan packet QR to receive
- Scan bag QR to receive
- Manual confirm
- Add receive note

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/packets`
- `GET /api/laundry/bags`
- `POST /api/laundry/orders/[id]/store-receive`

---

#### 2.9 Ready for Delivery
| Property | Value |
|---|---|
| Route | `laundryPage=ready-delivery-queue` |
| Component | `LaundryReadyForDelivery` in `views/laundry-store-stages.tsx` |
| Sidebar label | Ready for Delivery |
| Min rank | 2 |
| Permission | `store_ops.ready_for_delivery.view` |

**Actions:**
- Schedule home delivery
- Assign delivery executive
- Collect final payment
- Mark delivered (complete delivery)
- Enter recipient name + note

**API:**
- `GET /api/laundry/orders`
- `GET /api/laundry/delivery-executives`
- `GET /api/laundry/customers/[id]/addresses`
- `GET /api/laundry/slot-config`
- `POST /api/laundry/orders/[id]/payment`
- `POST /api/laundry/dispatch/delivery`
- `POST /api/laundry/orders/[id]/deliver`

---

### 3. Services & Pricing

#### 3.1 Services
| Property | Value |
|---|---|
| Route | `laundryPage=services` |
| Component | `ServicesMasterPage` in `views/pricing/pricing-page-wrappers.tsx` |
| Sidebar label | Services |
| Min rank | 3 (admin/owner) |
| Permission | `laundry.pricing.view` |

**Actions:** Create, Edit, Delete service, set per-garment prices

**API:**
- `GET /api/laundry/services`
- `POST /api/laundry/services`
- `PUT /api/laundry/services/[id]`
- `DELETE /api/laundry/services/[id]`
- `GET /api/laundry/services/[id]/prices`
- `PUT /api/laundry/services/[id]/prices`

#### 3.2 Categories
| Property | Value |
|---|---|
| Route | `laundryPage=categories` |
| Component | `LaundryCategoriesMaster` in `views/laundry-categories-master.tsx` |
| Sidebar label | Categories |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** Create, Edit, Delete category, bulk import

**API:**
- `GET /api/laundry/categories`
- `POST /api/laundry/categories`
- `PUT /api/laundry/categories/[id]`
- `DELETE /api/laundry/categories/[id]`
- `POST /api/laundry/masters/bulk-import`

#### 3.3 Garments
| Property | Value |
|---|---|
| Route | `laundryPage=garments` |
| Component | `LaundryGarmentsMaster` in `views/laundry-garments-master.tsx` |
| Sidebar label | Garments |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** Create, Edit, Delete garment, bulk create, export, import, set pricing

**API:**
- `GET /api/laundry/garments`
- `POST /api/laundry/garments`
- `PUT /api/laundry/garments/[id]`
- `DELETE /api/laundry/garments/[id]`
- `POST /api/laundry/garments/bulk`
- `GET /api/laundry/garments/export`
- `POST /api/laundry/garments/import`
- `PUT /api/laundry/garments/[id]/pricing`

#### 3.4 Pricing Matrix
| Property | Value |
|---|---|
| Route | `laundryPage=pricing` |
| Component | `LaundryPricingMatrix` in `views/laundry-pricing-matrix.tsx` |
| Sidebar label | Pricing Matrix |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** View matrix, bulk edit, import, bulk delete pricing rules

**API:**
- `GET /api/laundry/pricing-matrix`
- `PUT /api/laundry/garments/[id]/pricing`
- `POST /api/laundry/pricing-matrix/bulk-delete`
- `POST /api/laundry/pricing-matrix/import`

#### 3.5 Subscription Plans
| Property | Value |
|---|---|
| Route | `laundryPage=subscription-plans` |
| Component | `SubscriptionPlansPage` in `views/pricing/pricing-page-wrappers.tsx` |
| Sidebar label | Subscription Plans |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** Create, Edit, Delete subscription plan

**API:**
- `GET /api/laundry/plans`
- `POST /api/laundry/plans`
- `PUT /api/laundry/plans/[id]`
- `DELETE /api/laundry/plans/[id]`

#### 3.6 Charges & Rules
| Property | Value |
|---|---|
| Route | `laundryPage=charges-rules` |
| Component | `ChargesRulesPage` in `views/pricing/pricing-page-wrappers.tsx` |
| Sidebar label | Charges & Rules |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** Configure minimum order, express delivery charges, etc.

**API:**
- `GET /api/laundry/charges-config`
- `PUT /api/laundry/charges-config`

#### 3.7 Pricing Simulator
| Property | Value |
|---|---|
| Route | `laundryPage=pricing-simulator` |
| Component | `PricingSimulatorPage` in `views/pricing/pricing-page-wrappers.tsx` |
| Sidebar label | Pricing Simulator |
| Min rank | 3 |
| Permission | `laundry.pricing.view` |

**Actions:** Simulate order cost with various service/garment combos

**API:**
- `POST /api/laundry/pricing/simulate`
- `POST /api/laundry/billing/quote`

---

### 4. Orders & Customers (Group)

Covered above in 1.3, 1.4, 1.5.

---

### 5. Business Management

#### 5.1 Stores
| Property | Value |
|---|---|
| Route | `laundryPage=stores` |
| Component | `LaundryStoresView` in `admin/laundry/laundry-stores-view.tsx` |
| Sidebar label | Stores |
| Min rank | 3 |
| Permission | `laundry.stores.view` |

**Actions:** Create, Edit, Delete store

**API:**
- `GET /api/laundry/businesses/[id]/stores`
- `POST /api/laundry/businesses/[id]/stores`
- `PUT /api/laundry/stores/[id]`
- `DELETE /api/laundry/stores/[id]`

#### 5.2 Staff (Desktop Admin)
| Property | Value |
|---|---|
| Route | `laundryPage=staff` |
| Component | `LaundryStaff` in `views/laundry-staff.tsx` |
| Sidebar label | Staff |
| Min rank | 3 |
| Permission | `laundry.staff.view` |

**Actions:** View staff list, create staff, edit staff, delete staff, reset password, assign role

**API:**
- `GET /api/laundry/staff`
- `POST /api/laundry/staff`
- `PATCH /api/laundry/staff/[userId]`
- `POST /api/laundry/staff/[userId]/reset-password`

#### 5.3 Delivery Executives Master
| Property | Value |
|---|---|
| Route | `laundryPage=delivery-executives` |
| Component | `LaundryDeliveryExecutives` in `views/laundry-delivery-executives.tsx` |
| Sidebar label | Delivery Executives |
| Min rank | 3 |
| Permission | `laundry.staff.view` |

**Actions:** View, Create, Edit, Delete delivery executives

**API:**
- `GET /api/laundry/delivery-executives`
- `POST /api/laundry/delivery-executives`
- `GET /api/laundry/delivery-executives/[id]`
- `PUT /api/laundry/delivery-executives/[id]`
- `DELETE /api/laundry/delivery-executives/[id]`

#### 5.4 Mobile Apps
| Property | Value |
|---|---|
| Route | `laundryPage=mobile-apps` |
| Component | `LaundryMobileApps` in `views/laundry-mobile-apps.tsx` |
| Sidebar label | Mobile Apps |
| Min rank | 3 |
| Permission | `laundry.staff.view` |

**Actions:** View provisioning status, generate provisioning, view app URLs

**API:**
- `GET /api/laundry/app-provisioning`
- `POST /api/laundry/app-provisioning`
- `GET /api/laundry/app-urls`

#### 5.5 Roles & Permissions
| Property | Value |
|---|---|
| Route | `laundryPage=roles` |
| Component | `LaundryRolesPermissions` in `views/laundry-roles-permissions.tsx` |
| Sidebar label | Roles & Permissions |
| Min rank | 3 |
| Permission | `laundry.staff.assign_role` |

**Actions:**
- List roles
- Create role
- Edit role (name/description)
- Clone role
- Delete role
- View permission catalog
- Toggle permissions (Select All / Clear All per module/screen)
- Search permissions
- Save permission matrix
- Seed default roles

**API:**
- `GET /api/laundry/rbac/catalog`
- `GET /api/laundry/rbac/roles`
- `POST /api/laundry/rbac/roles`
- `GET /api/laundry/rbac/roles/[id]`
- `PUT /api/laundry/rbac/roles/[id]`
- `DELETE /api/laundry/rbac/roles/[id]`
- `POST /api/laundry/rbac/roles/[id]/clone`
- `GET /api/laundry/rbac/roles/[id]/permissions`
- `PUT /api/laundry/rbac/roles/[id]/permissions`
- `GET /api/laundry/rbac/assignments`
- `POST /api/laundry/rbac/assignments`
- `DELETE /api/laundry/rbac/assignments`
- `GET /api/laundry/rbac/audit`
- `POST /api/laundry/rbac/seed`

#### 5.6 Subscriptions (Customer)
| Property | Value |
|---|---|
| Route | `laundryPage=subscriptions` |
| Component | `LaundrySubscriptionsView` in `views/laundry-subscriptions-view.tsx` |
| Sidebar label | Subscriptions |
| Min rank | 3 |
| Permission | `laundry.subscriptions.view` |

**Actions:** List subscriptions, create, collect payment, view reports, view ledger, process renewal, adjust

**API:**
- `GET /api/laundry/subscriptions`
- `POST /api/laundry/subscriptions`
- `GET /api/laundry/subscriptions/active`
- `POST /api/laundry/subscriptions/preview`
- `POST /api/laundry/subscriptions/collect`
- `GET /api/laundry/subscriptions/reports`
- `GET /api/laundry/subscriptions/[id]/ledger`
- `POST /api/laundry/subscriptions/[id]/renewal`

#### 5.7 Reports
| Property | Value |
|---|---|
| Route | `laundryPage=reports` |
| Component | `LaundryReportsView` in `views/laundry-reports-view.tsx` |
| Sidebar label | Reports |
| Min rank | 3 |
| Permission | `laundry.reports.view` |

**Actions:** View reports, export

**API:**
- `GET /api/laundry/reports`

#### 5.8 Settings
| Property | Value |
|---|---|
| Route | `laundryPage=settings` |
| Component | `LaundryWorkspaceSettings` in `views/laundry-workspace-settings.tsx` |
| Sidebar label | Settings |
| Min rank | 3 |
| Permission | `laundry.settings.view` |

**Sub-sections:**
- Storage usage widget
- Financial settings (invoice template, GST, branding)
- Pickup/delivery slot config
- Payment settings
- Payment providers

**API:**
- `GET /api/laundry/settings`
- `PUT /api/laundry/settings`
- `GET /api/laundry/financial-settings`
- `PUT /api/laundry/financial-settings`
- `GET /api/laundry/pickup-settings`
- `PUT /api/laundry/pickup-settings`
- `GET /api/laundry/slot-config`
- `PUT /api/laundry/slot-config`
- `GET /api/laundry/payment-gateway`
- `PUT /api/laundry/payment-gateway`
- `GET /api/laundry/payment-settings`
- `PUT /api/laundry/payment-settings`
- `GET /api/laundry/storage`
- `GET /api/laundry/businesses/[id]`
- `PUT /api/laundry/businesses/[id]`

---

### 6. Processing Center (Admin Desktop)

#### 6.1 Console & Receive
| Property | Value |
|---|---|
| Route | `laundryPage=processing-centers` |
| Component | `LaundryProcessingConsole` in `views/laundry-processing-console.tsx` |
| Sidebar label | Console & Receive |
| Min rank | 3 |
| Permission | `processing.console_receive.view` |

**Actions:**
- View department summary tiles (WASH, DRY, DRYCLEAN, IRON, FOLD, QC, PACKED counts)
- Receive dispatched packets (scan QR)
- View awaiting barcode list
- View completed orders ready for store dispatch
- Dispatch to store (reprint QR, optional bag scan)
- Search packet history

**API:**
- `GET /api/laundry/processing`
- `GET /api/laundry/processing/summary`
- `POST /api/laundry/orders/[id]/receive`
- `GET /api/laundry/packets`
- `POST /api/laundry/orders/[id]/return-dispatch`

#### 6.2 Barcode Generation
| Property | Value |
|---|---|
| Route | `laundryPage=audit-barcode` |
| Component | `LaundryAuditBarcodePage` / `LaundryAuditBarcode` in `views/laundry-audit-barcode-page.tsx` |
| Sidebar label | Barcode Generation |
| Min rank | 3 |
| Permission | `processing.audit_barcode.view` |

**Actions:**
- View pending barcode list
- Open order barcode screen
- Generate individual garment barcodes
- Generate all pending
- Reprint barcode
- Preview label
- Print labels
- Move to processing queue (all garments must be barcoded + payment collected)
- Configure thermal label settings
- View history

**API:**
- `GET /api/laundry/processing`
- `GET /api/laundry/orders`
- `GET /api/laundry/orders/[id]/barcodes`
- `POST /api/laundry/orders/[id]/barcodes`
- `POST /api/laundry/items/[id]/barcode`

#### 6.3 Workstation Stages (WASH, DRY, DRYCLEAN, IRON, FOLD, QC)
| Property | Value |
|---|---|
| Route | `laundryPage=ws-wash`, `ws-dry`, `ws-dryclean`, `ws-iron`, `ws-fold`, `ws-qc` |
| Component | `LaundryWorkstation` in `views/laundry-workstation.tsx` (reused, per stage) |
| Sidebar labels | Washing, Drying, Dry Cleaning, Ironing, Folding, Quality Check |
| Min rank | 3 |
| Permission (dynamic) | `processing.{stage}.view` |

**Actions:**
- Scan barcode → start garment (WAITING → IN_PROGRESS)
- Start individual
- Complete individual (non-QC)
- Pass (QC only)
- QC Fail (QC only — select rework stage + reason)
- Pause
- Resume
- Return to Queue (permission-gated)
- Bulk advance (multi-select → bulk Complete/Pass)
- Search by item code, barcode, garment name
- Manual process (without scan)

**API:**
- `GET /api/laundry/processing`
- `GET /api/laundry/scan?barcode=`
- `POST /api/laundry/items/[id]/process`
- `GET /api/laundry/rbac/me`

---

### 7. Processing Inbound (sidebar group)

Sidebar also includes:

- **Processing Dashboard** (`ProcessingDashboard` in `views/processing-dashboard.tsx`) — summary cards: Awaiting Processing, In Progress, QC Pending, Completed Today, In Transit. API: `GET /api/laundry/processing/summary`

---

### 8. Store Admin PWA

**Route:** `/laundry/store`
**Entry:** `src/app/laundry/store/page.tsx`
**Auth:** `requireStoreAdmin` (store staff sessions)

#### 8.1 Dashboard Tab
**Actions:** View operational counts, "Needs attention" banner, navigate to filtered views
**API:** `GET /api/laundry/store-admin/dashboard`

#### 8.2 Orders Tab
**Actions:** Search orders, filter by status, tap to open detail
**API:** `GET /api/laundry/orders`

#### 8.3 Order Detail + Actions
**Actions:** View stage banner, call/WhatsApp customer, view timeline, context-dependent primary action:
- Pack order → `POST /api/laundry/orders/[id]/pack`
- Dispatch to processing → `POST /api/laundry/orders/[id]/dispatch`
- Receive at processing → `POST /api/laundry/orders/[id]/receive`
- Dispatch to store → `POST /api/laundry/orders/[id]/return-dispatch`
- Receive at store → `POST /api/laundry/orders/[id]/store-receive`
- Mark delivered → `POST /api/laundry/orders/[id]/deliver`
- Collect payment → `POST /api/laundry/orders/[id]/payment`
- Approve audit → `POST /api/laundry/orders/[id]/transition`
- Reopen audit → `POST /api/laundry/orders/[id]/transition`
- Audit: add garments, upload photos, inspect → various APIs

#### 8.4 Dispatch Tab
**Actions:** Toggle Pickups/Deliveries, multi-select jobs, bulk assign to executives, individual assign/reassign
**API:** `GET /api/laundry/pickup-scheduler`, `GET /api/laundry/delivery-executives`, `POST /api/laundry/pickup-scheduler`

#### 8.5 Scan Tab
**Actions:**
- Pickup Receive: scan bag → preview → confirm (OK/BAG_DAMAGED/SEAL_BROKEN/GARMENTS_MISSING/REJECT), bulk mode
- Delivery Bag Return: scan returned delivery bag
- Garment scan: scan barcode → identify order → process (START/COMPLETE/QC_PASS)
**API:**
- `POST /api/laundry/bags/receive-at-store`
- `POST /api/laundry/bags/delivery-return`
- `GET /api/laundry/scan?barcode=`
- `POST /api/laundry/items/[id]/process`

#### 8.6 Profile Tab
**Actions:** View profile, switch store (Super Admin), sign out
**API:** `POST /api/laundry/store-admin/auth/logout`

#### 8.7 Create Order (FAB)
**Actions:** Walk-in or home pickup, search/create customer, add garment lines, schedule, submit
**API:** Various (services, garments, customers, orders)

---

### 9. Delivery Executive PWA

**Route:** `/laundry/executive`
**Entry:** `src/components/laundry/executive/executive-app.tsx`
**Auth:** `resolveExecutive` (bearer token, executive-specific auth)

**Screens:**
- Login (mobile + password)
- Jobs dashboard (Pickups/Deliveries/Completed/History tabs)
- Job detail + actions:
  - Accept/reject assignment
  - Start pickup
  - Reach customer
  - Verify customer (name/OTP)
  - Scan bag per service (pickup)
  - Complete pickup
  - **Scan delivery bag** (delivery)
  - Navigate (opens Google Maps)
  - Out for delivery
  - Mark as delivered (recipient name/OTP verification)
  - Collect cash payment
  - Show UPI payment QR
  - Call/WhatsApp customer
- Profile

**API:** 17 executive endpoints (see Phase 4 below)

---

### 10. Customer App PWA

**Route:** `/laundry/app`
**Component:** `LaundryCustomerApp` in `components/laundry/app/laundry-customer-app.tsx`
**Auth:** Internal bypass (`x-laundry-internal` header)

**Screens:**
- Login/Register (OTP)
- Home (stats, subscription, quick actions)
- Place Order (catalog, quote, submit)
- Orders List + Detail (timeline, items, invoice)
- Subscription (plan details, consumption ledger)
- Profile (edit, addresses, notification prefs, logout)

**API:** 21 customer app endpoints

---

### 11. CRM Module (feature-gated)

| Screen | Route | Component | Permission |
|---|---|---|---|
| Dashboard | `laundryPage=crm-dashboard` | `CrmDashboard` | `crm.dashboard.view` |
| Leads | `laundryPage=crm-leads` | `CrmLeads` | `crm.leads.view` |
| Lead Detail | (dialog) | `CrmLeadDetail` | `crm.leads.view` |
| Opportunities | `laundryPage=crm-opportunities` | `CrmOpportunities` | `crm.opportunity.view` |
| Activities | `laundryPage=crm-activities` | `CrmActivities` | `crm.activities.view` |
| Tasks | `laundryPage=crm-tasks` | `CrmTasks` | `crm.activities.view` |
| Reports | `laundryPage=crm-reports` | `CrmReports` | `crm.reports.view` |
| Settings | `laundryPage=crm-settings` | `CrmSettings` | `crm.settings.view` |

**Actions:** Create lead, edit lead, delete lead, convert lead → opportunity, update opportunity stage, create activity, create task, complete task, view reports, configure settings (lead statuses, sources, fields, sales stages, lost reasons, activity types)

**API:** 40 CRM endpoints

---

### 12. Marketing Module (feature-gated)

| Screen | Route | Permission fallback |
|---|---|---|
| Dashboard | `laundryPage=marketing-dashboard` | `laundry.settings.view` |
| Discounts | `laundryPage=marketing-discounts` | `laundry.settings.view` |
| Coupons | `laundryPage=marketing-coupons` | `laundry.settings.view` |
| Loyalty | `laundryPage=marketing-loyalty` | `laundry.settings.view` |
| Membership | `laundryPage=marketing-membership` | `laundry.settings.view` |
| Gift Cards | `laundryPage=marketing-giftcards` | `laundry.settings.view` |
| Referral | `laundryPage=marketing-referral` | `laundry.settings.view` |
| Credits | `laundryPage=marketing-credits` | `laundry.settings.view` |
| Cart Recovery | `laundryPage=marketing-cart-recovery` | `laundry.settings.view` |
| Campaigns | `laundryPage=marketing-campaigns` | `laundry.settings.view` |
| Reports | `laundryPage=marketing-reports` | `laundry.settings.view` |

> Note: Marketing module uses `laundry.settings.view` as a catch-all permission. No dedicated marketing permissions exist.

---

### 13. Super Admin / Platform Admin

| Screen | Route | Component |
|---|---|---|
| Laundry OS Dashboard | (Platform Admin) | `LaundryOsDashboard` in `admin/laundry/laundry-os-dashboard.tsx` |
| Laundry Businesses | (Platform Admin) | `LaundryBusinessesView` in `admin/laundry/laundry-businesses-view.tsx` |

**Actions:** View all businesses, create business, setup business, configure features, manage licensing, platform-level reports

**Auth:** Uses platform RBAC (`isPlatformRole`, `hasPermission` in `lib/permissions.ts` / `lib/core/rbac.ts`) — NOT laundry-specific permissions.

---

## Phase 3: Complete Action Inventory (per screen)

| Screen | Actions (actual, from code) |
|---|---|
| **Dashboard** | View stats |
| **New Order** | Create (walk-in), Create (home pickup), Search customer, Create customer |
| **Orders List** | View list, Search, Filter, View detail, Export |
| **Order Detail** | View timeline, View items, View payments, View invoices, Regenerate invoice, Print invoice, View pickup bags, Cancel order (via transition), Delete order (permanent), Apply subscription |
| **Customers** | View list, Search, Create, Edit, Merge, Delete, Send invite, View addresses, Add/Edit/Delete address, Upload documents, Delete documents, View notes, Add notes, View stats, View timeline, View membership |
| **Garment Lookup** | Search by barcode, View history |
| **Dispatch Center** | View status, Bulk assign pickups, Bulk assign deliveries, Schedule pickup, Schedule delivery, Cancel dispatch, Backfill |
| **Bag Management** | Generate bags, Print labels, Filter, Search, Mark damaged, Mark lost, Return to available, Receive returned bag (scan), Manual release, View detail+history, Configure release stage, Reconciliation |
| **Assign Bags** | Assign bag (scan), Receive at store (scan) |
| **Store Audit** | View queue, Search, Scan bag, Inspect garment, Select defects, Add notes, Add missed garments, Capture weight, Upload photos, Save progress, Hold, Approve & generate invoice, Reject |
| **Payment Collection** | Record payment (CASH/UPI/CARD/WALLET), Pay Later, Reopen Audit, View dues |
| **Packing & QR** | Confirm packing, Generate packet QR, Print QR, View history, Reprint QR |
| **Transit to Processing** | View packet, Enter transport info, Add note, Dispatch |
| **Store Receive** | Scan packet QR, Scan bag QR, Manual confirm, Add note |
| **Ready for Delivery** | Schedule delivery, Assign executive, Collect payment, Mark delivered, Enter recipient name + note |
| **Services** | Create, Edit, Delete, Set prices |
| **Categories** | Create, Edit, Delete, Bulk import |
| **Garments (Master)** | Create, Edit, Delete, Bulk create, Export, Import |
| **Pricing Matrix** | View, Bulk edit, Import, Bulk delete |
| **Subscription Plans** | Create, Edit, Delete |
| **Charges & Rules** | Configure |
| **Pricing Simulator** | Simulate |
| **Stores** | Create, Edit, Delete |
| **Staff** | View list, Create, Edit, Delete, Reset password, Assign role |
| **Delivery Executives** | View list, Create, Edit, Delete |
| **Mobile Apps** | View provisioning, Generate, View URLs |
| **Roles & Permissions** | List roles, Create, Edit, Clone, Delete, View catalog, Toggle permissions, Search permissions, Save, Seed defaults |
| **Subscriptions** | List, Create, Collect, Renew, Adjust, Cancel, View ledger, View reports |
| **Reports** | View, Export |
| **Settings** | View storage, Configure financial settings, Configure slots, Configure payment gateway, Configure payment settings |
| **Processing Console** | View department summary, Receive packet (scan), View barcode-awaiting list, View completed list, Dispatch to store |
| **Barcode Generation** | Generate individual barcode, Generate all pending, Reprint, Preview, Print, Configure label, Move to processing queue |
| **Workstation (per stage)** | Scan barcode, Start, Complete, Pass (QC), QC Fail, Pause, Resume, Return to Queue, Bulk complete, Search, Manual process |
| **Store PWA - Dashboard** | View counts |
| **Store PWA - Orders** | Search, Filter, View detail |
| **Store PWA - Order Detail** | View stage, Call, View timeline, Pack, Dispatch, Receive, Store-receive, Deliver, Collect payment, Approve audit, Reopen audit, Audit actions (add garments, upload photos, inspect) |
| **Store PWA - Dispatch** | Assign pickups/deliveries, Bulk assign |
| **Store PWA - Scan** | Receive bag at store (with condition), Return delivery bag, Scan garment + process |
| **Store PWA - Create** | Walk-in/home pickup, Create customer, Add garments, Schedule |
| **Executive PWA** | Login, Accept/reject, Start, Reach, Verify, Assign bag (scan), Complete pickup, Scan delivery bag, Navigate, Out for delivery, Mark delivered, Collect cash, Show QR, Call |
| **Customer App** | Login/register, View home, Place order, View orders, View order detail, View subscription, Edit profile, Manage addresses |
| **CRM** | View dashboard, Create lead, Edit lead, Delete lead, Convert lead, View/Edit opportunity, Update stage, Create activity, Create task, Complete task, View reports, Configure settings |
| **Marketing** | (Placeholder screens, no functional actions beyond view) |

---

## Phase 4: API Endpoints → UI Action Mapping

### 4.1 Laundry Core (45 endpoints)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/orders` | View order list | `laundry.orders.view` |
| POST | `/api/laundry/orders` | Create order | `laundry.orders.create` |
| GET | `/api/laundry/orders/stats` | View dashboard stats | `laundry.orders.view` |
| GET | `/api/laundry/orders/[id]` | View order detail | `laundry.orders.view` |
| POST | `/api/laundry/orders/[id]/transition` | Cancel order / Edit order / Transition state | `laundry.orders.cancel` or `.edit` (dynamic) |
| POST | `/api/laundry/orders/[id]/dispatch` | Dispatch to processing | `store_ops.transit.operate` |
| POST | `/api/laundry/orders/[id]/receive` | Receive at processing center | `processing.console_receive.operate` |
| POST | `/api/laundry/orders/[id]/return-dispatch` | Dispatch back to store | `processing.console_receive.operate` |
| POST | `/api/laundry/orders/[id]/store-receive` | Receive at store | `store_ops.store_receive.operate` |
| POST | `/api/laundry/orders/[id]/deliver` | Mark delivered | `store_ops.ready_for_delivery.operate` |
| POST | `/api/laundry/orders/[id]/permanent-delete` | Delete order permanently | (no guard found) |
| POST | `/api/laundry/orders/[id]/apply-subscription` | Apply subscription to order | `laundry.subscriptions.adjust` |
| PUT | `/api/laundry/orders/[id]/inspect` | Save inspection / approve audit | `store_ops.store_audit.operate` |
| POST | `/api/laundry/orders/[id]/pack` | Pack order | `store_ops.packing_qr.operate` |
| GET | `/api/laundry/orders/[id]/barcodes` | View barcodes | `processing.audit_barcode.view` |
| POST | `/api/laundry/orders/[id]/barcodes` | Generate all / Move to processing | `processing.audit_barcode.operate` |
| POST | `/api/laundry/orders/[id]/items` | Add garment items (audit) | `store_ops.store_audit.view` (via `laundry.pricing.edit`?? — actually uses `store_ops.store_audit.view`) |
| GET | `/api/laundry/orders/[id]/invoice` | View invoice | `laundry.orders.view` |
| POST | `/api/laundry/orders/[id]/invoice` | Regenerate invoice | `laundry.orders.edit` |
| GET | `/api/laundry/orders/[id]/payment` | View payment info | _Store PWA (requireStoreAdmin), Admin → no guard found_ |
| POST | `/api/laundry/orders/[id]/payment` | Record payment | `store_ops.payment_collection.operate` |
| GET | `/api/laundry/orders/[id]/pickup-bags` | View pickup bag assignments | `laundry.orders.view` |
| POST | `/api/laundry/orders/[id]/pickup-bags` | Assign pickup bags | `laundry.orders.create` |
| GET | `/api/laundry/orders/[id]/processing-package` | View processing package | `laundry.orders.view` |
| POST | `/api/laundry/orders/[id]/processing-package` | Create processing package | `laundry.orders.create` |
| POST | `/api/laundry/items/[id]/barcode` | Generate/reprint garment barcode | _Processing auth only_ |
| POST | `/api/laundry/items/[id]/process` | Start/Complete/Pause/Resume/QC_PASS/QC_FAIL/Return | Dynamic: `processing.{stage}.{action}` |
| POST | `/api/laundry/orders/apply-subscription` | _deprecated/inline_ | |

### 4.2 Customers (18 endpoints)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/customers` | View customer list | `laundry.customers.view` |
| POST | `/api/laundry/customers` | Create customer | `laundry.customers.create` |
| GET | `/api/laundry/customers/search` | Search customers | `laundry.customers.view` |
| POST | `/api/laundry/customers/merge` | Merge customers | `laundry.customers.merge` (catalog) but _no guard found_ |
| GET | `/api/laundry/customers/[id]` | View customer detail | `laundry.customers.view` |
| PUT | `/api/laundry/customers/[id]` | Edit customer | `laundry.customers.edit` |
| GET | `/api/laundry/customers/[id]/addresses` | View addresses | `laundry.customers.view` |
| POST | `/api/laundry/customers/[id]/addresses` | Add address | `laundry.customers.edit` |
| PUT | `/api/laundry/customers/[id]/addresses/[addressId]` | Edit address | `laundry.customers.edit` |
| DELETE | `/api/laundry/customers/[id]/addresses/[addressId]` | Delete address | `laundry.customers.edit` |
| GET | `/api/laundry/customers/[id]/documents` | View documents | `laundry.customers.view` |
| POST | `/api/laundry/customers/[id]/documents` | Upload document | `laundry.customers.edit` |
| DELETE | `/api/laundry/customers/[id]/documents` | Delete document | `laundry.customers.edit` |
| GET | `/api/laundry/customers/[id]/membership` | View membership | `laundry.customers.view` |
| GET | `/api/laundry/customers/[id]/notes` | View notes | `laundry.customers.view` |
| POST | `/api/laundry/customers/[id]/notes` | Add note | `laundry.customers.edit` |
| GET | `/api/laundry/customers/[id]/stats` | View stats | `laundry.customers.view` |
| GET | `/api/laundry/customers/[id]/timeline` | View timeline | `laundry.customers.view` |
| POST | `/api/laundry/app/invite` | Send app invite | `laundry.customers.invite` |

### 4.3 Bags (13 endpoints)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/bags` | View bag list | `laundry.orders.view` |
| POST | `/api/laundry/bags` | Generate bags | `laundry.orders.create` |
| GET | `/api/laundry/bags/[id]` | View bag detail | `laundry.orders.view` |
| PATCH | `/api/laundry/bags/[id]` | Update bag status | `laundry.orders.create` |
| POST | `/api/laundry/bags/assign` | Assign bag to order | `laundry.orders.create` |
| POST | `/api/laundry/bags/advance` | Advance bag status | `laundry.orders.create` |
| POST | `/api/laundry/bags/order/[id]/advance` | Advance order's bags | _No guard found_ |
| POST | `/api/laundry/bags/receive-at-store` | Receive bag at store | Store PWA auth (`requireStoreAdmin`) |
| POST | `/api/laundry/bags/delivery-return` | Return delivery bag | `laundry.bags.delivery_return` |
| POST | `/api/laundry/bags/return` | Generic bag return | `laundry.bags.return_scan` |
| POST | `/api/laundry/bags/manual-release` | Force release bag | `laundry.bags.manual_release` |
| GET | `/api/laundry/bags/history` | View bag history | `laundry.bags.view` |
| GET | `/api/laundry/bags/reconciliation` | View reconciliation | `laundry.orders.view` |

### 4.4 Store Operations (Admin Desktop)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| POST | `/api/laundry/dispatch/pickup` | Schedule pickup | `laundry.orders.create` (implied) |
| POST | `/api/laundry/dispatch/delivery` | Schedule delivery | `laundry.orders.create` (implied) |
| POST | `/api/laundry/dispatch/cancel` | Cancel dispatch | _No guard found_ |
| POST | `/api/laundry/dispatch/backfill` | Reassign dispatch | _No guard found_ |
| GET | `/api/laundry/dispatch/status` | View dispatch status | _No guard found_ |
| GET | `/api/laundry/pickup-scheduler` | View scheduler | _No guard found_ |
| POST | `/api/laundry/pickup-scheduler` | Assign pickup | _No guard found_ |
| GET | `/api/laundry/pickup-bags` | View pickup bags | `laundry.orders.view` |
| POST | `/api/laundry/pickup-bags/receive` | Receive pickup bag | `laundry.orders.create` |

### 4.5 Pricing & Master Data (35+ endpoints)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/pricing` | View pricing rules | `laundry.pricing.view` |
| POST | `/api/laundry/pricing` | Create pricing rule | `laundry.pricing.edit_pricing` |
| GET | `/api/laundry/pricing/[id]` | View pricing rule | `laundry.pricing.view` |
| PUT | `/api/laundry/pricing/[id]` | Edit pricing rule | `laundry.pricing.edit_pricing` |
| DELETE | `/api/laundry/pricing/[id]` | Delete pricing rule | `laundry.pricing.delete_rules` |
| POST | `/api/laundry/pricing/conflicts` | Check conflicts | `laundry.pricing.edit_pricing` |
| POST | `/api/laundry/pricing/simulate` | Simulate pricing | `laundry.pricing.view` |
| GET | `/api/laundry/pricing-matrix` | View matrix | `laundry.pricing.view` |
| POST | `/api/laundry/pricing-matrix/bulk-delete` | Bulk delete rules | `laundry.pricing.delete_rules` |
| POST | `/api/laundry/pricing-matrix/import` | Import pricing | `laundry.pricing.edit_pricing` |
| GET/PUT | `/api/laundry/charges-config` | View/Edit charges | `.view` / `.edit_pricing` |
| GET/POST/PUT/DELETE | `/api/laundry/services[/id]` | Full CRUD services | `.view` / `.edit_pricing` / `.delete_rules` |
| GET/POST/PUT/DELETE | `/api/laundry/categories[/id]` | Full CRUD categories | `.view` / `.edit_pricing` / `.delete_rules` |
| GET/POST/PUT/DELETE | `/api/laundry/garments[/id]` | Full CRUD garments | `.view` / `.edit_pricing` / `.delete_rules` |
| POST/GET | `/api/laundry/garments/bulk` | Bulk create garments | `laundry.pricing.edit_pricing` |
| GET | `/api/laundry/garments/export` | Export garments | `laundry.pricing.view` |
| POST | `/api/laundry/garments/import` | Import garments | `laundry.pricing.edit_pricing` |
| POST | `/api/laundry/masters/bulk-import` | Bulk import categories | `laundry.pricing.edit_pricing` |

### 4.6 Subscriptions & Plans (12 endpoints)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/plans` | View plans | `laundry.subscriptions.view` |
| POST | `/api/laundry/plans` | Create plan | `laundry.subscriptions.edit` |
| PUT | `/api/laundry/plans/[id]` | Edit plan | `laundry.subscriptions.edit` |
| DELETE | `/api/laundry/plans/[id]` | Delete plan | `laundry.subscriptions.delete` |
| GET | `/api/laundry/subscriptions` | View subscriptions | `laundry.subscriptions.view` |
| POST | `/api/laundry/subscriptions` | Create subscription | `laundry.subscriptions.edit` |
| GET | `/api/laundry/subscriptions/active` | View active | `laundry.subscriptions.view` |
| POST | `/api/laundry/subscriptions/preview` | Preview | `laundry.subscriptions.view` |
| POST | `/api/laundry/subscriptions/collect` | Collect payment | `store_ops.payment_collection.operate` |
| GET | `/api/laundry/subscriptions/reports` | View reports | `laundry.reports.view` |
| GET | `/api/laundry/subscriptions/[id]/ledger` | View ledger | `laundry.subscriptions.view` |
| POST | `/api/laundry/subscriptions/[id]/renewal` | Renew/Adjust/Cancel | Dynamic (`.renew`/`.adjust`/`.cancel`/`.edit`) |

### 4.7 Processing (workstation/console)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/processing` | View processing queue | Dynamic: `processing.{screen}.view` or `processing.console_receive.view` |
| GET | `/api/laundry/processing/summary` | View summary | `processing.console_receive.view` |

### 4.8 Business Management (staff, stores, settings)

| Method | Route | UI Action | Permission Guard |
|---|---|---|---|
| GET | `/api/laundry/staff` | View staff | `laundry.staff.view` |
| POST | `/api/laundry/staff` | Create staff | `laundry.staff.create` |
| PATCH | `/api/laundry/staff/[userId]` | Edit staff / Assign role | Dynamic: `laundry.staff.assign_role` or `laundry.staff.edit` |
| POST | `/api/laundry/staff/[userId]/reset-password` | Reset password | `laundry.staff.edit` |
| GET | `/api/laundry/delivery-executives` | View executives | `laundry.staff.view` |
| POST | `/api/laundry/delivery-executives` | Create executive | `laundry.staff.create` |
| GET/PUT/DELETE | `/api/laundry/delivery-executives/[id]` | Edit/Delete executive | `laundry.staff.view` / `.edit` |
| GET/POST | `/api/laundry/businesses/[id]/stores` | View/Create stores | `laundry.stores.view` / `.create` |
| PUT/DELETE | `/api/laundry/stores/[id]` | Edit/Delete store | `laundry.stores.edit` / `.delete` |
| GET/PUT | `/api/laundry/settings` | View/Edit general settings | `laundry.settings.view` / `.edit` |
| GET/PUT | `/api/laundry/financial-settings` | View/Edit financial settings | `laundry.settings.view` / `.edit` |
| GET/PUT | `/api/laundry/pickup-settings` | View/Edit pickup settings | `laundry.settings.view` / `.edit` |
| GET/PUT | `/api/laundry/slot-config` | View/Edit slot config | `laundry.settings.view` / `.edit` |
| GET/PUT | `/api/laundry/payment-gateway` | View/Edit gateway | `laundry.settings.view` / `.edit` |
| GET/PUT | `/api/laundry/payment-settings` | View/Edit payment settings | `laundry.settings.view` / `.edit` |
| GET/POST/PUT/DELETE | `/api/laundry/departments[/id]` | Manage departments | `laundry.settings.view` / `.edit` |
| GET/POST/PUT/DELETE | `/api/laundry/workflow-configurations[/id]` | Manage workflows | `laundry.settings.view` / `.edit` |
| GET/POST/PUT/DELETE | `/api/laundry/workflow-stages[/id]` | Manage stages | `laundry.settings.view` / `.edit` |
| GET/POST/PUT/DELETE | `/api/laundry/processing-centers[/id]` | Manage processing centers | `laundry.settings.view` / `.edit` |
| GET/POST | `/api/laundry/app-provisioning` | View/Generate provisioning | `laundry.staff.view` / `laundry.settings.edit` |
| GET | `/api/laundry/app-urls` | View app URLs | `laundry.staff.view` |

### 4.9 RBAC (13 endpoints)

All guarded by `laundry.staff.view` (read) or `laundry.staff.assign_role` (write).

### 4.10 Executive PWA (13 endpoints)

Auth: `resolveExecutive` (executive token). No `requireLaundryPermission` guards.

| Method | Route | UI Action |
|---|---|---|
| POST | `/api/laundry/executive/auth/login` | Login |
| POST | `/api/laundry/executive/auth/logout` | Logout |
| GET | `/api/laundry/executive/config` | Bootstrap config |
| GET | `/api/laundry/executive/me` | Profile |
| GET | `/api/laundry/executive/jobs` | List jobs |
| POST | `/api/laundry/executive/jobs/[id]/respond` | Accept/reject |
| POST | `/api/laundry/executive/jobs/[id]/status` | Advance pickup status |
| POST | `/api/laundry/executive/jobs/[id]/assign-bag` | Assign pickup bag |
| POST | `/api/laundry/executive/jobs/[id]/delivery-bag` | Scan delivery bag |
| POST | `/api/laundry/executive/jobs/[id]/deliver` | Out for delivery / Delivered |
| POST | `/api/laundry/executive/jobs/[id]/collect-payment` | Collect cash |
| POST | `/api/laundry/executive/jobs/[id]/payment-qr` | Generate payment QR |
| GET | `/api/laundry/executive/jobs/[id]/payment-status` | Poll payment status |

### 4.11 Store Admin PWA (4 endpoints)

Auth: `requireStoreAdmin` (store staff session). No `requireLaundryPermission` guards.

| Method | Route | UI Action |
|---|---|---|
| POST | `/api/laundry/store-admin/auth/login` | Login |
| POST | `/api/laundry/store-admin/auth/logout` | Logout |
| GET | `/api/laundry/store-admin/me` | Profile |
| GET | `/api/laundry/store-admin/dashboard` | Dashboard counts |

### 4.12 Customer App (21 endpoints)

Auth: Internal bypass (`x-laundry-internal` header) + customer token.

| Method | Route | UI Action |
|---|---|---|
| POST | `/api/laundry/app/auth/check` | Check email |
| POST | `/api/laundry/app/auth/send-otp` | Send OTP |
| POST | `/api/laundry/app/auth/verify` | Verify OTP (login/register) |
| POST | `/api/laundry/app/auth/logout` | Logout |
| GET | `/api/laundry/app/config` | Bootstrap config |
| GET | `/api/laundry/app/me` | Profile + stats |
| PUT | `/api/laundry/app/me` | Update profile |
| GET/POST/PUT/DELETE | `/api/laundry/app/addresses[/id]` | Manage addresses |
| GET | `/api/laundry/app/catalog` | Browse catalog |
| POST | `/api/laundry/app/quote` | Get quote |
| GET | `/api/laundry/app/orders` | List orders |
| POST | `/api/laundry/app/orders` | Place order |
| GET | `/api/laundry/app/orders/[orderId]` | Order detail |
| GET | `/api/laundry/app/history` | Order history |
| GET | `/api/laundry/app/subscription` | View subscription |
| POST | `/api/laundry/app/invite` | _Admin-customer invite_ |

### 4.13 CRM (40 endpoints)

All guarded by `crm.*` permissions.

### 4.14 No-Guard Endpoints

These endpoints were discovered with NO `requireLaundryPermission` or `requireStoreAdmin` guard:

| Route | File |
|---|---|
| `POST /api/laundry/orders/[id]/permanent-delete` | `orders/[id]/permanent-delete/route.ts` |
| `POST /api/laundry/bags/order/[id]/advance` | `bags/order/[id]/advance/route.ts` |
| `GET /api/laundry/bags/reconciliation` | `bags/reconciliation/route.ts` |
| `GET /api/laundry/dispatch/status` | `dispatch/status/route.ts` |
| `POST /api/laundry/dispatch/cancel` | `dispatch/cancel/route.ts` |
| `POST /api/laundry/dispatch/backfill` | `dispatch/backfill/route.ts` |
| `GET /api/laundry/pickup-scheduler` | `pickup-scheduler/route.ts` |
| `POST /api/laundry/pickup-scheduler` | `pickup-scheduler/route.ts` |
| `POST /api/laundry/seed-demo` | `seed-demo/route.ts` |
| `POST /api/laundry/seed-storefront` | `seed-storefront/route.ts` |
| `GET /api/laundry/storage` | `storage/route.ts` |
| `GET /api/laundry/next-business-code` | `next-business-code/route.ts` |
| `POST /api/laundry/support-session` | `support-session/route.ts` |
| `GET /api/laundry/scan` | `scan/route.ts` |
| `POST /api/laundry/billing/quote` | `billing/quote/route.ts` |
| `GET /api/laundry/crm/entitlement` | `crm/entitlement/route.ts` |

---

## Phase 5: Generated Permission Matrix

The following permissions are DERIVED from the application (not assumed). Each is tied to an actual UI action + API endpoint.

### laundry (module)

| Screen | Permission | Exists? | API Guard? |
|---|---|---|---|
| Dashboard | `laundry.dashboard.view` | ✅ | ✅ |
| Orders | `laundry.orders.view` | ✅ | ✅ |
| Orders | `laundry.orders.create` | ✅ | ✅ |
| Orders | `laundry.orders.edit` | ✅ | ✅ |
| Orders | `laundry.orders.cancel` | ✅ | ✅ (via transition) |
| Orders | `laundry.orders.delete` | ✅ (permanent-delete) | ❌ (no guard on endpoint) |
| Orders | `laundry.orders.print` | ✅ (invoice print button) | ❌ (no API guard, UI only) |
| Orders | `laundry.orders.export` | ✅ (export button visible) | ❌ (no API guard, UI only) |
| Customers | `laundry.customers.view` | ✅ | ✅ |
| Customers | `laundry.customers.create` | ✅ | ✅ |
| Customers | `laundry.customers.edit` | ✅ | ✅ |
| Customers | `laundry.customers.delete` | ✅ (delete button exists) | ❌ (no API guard exists) |
| Customers | `laundry.customers.merge` | ✅ (merge UI exists) | ❌ (merge API has no guard) |
| Customers | `laundry.customers.invite` | ✅ | ✅ |
| Garment Lookup | `laundry.orders.view` | ✅ (reuses orders.view) | ✅ |
| Subscriptions | `laundry.subscriptions.view` | ✅ | ✅ |
| Subscriptions | `laundry.subscriptions.edit` | ✅ | ✅ (plans create/edit) |
| Subscriptions | `laundry.subscriptions.create` | ✅ (catalog says `.create`, API uses `.edit`) | ❌ inconsistency |
| Subscriptions | `laundry.subscriptions.delete` | ✅ (plans delete exists) | ✅ (plans use `.delete`) |
| Subscriptions | `laundry.subscriptions.renew` | ✅ (renew button) | ✅ (dynamic via renewal endpoint) |
| Subscriptions | `laundry.subscriptions.adjust` | ✅ (adjust button) | ✅ |
| Subscriptions | `laundry.subscriptions.cancel` | ✅ (cancel button) | ✅ (via renewal endpoint) |
| Pricing | `laundry.pricing.view` | ✅ | ✅ |
| Pricing | `laundry.pricing.edit_pricing` | ✅ | ✅ |
| Pricing | `laundry.pricing.delete_rules` | ✅ | ✅ |
| Stores | `laundry.stores.view` | ✅ | ✅ |
| Stores | `laundry.stores.create` | ✅ | ✅ |
| Stores | `laundry.stores.edit` | ✅ | ✅ |
| Stores | `laundry.stores.delete` | ✅ | ✅ |
| Staff (Desktop) | `laundry.staff.view` | ✅ | ✅ |
| Staff (Desktop) | `laundry.staff.create` | ✅ | ✅ |
| Staff (Desktop) | `laundry.staff.edit` | ✅ | ✅ |
| Staff (Desktop) | `laundry.staff.delete` | ✅ (UI has delete) | ❌ (no delete endpoint) |
| Staff (Desktop) | `laundry.staff.assign_role` | ✅ | ✅ |
| Delivery Executives | `laundry.staff.view` | ✅ (reuses staff.view) | ✅ |
| Bags | `laundry.bags.view` | ✅ | ✅ |
| Bags | `laundry.bags.return_scan` | ✅ (return bag button) | ✅ |
| Bags | `laundry.bags.delivery_return` | ✅ (delivery-return API) | ✅ |
| Bags | `laundry.bags.manual_release` | ✅ (manual release button) | ✅ |
| Reports | `laundry.reports.view` | ✅ | ✅ |
| Reports | `laundry.reports.export` | ✅ (export button) | ❌ (no API guard) |
| Settings | `laundry.settings.view` | ✅ | ✅ |
| Settings | `laundry.settings.edit` | ✅ | ✅ |

### store_ops (module)

| Screen | Permission | Exists? | API Guard? |
|---|---|---|---|
| Store Audit | `store_ops.store_audit.view` | ✅ | ✅ |
| Store Audit | `store_ops.store_audit.operate` | ✅ (inspect,transition) | ✅ |
| Payment Collection | `store_ops.payment_collection.view` | ✅ | ❌ (sidebar only, no API guard) |
| Payment Collection | `store_ops.payment_collection.operate` | ✅ (record payment) | ✅ |
| Packing & QR | `store_ops.packing_qr.view` | ✅ | ❌ (sidebar only) |
| Packing & QR | `store_ops.packing_qr.operate` | ✅ (pack endpoint) | ✅ |
| Transit to Processing | `store_ops.transit.view` | ✅ | ❌ (sidebar only) |
| Transit to Processing | `store_ops.transit.operate` | ✅ (dispatch endpoint) | ✅ |
| Store Receive | `store_ops.store_receive.view` | ✅ | ❌ (sidebar only) |
| Store Receive | `store_ops.store_receive.operate` | ✅ (store-receive endpoint) | ✅ |
| Ready for Delivery | `store_ops.ready_for_delivery.view` | ✅ | ❌ (sidebar only) |
| Ready for Delivery | `store_ops.ready_for_delivery.operate` | ✅ (deliver endpoint) | ✅ |

### processing (module)

| Screen | Permission | Exists? | API Guard? |
|---|---|---|---|
| Console & Receive | `processing.console_receive.view` | ✅ | ✅ |
| Console & Receive | `processing.console_receive.operate` | ✅ (receive, return-dispatch) | ✅ |
| Barcode Generation | `processing.audit_barcode.view` | ✅ | ✅ |
| Barcode Generation | `processing.audit_barcode.operate` | ✅ (generate barcodes) | ✅ |
| Washing | `processing.washing.view` | ✅ | ✅ (sidebar + API) |
| Washing | `processing.washing.process` | ✅ (start/complete/pause/resume) | ✅ (via items/[id]/process) |
| Washing | `processing.washing.override` | ✅ (return to queue) | ✅ (permission-gated) |
| Washing | `processing.washing.return_queue` | ✅ (return to queue action) | ✅ (permission-gated) |
| Drying | `processing.drying.view` | ✅ | ✅ |
| Drying | `processing.drying.process` | ✅ | ✅ |
| Drying | `processing.drying.override` | ✅ | ✅ |
| Drying | `processing.drying.return_queue` | ✅ | ✅ |
| Dry Cleaning | `processing.dry_cleaning.view` | ✅ | ✅ |
| Dry Cleaning | `processing.dry_cleaning.process` | ✅ | ✅ |
| Dry Cleaning | `processing.dry_cleaning.override` | ✅ | ✅ |
| Dry Cleaning | `processing.dry_cleaning.return_queue` | ✅ | ✅ |
| Ironing | `processing.ironing.view` | ✅ | ✅ |
| Ironing | `processing.ironing.process` | ✅ | ✅ |
| Ironing | `processing.ironing.override` | ✅ | ✅ |
| Ironing | `processing.ironing.return_queue` | ✅ | ✅ |
| Folding | `processing.folding.view` | ✅ | ✅ |
| Folding | `processing.folding.process` | ✅ | ✅ |
| Folding | `processing.folding.override` | ✅ | ✅ |
| Folding | `processing.folding.return_queue` | ✅ | ✅ |
| Quality Check | `processing.quality_check.view` | ✅ | ✅ |
| Quality Check | `processing.quality_check.process` | ✅ | ✅ |
| Quality Check | `processing.quality_check.override` | ✅ | ✅ |
| Quality Check | `processing.quality_check.return_queue` | ✅ | ✅ |
| Packing | `processing.packing.view` | ✅ (no sidebar item but exists in catalog) | ❌ (no API guard, but stage exists) |
| Packing | `processing.packing.process` | ✅ | ✅ (via items/[id]/process) |
| Processing Start | `processing.processing_start.operate` | ✅ (move to processing queue) | ✅ |

### crm (module)

All permissions defined in catalog and guarded in API.

| Screen | Permission | Exists? |
|---|---|---|
| Dashboard | `crm.dashboard.view` | ✅ |
| Leads | `crm.leads.view` | ✅ |
| Leads | `crm.leads.create` | ✅ |
| Leads | `crm.leads.edit` | ✅ |
| Leads | `crm.leads.delete` | ✅ (delete endpoint guarded) |
| Leads | `crm.leads.import` | ✅ (catalog) but ❌ (no endpoint) |
| Leads | `crm.leads.export` | ✅ (catalog) but ❌ (no endpoint) |
| Opportunity | `crm.opportunity.view` | ✅ |
| Opportunity | `crm.opportunity.edit` | ✅ |
| Activities | `crm.activities.view` | ✅ |
| Activities | `crm.activities.create` | ✅ |
| Activities | `crm.activities.edit` | ✅ (catalog) but ❌ (no API guard) |
| Activities | `crm.activities.delete` | ✅ (catalog) but ❌ (no endpoint) |
| Pipeline | `crm.pipeline.view` | ✅ (catalog) but ❌ (no endpoint) |
| Pipeline | `crm.pipeline.edit` | ✅ (catalog) but ❌ (no endpoint) |
| Templates | `crm.templates.view` | ✅ (catalog) but ❌ (no endpoint) |
| Templates | `crm.templates.edit` | ✅ (catalog) but ❌ (no endpoint) |
| Reports | `crm.reports.view` | ✅ |
| Reports | `crm.reports.export` | ✅ (catalog) but ❌ (no endpoint) |
| Settings | `crm.settings.view` | ✅ |
| Settings | `crm.settings.edit` | ✅ |

### customer_app (module)

Defined in catalog but NO API guards use these. Customer app uses internal bypass header.

| Permission | Catalog? | API Guard? |
|---|---|---|
| `customer_app.view_customers` | ✅ | ❌ |
| `customer_app.send_invitation` | ✅ | ❌ |
| `customer_app.view_subscription` | ✅ | ❌ |
| `customer_app.view_orders` | ✅ | ❌ |

---

## Phase 6: Permissions Grouped by Module

```
laundry (core)
├── laundry.dashboard.view
├── laundry.orders.view
├── laundry.orders.create
├── laundry.orders.edit
├── laundry.orders.cancel
├── laundry.orders.delete       ← exists in catalog, no API guard
├── laundry.orders.print        ← catalog only (UI button, no API)
├── laundry.orders.export       ← catalog only (UI button, no API)
├── laundry.orders.refund       ← catalog only (no UI action found)
├── laundry.customers.view
├── laundry.customers.create
├── laundry.customers.edit
├── laundry.customers.delete    ← exists in catalog, no API guard
├── laundry.customers.merge     ← UI + API exist, no API guard
├── laundry.customers.invite
├── laundry.subscriptions.view
├── laundry.subscriptions.edit
├── laundry.subscriptions.create  ← catalog says .create, API uses .edit (inconsistency)
├── laundry.subscriptions.delete
├── laundry.subscriptions.renew   ← catalog says .renew, dynamic via renewal
├── laundry.subscriptions.adjust
├── laundry.subscriptions.cancel  ← dynamic via renewal
├── laundry.pricing.view
├── laundry.pricing.edit_pricing
├── laundry.pricing.delete_rules
├── laundry.stores.view
├── laundry.stores.create
├── laundry.stores.edit
├── laundry.stores.delete
├── laundry.staff.view
├── laundry.staff.create
├── laundry.staff.edit
├── laundry.staff.delete        ← UI has delete, no API endpoint
├── laundry.staff.assign_role
├── laundry.bags.view
├── laundry.bags.return_scan
├── laundry.bags.delivery_return
├── laundry.bags.manual_release
├── laundry.reports.view
├── laundry.reports.export      ← catalog only (no API guard)
├── laundry.settings.view
├── laundry.settings.edit

store_ops (store operations)
├── store_ops.store_audit.view
├── store_ops.store_audit.operate
├── store_ops.packing_qr.view
├── store_ops.packing_qr.operate
├── store_ops.transit.view
├── store_ops.transit.operate
├── store_ops.store_receive.view
├── store_ops.store_receive.operate
├── store_ops.ready_for_delivery.view
├── store_ops.ready_for_delivery.operate
├── store_ops.payment_collection.view
├── store_ops.payment_collection.operate

processing (processing center)
├── processing.console_receive.view
├── processing.console_receive.operate
├── processing.audit_barcode.view
├── processing.audit_barcode.operate
├── processing.processing_start.operate
├── processing.washing.view
├── processing.washing.process
├── processing.washing.override
├── processing.washing.return_queue
├── processing.drying.view
├── processing.drying.process
├── processing.drying.override
├── processing.drying.return_queue
├── processing.dry_cleaning.view
├── processing.dry_cleaning.process
├── processing.dry_cleaning.override
├── processing.dry_cleaning.return_queue
├── processing.ironing.view
├── processing.ironing.process
├── processing.ironing.override
├── processing.ironing.return_queue
├── processing.folding.view
├── processing.folding.process
├── processing.folding.override
├── processing.folding.return_queue
├── processing.quality_check.view
├── processing.quality_check.process
├── processing.quality_check.override
├── processing.quality_check.return_queue
├── processing.packing.view
├── processing.packing.process

crm (customer relationship management)
├── crm.dashboard.view
├── crm.leads.view
├── crm.leads.create
├── crm.leads.edit
├── crm.leads.delete
├── crm.leads.import           ← catalog only (no endpoint)
├── crm.leads.export           ← catalog only (no endpoint)
├── crm.opportunity.view
├── crm.opportunity.edit
├── crm.activities.view
├── crm.activities.create
├── crm.activities.edit         ← catalog only (no API guard)
├── crm.activities.delete       ← catalog only (no API guard)
├── crm.activities.edit
├── crm.pipeline.view           ← catalog only (no endpoint)
├── crm.pipeline.edit           ← catalog only (no endpoint)
├── crm.templates.view          ← catalog only (no endpoint)
├── crm.templates.edit          ← catalog only (no endpoint)
├── crm.reports.view
├── crm.reports.export          ← catalog only (no endpoint)
├── crm.settings.view
├── crm.settings.edit

customer_app (customer mobile app)
├── customer_app.view_customers      ← catalog only (no guards)
├── customer_app.send_invitation     ← catalog only (no guards)
├── customer_app.view_subscription   ← catalog only (no guards)
├── customer_app.view_orders         ← catalog only (no guards)
```

---

## Phase 7: RBAC Gaps Detected

### 7.1 Sidebar Menu Protection Gaps

| Screen | Menu Protected? | Route Protected? | API Protected? |
|---|---|---|---|
| Dashboard | ✅ (perm + rank) | ❌ (SPA, no route guard) | ✅ |
| New Order | ✅ (perm + rank) | ❌ | ✅ |
| Orders | ✅ (perm + rank) | ❌ | ✅ |
| Customers | ✅ (perm + rank) | ❌ | ✅ |
| Garment Lookup | ✅ (perm + rank) | ❌ | ✅ |
| Dispatch Center | ✅ (perm + rank) | ❌ | ❌ (no API guard on multiple endpoints) |
| Bag Management | ✅ (perm + rank) | ❌ | ✅ |
| Assign Bags | ✅ (perm + rank) | ❌ | ✅ |
| Store Audit | ✅ (perm + rank) | ❌ | ✅ |
| Payment Collection | ✅ (perm + rank) | ❌ | ✅ |
| Packing & QR | ✅ (perm + rank) | ❌ | ✅ |
| Transit to Processing | ✅ (perm + rank) | ❌ | ✅ |
| Store Receive | ✅ (perm + rank) | ❌ | ✅ |
| Ready for Delivery | ✅ (perm + rank) | ❌ | ✅ |
| Services | ✅ (perm + rank) | ❌ | ✅ |
| Categories | ✅ (perm + rank) | ❌ | ✅ |
| Garments | ✅ (perm + rank) | ❌ | ✅ |
| Pricing | ✅ (perm + rank) | ❌ | ✅ |
| Subscription Plans | ✅ (perm + rank) | ❌ | ✅ |
| Charges & Rules | ✅ (perm + rank) | ❌ | ✅ |
| Pricing Simulator | ✅ (perm + rank) | ❌ | ✅ |
| Stores | ✅ (perm + rank) | ❌ | ✅ |
| Staff | ✅ (perm + rank) | ❌ | ✅ |
| Delivery Executives | ✅ (perm + rank) | ❌ | ✅ |
| Mobile Apps | ✅ (perm + rank) | ❌ | ✅ |
| Roles & Permissions | ✅ (perm + rank) | ❌ | ✅ |
| Subscriptions | ✅ (perm + rank) | ❌ | ✅ |
| Reports | ✅ (perm + rank) | ❌ | ✅ |
| Settings | ✅ (perm + rank) | ❌ | ✅ |
| Processing Console | ✅ (rank only, NO perm) | ❌ | ✅ |
| Barcode Generation | ✅ (rank only, NO perm) | ❌ | ✅ |
| All Workstations | ❌ (NO perm on sidebar items) | ❌ | ✅ |
| Store PWA screens | ❌ (uses store admin auth) | ❌ | ❌ (uses separate auth) |
| Executive PWA | ❌ (uses executive auth) | ❌ | ❌ (uses separate auth) |
| Customer App | ❌ (uses internal bypass) | ❌ | ❌ (uses separate auth) |
| CRM screens | ✅ (perm) | ❌ | ✅ |
| Marketing screens | ❌ (uses `laundry.settings.view` catch-all) | ❌ | ❌ (no dedicated permissions) |

### 7.2 API Endpoints Without Guards

16 endpoints discovered with NO permission guard (listed in Phase 4.14).

### 7.3 Button-Level Protection Gaps

The following actions are visible in UI but have NO API-level permission enforcement:

- **Bag Management — Manual Release button**: Hidden on UI via `GET /api/laundry/rbac/me` check ✅, but API also guards with `laundry.bags.manual_release` ✅
- **Workstation — Return to Queue button**: Permission-gated via `GET /api/laundry/rbac/me` ✅, API also guards dynamically ✅
- **Generate Bags button**: No UI-level permission check (anyone with access to Bag Management page sees it). API requires `laundry.orders.create`.
- **Delete buttons (customers, orders, staff, etc.)**: Visible based on page access, API may or may not guard.

### 7.4 Dual RBAC System

Two parallel systems exist:
1. **New**: `LaundryAccessRole` + `LaundryAccessPermission` + `LaundryAccessAssignment` — used by `requireLaundryPermission` guard
2. **Legacy**: `LaundryRole` + `LaundryStagePermission` + `LaundryUserAssignment` — used by `prisma/seed-laundry.ts` only

**Gap**: No migration path. The legacy tables are populated by seed scripts but the new RBAC never reads them. The `LEGACY_ROLE_MAP` fallback in `laundry-rbac.ts` only covers default fallback when no `LaundryAccessAssignment` exists.

### 7.5 Sidebar minRank vs Permission Inconsistency

Processing Center sidebar items rely ONLY on `minRank` (role type) and have NO `perm` field. This means:
- A `COUNTER_EXECUTIVE` with rank 1 does NOT see processing screens (rank 3) ✅
- A `PROCESSING_STAFF` with rank 1 in processing-only mode DOES see all processing screens ✅
- But RBAC permissions are NEVER checked at the sidebar level for these items

### 7.6 Store Ops `*.view` permissions never checked at API level

The sidebar defines `store_ops.store_audit.view`, `store_ops.packing_qr.view`, etc. But these `.view` permissions are ONLY used for menu visibility — they are NEVER checked by any API endpoint. Only the `.operate` variants are checked on write endpoints.

---

## Phase 8: Orphan Permission Analysis

### 8.1 Permissions in Catalog that Exist but Are NEVER API-Checked

| Permission | Where Defined | Where It Should Guard | Gap |
|---|---|---|---|
| `laundry.orders.print` | `laundry-rbac-catalog.ts` | Print invoice button in UI | No API to guard (client-side print) |
| `laundry.orders.export` | `laundry-rbac-catalog.ts` | Export orders button | No export API endpoint exists |
| `laundry.orders.refund` | `laundry-rbac-catalog.ts` | No UI action found | Orphan — no UI, no API |
| `laundry.customers.merge` | `laundry-rbac-catalog.ts` | Merge customers dialog | API endpoint exists but NO guard |
| `laundry.customers.delete` | `laundry-rbac-catalog.ts` | Delete customer button | API endpoint exists but NO guard |
| `laundry.staff.delete` | `laundry-rbac-catalog.ts` | Delete staff button | No delete API endpoint exists |
| `laundry.reports.export` | `laundry-rbac-catalog.ts` | Export reports button | No export API endpoint exists |
| `laundry.subscriptions.create` | `laundry-rbac-catalog.ts` | Create subscription | API uses `laundry.subscriptions.edit` instead |
| `store_ops.store_audit.view` | sidebar + catalog | View audit queue | Never checked at API level (only `.operate` is) |
| `store_ops.packing_qr.view` | sidebar + catalog | View packing queue | Never checked at API level |
| `store_ops.transit.view` | sidebar + catalog | View transit queue | Never checked at API level |
| `store_ops.store_receive.view` | sidebar + catalog | View store receive queue | Never checked at API level |
| `store_ops.ready_for_delivery.view` | sidebar + catalog | View delivery queue | Never checked at API level |
| `store_ops.payment_collection.view` | sidebar + catalog | View payment queue | Never checked at API level |
| `crm.leads.import` | `laundry-rbac-catalog.ts` | Import leads | No endpoint |
| `crm.leads.export` | `laundry-rbac-catalog.ts` | Export leads | No endpoint |
| `crm.activities.edit` | `laundry-rbac-catalog.ts` | Edit activity | API uses `crm.activities.create` for PUT |
| `crm.activities.delete` | `laundry-rbac-catalog.ts` | Delete activity | No endpoint |
| `crm.pipeline.view` | `laundry-rbac-catalog.ts` | View pipeline | No endpoint |
| `crm.pipeline.edit` | `laundry-rbac-catalog.ts` | Edit pipeline | No endpoint |
| `crm.templates.view` | `laundry-rbac-catalog.ts` | View templates | No endpoint |
| `crm.templates.edit` | `laundry-rbac-catalog.ts` | Edit templates | No endpoint |
| `crm.reports.export` | `laundry-rbac-catalog.ts` | Export reports | No endpoint |
| `customer_app.*` (4 perms) | `laundry-rbac-catalog.ts` | Customer app actions | Never checked (customer app uses internal bypass) |
| `processing.washing.override` | catalog + API | Return to queue | Checked at API level ✅ |
| `processing.washing.return_queue` | catalog + API | Return to queue action | Checked at API level ✅ |
| `processing.packing.view` | catalog only | No sidebar item | No API guard for view |
| `processing.processing_start.operate` | catalog + API | Move to processing queue | Checked at API level ✅ |

### 8.2 Permissions Checked in Code but NOT in Catalog

Not found — all permission strings used in code are defined in the catalog. The catalog is comprehensive.

### 8.3 Duplicate Permissions

- `laundry.subscriptions.edit` vs `laundry.subscriptions.create`: Catalog defines `.create` and `.edit` separately, but subscription plan creation uses `laundry.subscriptions.edit` (not `.create`). This is an inconsistency, not a true duplicate.
- `laundry.settings.edit` is used as a catch-all for many setting types (financial, payment, pickup, slot, department, workflow, processing center, app-provisioning). These could be split into granular permissions.

### 8.4 Unused Prisma Models

- `LaundryRole` (legacy, line 5115) and related `LaundryStagePermission`, `LaundryUserAssignment` — populated only by `prisma/seed-laundry.ts`, never read by new RBAC code
- `RolePermission` (platform, line 2539) — stores JSON permissions per role, used only in platform auth token, NOT by Laundry OS RBAC

---

## Phase 9: RBAC Implementation Plan

The following plan derives directly from the audit above. It documents every module, screen, action, API, required permission, and whether it exists, is missing, or is duplicated.

### Stage 1 — Fix Immediate Gaps (NO code changes needed here)

These are permission gaps identified in the audit that should be closed:

| # | Module | Screen | Action | API Endpoint | Required Permission | Exists? | API Guard? | Fix Needed |
|---|---|---|---|---|---|---|---|---|
| 1 | Orders | Delete | Permanent delete | `POST /orders/[id]/permanent-delete` | `laundry.orders.delete` | ✅ | ❌ | Add guard |
| 2 | Customers | Merge | Merge duplicates | `POST /customers/merge` | `laundry.customers.merge` | ✅ | ❌ | Add guard |
| 3 | Customers | Delete | Delete customer | (implied) | `laundry.customers.delete` | ✅ | ❌ | Add guard to existing endpoint |
| 4 | Dispatch | Cancel | Cancel dispatch | `POST /dispatch/cancel` | — | ❌ | ❌ | Add guard |
| 5 | Dispatch | Backfill | Reassign | `POST /dispatch/backfill` | — | ❌ | ❌ | Add guard |
| 6 | Dispatch | Status | View status | `GET /dispatch/status` | — | ❌ | ❌ | Add guard |
| 7 | Pickup Scheduler | Assign | Schedule | `POST /pickup-scheduler` | — | ❌ | ❌ | Add guard |
| 8 | Bags | Advance | Advance order bags | `POST /bags/order/[id]/advance` | `laundry.orders.edit` | ❌(catalog) | ❌ | Add perm to catalog + guard |
| 9 | Bags | Reconciliation | View report | `GET /bags/reconciliation` | `laundry.bags.view` | ✅ | ❌ | Add guard |
| 10 | Store Ops | Audit View | View audit queue | (API list) | `store_ops.store_audit.view` | ✅ | ❌ | Add guard to GET orders filtered by status |
| 11 | Store Ops | Packing View | View packing queue | (API list) | `store_ops.packing_qr.view` | ✅ | ❌ | Add guard |
| 12 | Store Ops | Transit View | View transit queue | (API list) | `store_ops.transit.view` | ✅ | ❌ | Add guard |
| 13 | Store Ops | Store Receive View | View receive queue | (API list) | `store_ops.store_receive.view` | ✅ | ❌ | Add guard |
| 14 | Store Ops | Ready Del View | View delivery queue | (API list) | `store_ops.ready_for_delivery.view` | ✅ | ❌ | Add guard |
| 15 | Store Ops | Payment View | View payment queue | (API list) | `store_ops.payment_collection.view` | ✅ | ❌ | Add guard |

### Stage 2 — Resolve Catalog Inconsistencies

| # | Issue | Current | Should Be |
|---|---|---|---|
| 1 | Subscription create uses `.edit` | `laundry.subscriptions.edit` on POST /plans | Use `laundry.subscriptions.create` (already in catalog) |
| 2 | Store_op `.view` perms never checked at API level | Only sidebar protection | Either add API guards or deprecate from catalog |
| 3 | `laundry.settings.edit` is too broad | Covers 8+ setting categories | Split into `laundry.settings.{financial,payment,pickup,workflow}` etc. |

### Stage 3 — Remove Orphan Permissions from Catalog

Consider removing these permission keys that have no corresponding UI action or API:

- `laundry.orders.refund` (no UI action)
- `crm.leads.import` / `crm.leads.export` (no endpoints)
- `crm.activities.edit` / `crm.activities.delete` (no endpoints)
- `crm.pipeline.view` / `crm.pipeline.edit` (no endpoints)
- `crm.templates.view` / `crm.templates.edit` (no endpoints)
- `crm.reports.export` (no endpoint)
- `customer_app.*` (entire module, uses separate auth path)

### Stage 4 — Add Missing Sidebar Permissions for Processing

Processing sidebar items need `perm` fields added:

| Sidebar Item | Permission to Add |
|---|---|
| Console & Receive | `processing.console_receive.view` |
| Barcode Generation | `processing.audit_barcode.view` |
| Washing | `processing.washing.view` |
| Drying | `processing.drying.view` |
| Dry Cleaning | `processing.dry_cleaning.view` |
| Ironing | `processing.ironing.view` |
| Folding | `processing.folding.view` |
| Quality Check | `processing.quality_check.view` |

### Stage 5 — Marketing Module Permissions

Dedicated permissions should replace the `laundry.settings.view` catch-all:

- `marketing.dashboard.view`
- `marketing.discounts.view` / `.edit`
- `marketing.coupons.view` / `.edit`
- `marketing.loyalty.view` / `.edit`
- etc.

### Stage 6 — Legacy Migration

Plan to migrate from `LaundryRole` → `LaundryAccessRole`:
- Data migration script: copy existing `LaundryRole` records to `LaundryAccessRole`
- Map `LaundryStagePermission` to `LaundryAccessPermission`
- Map `LaundryUserAssignment` to `LaundryAccessAssignment`
- Retire legacy models

### Permission Count Summary

| Category | Count |
|---|---|
| Permissions in catalog | ~110 |
| Permissions with API guards | ~85 |
| Permissions defined but NOT API-guarded | ~25 |
| API endpoints with NO guard | 16 |
| Orphan permissions (no UI, no API) | 8 |
| Duplicate/inconsistent permissions | 3 |
| Marketing module (needs new perms) | ~22 |
| Store op `.view` perms (no API guard) | 6 |

---

**End of RBAC Audit — No code has been modified. This document is purely observational and derived from the application codebase.**
