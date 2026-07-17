# Quantix Marketing Engine Standard

**Status:** OFFICIAL DESIGN — the mandatory marketing architecture for every Quantix workspace.
**Version:** 1.0 (design) · **Applies to:** Laundry, Commerce, Grocery, Pharmacy, Bakery, Restaurant, Car Wash, and every future workspace.
**Companion standards:** [Quantix Cart Standard](./QUANTIX_CART_STANDARD.md).

> This is a platform initiative delivered in **phases**. This document is the architecture, DB/API/UI design, migration strategy, regression analysis and production-readiness checklist. It is additive, reusable and backward compatible — it reuses the existing Customer, Cart, Order, Subscription, Payment, Notification and Workflow engines and never duplicates them.

---

## 1. Architecture audit — what we reuse (no duplication)

| Need | Existing to reuse | Notes |
|---|---|---|
| Customer identity, tiers, wallet | `Customer` (`loyaltyTier`, `loyaltyPoints`, `walletBalance`, `creditLimit`) | Loyalty + wallet primitives already exist — extend, don't replace. |
| Cart + server persistence | `useCartStore` (client) + `CartItem` model (`@@unique([customerId,storeId,productId,variantId])`) | Server cart already persists per customer → basis for **cart recovery** + logged-in sync. |
| Per-business enable/disable | `LaundryBusinessFeature` (featureKey+enabled) pattern | Generalize to a platform `BusinessFeature` for Marketing module toggles. |
| Order totals + discount fields | Order / LaundryOrder already have `totalDiscount`, `maxDiscount`, `discountAmount` | Marketing writes into these — no order-schema churn. |
| Notifications | `email-service.ts`, `/api/core/notifications`, `/api/v1/notifications` | Reuse for cart-recovery + reward reminders (Email/SMS/WhatsApp/Push adapters plug in). |
| Pricing / order creation | Laundry Pricing/Order engines, Commerce checkout | Marketing **prepares** a discount decision; existing engines apply it. Marketing never prices or places orders. |
| Subscription | Subscription engine + `/laundry-checkout` | Voucher applicability flags (purchase/renewal) gate here; engine unchanged. |

**Principle:** the Marketing Engine is a **decision + ledger** layer. It answers *"what benefit applies to this cart/order/customer?"* and records issuance/redemption. The Cart/Checkout/Order/Payment engines consume that decision through their existing fields.

## 2. Core concepts

- **Promotion** = the umbrella entity (Discount / Coupon / Voucher / Gift Card / Referral reward / Loyalty benefit / Campaign) with a shared **Rule** (eligibility + conditions) and a shared **Benefit** (what the customer gets).
- **Rule Engine** = a JSON, data-driven `IF (conditions) THEN (benefit)` evaluator. **No hardcoded promo logic.**
- **Redemption Ledger** = append-only record of issuance, hold, redemption, reversal — the single source for reports and fraud limits.
- **Wallet/Credit Ledger** = append-only entries for promotional credit, gift-card balance, cashback, referral payout — settles against the existing `Customer.walletBalance`.

## 3. Database changes (all additive; SQLite via `prisma db push` — the deploy already runs additive push)

New models (per-tenant, `businessId`-scoped, `workspaceType` where relevant):

1. **`BusinessFeature`** — generalized entitlement `{ businessId, featureKey, enabled }` (Marketing modules; mirrors `LaundryBusinessFeature`).
2. **`Promotion`** — `{ id, businessId, workspaceType, kind (DISCOUNT|COUPON|VOUCHER|GIFTCARD|REFERRAL|LOYALTY|CAMPAIGN), title, description, code?, status (DRAFT|SCHEDULED|ACTIVE|PAUSED|EXPIRED|CANCELLED), startAt, endAt, startTime, endTime, timezone, visibility (PUBLIC|PRIVATE|CUSTOMER|HIDDEN|AUTO), applyTo (ORDER|SUBSCRIPTION_PURCHASE|SUBSCRIPTION_RENEWAL|GIFTCARD_PURCHASE|WALLET_RECHARGE)[], maxUses, maxUsesPerCustomer, benefit Json, rule Json, priority, stackable }`.
3. **`PromotionRedemption`** — `{ id, promotionId, businessId, customerId?, orderId?, status (ISSUED|HELD|APPLIED|PENDING_AUDIT|FINALIZED|REVERSED), amount, meta Json, createdAt }` (append-only).
4. **`LoyaltyTier`** — `{ businessId, code (BRONZE…VIP), name, minSpend, minOrders, minPoints, discountPercent, benefits Json, priority, color, icon, pointsExpiryDays }` (configurable; replaces the hardcoded tier string).
5. **`LoyaltyLedger`** — `{ businessId, customerId, type (EARN|REDEEM|EXPIRE|ADJUST), points, reason, orderId?, createdAt }` (drives `Customer.loyaltyPoints`/`loyaltyTier`).
6. **`GiftCard`** — `{ businessId, code, kind (GIFTCARD|VOUCHER|CREDIT|STORE_CREDIT|PROMO_CREDIT), initialBalance, balance, currency, expiresAt, transferable, issuedToCustomerId?, status }` + **`GiftCardTxn`** ledger.
7. **`WalletLedger`** — `{ businessId, customerId, type (PROMO_CREDIT|CASHBACK|REFERRAL|GIFTCARD_REDEEM|MANUAL|SPEND), amount, reason, ref, createdAt }` (settles `Customer.walletBalance`).
8. **`Referral`** — `{ businessId, referrerCustomerId, code, refereeCustomerId?, status (INVITED|SIGNED_UP|QUALIFIED|REWARDED|FRAUD_BLOCKED), rewardReferrer Json, rewardFriend Json, createdAt }`.
9. **`CartSession`** — `{ id, businessId, customerId?, guestKey?, status (ACTIVE|ABANDONED|RECOVERED|CONVERTED|LOST), items Json snapshot, updatedAt, remindersSent Json }` — **cart recovery**, built on the existing server `CartItem` rows (snapshot + lifecycle).
10. **`Campaign`** — groups promotions + schedules + audience; **`CampaignEvent`** for analytics.

No changes to Order/LaundryOrder/Subscription/Payment schemas — Marketing writes into the **existing** discount/wallet fields + its own ledgers.

## 4. API changes (extend existing; new only where none exists)

- **Admin** `/api/core/marketing/*` (new namespace): `promotions` (CRUD + status), `loyalty-tiers`, `gift-cards`, `referrals`, `credits` (issue), `cart-recovery` (list + trigger), `campaigns`, `reports`, `features` (toggle). Guarded by existing RBAC.
- **Evaluation** `POST /api/core/marketing/evaluate` — input: `{ businessId, workspaceType, customerId?, cart, context }`; output: `{ applicable[], best, benefit, pending? }`. **The single place the Rule Engine runs.** The Cart/Checkout call this; they don't embed promo logic.
- **Customer** `/api/core/storefront/marketing/*`: `available-coupons`, `my-coupons`, `apply` (validate + hold), `gift-cards`, `wallet`, `loyalty`, `referral-code`. Reuses the customer session.
- **Reuse (extend, not duplicate):** the existing `applyCoupon` on `useCartStore`, the existing order-creation payloads (add an optional `promotionCode`/`redemptionId`), the existing notification endpoints for reminders.

## 5. Rule Engine (data-driven, no hardcoded logic)

`rule` = JSON: `{ all: [ {fact, op, value} ], any: [...] }`. Facts are resolved from context: `firstOrder`, `orderValue`, `customerTier`, `customerTags`, `mobile`, `email`, `subscriptionActive`, `birthday`, `anniversary`, `isReferral`, `isEmployee`, `isCorporate`, `services`, `categories`, `garments`, `products`, `stores`, `cities`, `brands`, `daysSinceLastOrder`, `lifetimeOrders`, `lifetimeSpend`. `benefit` = JSON: `{ type: FIXED|PERCENT|FREE_DELIVERY|FREE_PICKUP|FREE_SERVICE|FREE_GARMENT|FREE_KG|BXGY|CASHBACK|PROMO_CREDIT, value, maxDiscount, ... }`. Examples (`WELCOME100`, `Gold → 10%`, `SubscriptionActive → Free Pickup`) are **rows**, never code.

## 6. Workspace integration

- **Laundry (audit-later):** applying a coupon creates a `PromotionRedemption` in **`PENDING_AUDIT`** — it shows *"Coupon Applied · Discount Pending — final discount calculated after Store Audit."* It does **not** reduce price at booking. After Store Audit the existing invoice flow finalizes: **Invoice → Discount (redemption FINALIZED, writes `totalDiscount`) → Final Amount → Payment**. Zero workflow-engine change; a hook at invoice generation asks Marketing to finalize pending redemptions.
- **Commerce (immediate):** `evaluate` runs at checkout, the discount applies immediately into the existing order totals, redemption goes straight to `APPLIED`. Same engine, different timing flag — no separate implementation.
- **Subscriptions:** voucher `applyTo` flags (`SUBSCRIPTION_PURCHASE`/`SUBSCRIPTION_RENEWAL`) gate eligibility at `/laundry-checkout`; the subscription engine is untouched.

## 7. UI screens

**Admin — new left menu "Marketing"** (visible to all business types; each sub-module gated by a `BusinessFeature` toggle): Dashboard, Discounts, Coupons/Vouchers, Loyalty Program, Membership Levels, Gift Cards, Referral Program, Promotional Credits, Cart Recovery, Campaigns, Reports. Built with the existing enterprise UI shell/tokens; every value configurable, every feature enable/disable.

**Customer (storefront + PWA, reusing the ONE cart UX):** Available Coupons, My Coupons, Apply Coupon (in the cart — reuses `applyCoupon`, shows *Discount Pending* for laundry), Gift Cards, Wallet, Promotional Credits, Loyalty Status, Membership Tier, Referral Code.

## 8. Reports

Coupons Issued / Redeemed / Expired, Discount Given, Revenue Impact, Campaign Performance, Referral Performance, Gift-Card Balance (outstanding liability), Loyalty Distribution, Cart Recovery % (Created→Abandoned→Recovered→Converted→Lost funnel), Top Coupons, Top Customers, Outstanding Promotional Credits. All derived from the `PromotionRedemption` / `WalletLedger` / `LoyaltyLedger` / `CartSession` ledgers (single source of truth).

## 9. Cart recovery

Built on the existing server `CartItem` + a new `CartSession` lifecycle. Guest cart (localStorage) **merges on login** into the server cart (dedupe by line key); auto-restore on any device (Website/PWA/Android/iOS) since the cart is server-backed for logged-in users. Reminder scheduler (1h/6h/24h/3d/7d) dispatches via the existing notification engine (Email/SMS/WhatsApp/Push/In-App adapters). Admin sees the funnel + can trigger a manual reminder or attach a recovery coupon.

## 10. Migration strategy

Additive `prisma db push` (the deploy pipeline already runs `prisma db push --accept-data-loss` for additive changes). Seed default `LoyaltyTier` rows per business from the current hardcoded tiers (BRONZE…VIP) so existing `Customer.loyaltyTier` values keep meaning. Backfill `CartSession` lazily (created on first cart write). No destructive migration; every new table is independent.

## 11. Regression analysis

- **Order/Workflow/Pricing/Payment/Subscription/Invoice engines:** unchanged. Marketing only writes the existing discount fields and its own ledgers, via hooks at *evaluate* (cart), *finalize* (laundry invoice) and *apply* (commerce checkout).
- **Cart:** `useCartStore.applyCoupon` already exists; we wire it to `evaluate`. Existing commerce coupon behaviour preserved.
- **Feature-gated:** every module is off unless its `BusinessFeature` is enabled, so no tenant sees new behaviour until switched on — zero blast radius on rollout.
- **Backward compatible:** `loyaltyTier`/`walletBalance` semantics preserved; new ledgers reconcile to the same fields.

## 12. Phased build plan (each phase ships independently, feature-flagged)

- **Phase 1 — Foundation:** `BusinessFeature` toggle + Marketing menu shell (Dashboard placeholder) + `Promotion`/`PromotionRedemption` models + Rule Engine (`evaluate`) + **Coupons/Vouchers** (create/manage + customer apply) with the **laundry "Discount Pending → finalize at audit"** flow and commerce immediate flow. *This proves the whole architecture end-to-end on the smallest slice.*
- **Phase 2 — Loyalty & Wallet:** `LoyaltyTier` config + `LoyaltyLedger` (reward engine triggers) + `WalletLedger` + Promotional Credits.
- **Phase 3 — Gift Cards & Referral:** `GiftCard`/`GiftCardTxn` + `Referral` (codes, rewards, fraud limits).
- **Phase 4 — Cart Recovery & Campaigns:** `CartSession` lifecycle + reminder scheduler + `Campaign`/analytics.
- **Phase 5 — Reports** across all ledgers.

## 13. Production-readiness checklist (per phase)

- [ ] Additive schema only; `prisma db push` clean; existing data intact.
- [ ] Feature-flagged off by default (`BusinessFeature`).
- [ ] RBAC-guarded admin APIs; customer APIs scoped to the customer session.
- [ ] Rule Engine is data-driven (no hardcoded promos); unit-tested evaluator.
- [ ] Laundry: coupon shows *Discount Pending*, never reduces booking price; finalizes at invoice.
- [ ] Commerce: immediate discount into existing order totals.
- [ ] Ledgers append-only; reports reconcile to `walletBalance`/`loyaltyPoints`.
- [ ] `tsc` at baseline; `npm run build` exit 0 (route-guard ✓); standalone boots + `/api/health/readiness` 200.
- [ ] No change to Order/Workflow/Pricing/Payment/Subscription/Invoice/Customer engines.
