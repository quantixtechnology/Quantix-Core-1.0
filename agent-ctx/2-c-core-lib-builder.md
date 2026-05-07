# Task 2-c: Core Lib Files — POS, Delivery, Subscription, Payment, Notification

**Agent**: Core Lib Builder
**Date**: 2024-01-01
**Status**: ✅ COMPLETED

## Summary

Created 5 server-side core library files under `/src/lib/core/`. These are enhanced, production-ready versions of the existing lib files with comprehensive business logic, strict typing, and full Prisma schema alignment.

## Files Created

### 1. `/src/lib/core/pos.ts` — POS Architecture
- **Types**: `POSCartItem`, `POSCartSummary`, `POSSessionInfo`, `PrinterConfig`, `ThermalReceipt`, `POSSettlement`
- **Functions**:
  - `openPOSSession()` — Validates store, checks for existing open session, generates session number (POS-YYYYMMDD-NNN)
  - `closePOSSession()` — Calculates expected vs actual cash, difference, daily settlement
  - `getPOSSession()` — Get session with aggregated order stats (completed, pending, avg order value)
  - `getActiveSession()` — Find the current open session for a store
  - `calculatePOSCart()` — GST breakdown (CGST/SGST intra-state, IGST inter-state), round-off, amount in words, tax grouped by rate for receipt
  - `generateThermalReceipt()` — 58mm (32 chars), 80mm (48 chars), A4 support; business info, GSTIN, FSSAI, item list, tax breakdown, total, footer, rawText for direct printing
  - `numberToWords()` — Indian numbering (Lakh, Crore), handles Rupees and Paise
  - `getDefaultPrinterConfig()` / `validatePrinterConfig()` — Printer config helpers

### 2. `/src/lib/core/delivery.ts` — Delivery & Pickup Architecture
- **Types**: `PickupDeliveryStatus`, `RegularDeliveryStatus`, `ServiceabilityResult`, `DeliveryFeeParams`, `DeliveryPartnerResult`
- **Functions**:
  - `haversineDistance()` — Haversine great-circle distance in km
  - `checkServiceability()` — Nearest store, radius check, min order amount, delivery zones (circle/pincode), free delivery threshold
  - `findNearestDeliveryPartner()` — Find nearest online/active partner with ETA
  - `generateDeliveryOtp()` — 4-digit OTP
  - `verifyOtp()` — Simple comparison
  - `calculateDeliveryFee()` — Base + per-km × surge, min/max bounds, free delivery threshold
  - `isValidPickupDeliveryTransition()` — State machine (PENDING→PICKUP_ASSIGNED→PICKED_UP→PROCESSING→READY_FOR_DELIVERY→OUT_FOR_DELIVERY→DELIVERED)
  - `isValidRegularDeliveryTransition()` — State machine (PENDING→CONFIRMED→PREPARING→READY_FOR_PICKUP→OUT_FOR_DELIVERY→DELIVERED)
  - `getValidNextStatuses()` — Unified query by order type
  - `transitionPickupDeliveryOrder()` — Full transition with OTP verification, partner assignment, status history recording

### 3. `/src/lib/core/subscription.ts` — Dual Subscription Engine
- **Part A — Platform Subscription (Quantix → Business)**:
  - `createPlatformSubscription()` — Trial period, billing cycle, custom pricing, business status update
  - `processBillingCycle()` — Creates billing record, transitions from TRIAL→ACTIVE, period renewal
  - `overrideSubscriptionPricing()` — Super Admin custom price with reason, discount calculation
- **Part B — Customer Subscription (Business → Customer)**:
  - `subscribeCustomerToPlan()` — Credits from plan items, trial support, subscriber count tracking
  - `deductCredits()` — Credit deduction with usage audit trail
  - `processRenewal()` — Auto-renewal with credit rollover, or expiry
  - `pauseSubscription()` / `resumeSubscription()` — Pause/resume with period extension
  - `checkRenewals()` — Cron-friendly: finds renewals within 3 days, expirations within 7 days
- **Helper**: `calculatePeriodEnd()` — Supports WEEKLY, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY

### 4. `/src/lib/core/payment.ts` — Payment Processing
- **Types**: `CreatePaymentParams`, `PaymentInfo`, `PaymentStats`, `RefundResult`, `PaymentMethodValidation`
- **Functions**:
  - `createPayment()` — Creates record, validates order, prevents duplicate completed payments, updates order payment method
  - `updatePaymentStatus()` — Status transition validation (PENDING→PROCESSING→COMPLETED etc.), gateway transaction ID, paidAt timestamp, syncs order payment status
  - `processRefund()` — Partial/full refund, validates amounts, updates refund status, syncs order
  - `getPaymentByOrder()` — Get latest payment for an order
  - `getPaymentStats()` — By method, by status, total refunds, net revenue; date range support
  - `validatePaymentMethod()` — CASH/COD/CREDIT always valid; CARD/UPI/etc. requires active PaymentGateway

### 5. `/src/lib/core/notification.ts` — Notification System
- **Types**: `SendNotificationParams`, `NotificationInfo`, `NotificationFilters`, `NotificationTemplateInfo`
- **Functions**:
  - `sendNotification()` — Creates record, optional immediate delivery, channel routing
  - `sendOrderNotification()` — Pre-built order status messages (confirmed/preparing/ready/delivered/cancelled), template-aware, also sends push if FCM token exists
  - `sendDeliveryNotification()` — Pre-built delivery updates (assigned/picked_up/on_the_way/arrived/delivered/failed), template-aware
  - `getNotifications()` — User notifications with filters, pagination, unread count
  - `markAsRead()` / `markAllAsRead()` — Read status management
  - `getNotificationTemplate()` — DB template lookup by key + channel
  - `renderTemplate()` — `{{variable}}` replacement with dot-notation nested access

## Lint Result
✅ Zero errors — all 5 files pass ESLint

## Architecture Notes
- All files import `db` from `@/lib/db` (Prisma client singleton)
- All types are fully defined and exported for use by API routes
- No React components — server-side libs only
- All functions are async where DB access is needed, pure functions for calculations
- Status transitions are validated via state machines
- Indian billing standards: CGST/SGST, IGST, round-off, Lakh/Crore number words
