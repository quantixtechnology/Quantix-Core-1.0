# Laundry OS — UAT Checklist

## Lifecycle: Storefront → Pickup → Audit → Processing → Delivery → History

### Auth & Checkout
- [ ] Storefront loads for tenant slug
- [ ] Email-first auth gate appears before checkout
- [ ] OTP sent and verified
- [ ] Profile completion (name/phone/address) works
- [ ] Password set flow works
- [ ] Login with email+password works
- [ ] Forgot password → email link → reset works
- [ ] Order created with correct customerId from auth session
- [ ] Auth gate returns immediately on return visit (token reuse)

### Pickup Assignment
- [ ] New HOME_PICKUP order appears in Pickup queue
- [ ] Only orders with `pickupRequired=true, pickupCompletedAt=null, status∉{CANCELLED,READY_FOR_DELIVERY,DELIVERED}` appear
- [ ] Executive assignment moves job to Assigned bucket
- [ ] Executive acceptance moves job to Accepted bucket
- [ ] Pickup completion (pickupCompletedAt set) REMOVES from Pickup
- [ ] OVERDUE badge shows when pickupDate is past
- [ ] Bulk assign works

### Delivery Assignment
- [ ] Order appears ONLY at `status=READY_FOR_DELIVERY`
- [ ] Only orders with `deliveryRequired=true, deliveryCompletedAt=null, status=READY_FOR_DELIVERY` appear
- [ ] Executive assignment works
- [ ] Delivery completion (deliveryCompletedAt set) REMOVES from Delivery
- [ ] OVERDUE badge shows when past due

### Mutual Exclusion (CRITICAL)
- [ ] Zero overlap between Pickup and Delivery queues — no order ever in both simultaneously
- [ ] Order disappears from Pickup immediately after pickup completion
- [ ] Order appears in Delivery only at READY_FOR_DELIVERY
- [ ] Order disappears from Delivery immediately after delivery completion
- [ ] Dashboard counters match database counts

### Field Operations (PWA)
- [ ] Executive sees assigned jobs
- [ ] Navigate action opens maps link
- [ ] Status updates (STARTED, REACHED, PICKUP_COMPLETED, etc.) reflect correctly
- [ ] Delivery flow (OUT_FOR_DELIVERY → DELIVERED) works

### History
- [ ] Completed pickups appear in Pickup History
- [ ] Completed deliveries appear in Delivery History
- [ ] Date range filters work
- [ ] Search by order number / customer / phone works
- [ ] Pagination works

### Customer Experience
- [ ] Customer can see order status in storefront
- [ ] Notifications sent on key events (assigned, completed, etc.)
- [ ] Order history shows past orders

### Regression Checks
- [ ] Store Audit — unaffected by dispatch changes
- [ ] Payment Collection — unaffected
- [ ] Packing & QR — unaffected
- [ ] Transit to Processing — unaffected
- [ ] Store Receive — unaffected
- [ ] Bag Assignment & Release — unaffected
- [ ] QR Scanning — unaffected
- [ ] Executive PWA — unaffected
- [ ] Customer Order Tracking — unaffected
