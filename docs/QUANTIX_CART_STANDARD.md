# Quantix Cart Standard

**Status:** OFFICIAL — the mandatory cart architecture for every Quantix workspace.
**Version:** 1.0 · **First implemented in:** Laundry (commit lineage: `a24f74d` → cart engine formalization).
**Applies to:** Laundry, Commerce, Grocery, Bakery, Pharmacy, and every future product.

---

## 1. Vision

Every Quantix customer always has a **cart**. A cart is not a checkout step — it is a durable place where a customer can view everything selected, change quantities, remove items, keep shopping, leave and come back, and (future) receive reminders and resume from any device.

The old Laundry flow (*select service → checkout directly*) was a temporary implementation. **All workspaces now go through the cart.** The Service Selection popup is an **Add to Cart** experience — it must never bypass the cart.

## 2. Non-negotiable principles

1. **Cart is mandatory.** Every purchasable thing enters the cart before checkout.
2. **One Cart Engine.** There is exactly ONE cart in Quantix Core: [`src/stores/cart-store.ts`](../src/stores/cart-store.ts) (`useCartStore`). There is **no** Laundry Cart / Commerce Cart / Grocery Cart / Pharmacy Cart. Do not create one.
3. **Multiple item types, one shape.** Services, garments, subscription plans, products, variants, add-ons, medicines — all map into the same `CartItem`.
4. **The cart only prepares the order.** Pricing, order creation, workflow, subscription and payment stay in each workspace's **existing** engines. The cart never prices and never places orders itself.
5. **UI may differ, architecture may not.** The PWA and the web storefront share the identical engine + business logic; only presentation differs.

## 3. The Cart Engine

### 3.1 `CartItem` (the one shape)
Commerce product lines use the original fields; other workspaces set `kind` and the optional laundry/subscription fields. All extension fields are **optional** — existing product carts are unaffected.

```ts
interface CartItem {
  productId: string; variantId: string          // identity (line key = productId::variantId)
  name: string; variantName: string
  quantity: number; price: number; mrp: number
  image: string; isVeg: boolean | null
  // Quantix multi-type extensions (optional):
  kind?: "product" | "laundry" | "subscription"  // extend the union for new types
  serviceId?; serviceName?; garmentId?           // laundry line
  pricingType?; unit?; gstPercent?; weightKg?; billedAfterAudit?
  planId?; billingCycle?                          // subscription line
}
```

### 3.2 Engine API (selected)
`items`, `addItem`, `removeItem`, `updateQuantity`, `clearKind(kind)`, `clearCart`, `replaceItems(items)` (server-sync seam), `totalItems`, `subtotal`, `total`, plus metadata `businessType` and `updatedAt`. Every mutation stamps `updatedAt` — the hook every future feature (abandoned-cart, analytics, sync) reads.

### 3.3 Business-type awareness
The storefront stamps the active workspace via `setBusinessType(...)`. The single cart is therefore business-aware without any per-product cart.

## 4. Item-type adapters (how a workspace plugs in)

A workspace never touches the engine internals. It provides a small **adapter** that (a) maps its selection into `CartItem`s and (b) maps cart lines back into the payload its **existing** order API already accepts. Contract: [`src/lib/cart/item-adapter.ts`](../src/lib/cart/item-adapter.ts).

**Reference implementation — Laundry:** [`src/lib/laundry-cart.ts`](../src/lib/laundry-cart.ts)
- `makeGarmentLine`, `makePerKgLine`, `makeSubscriptionLine` → `CartItem`s
- `cartToOrderItems(items)` → `[{ serviceId, garmentId, quantity | weightKg }]` for the **existing** laundry order/checkout APIs.

**To add a new workspace (Bakery, Pharmacy, …):** create a sibling adapter file, extend the `kind` union if needed, map selection → `CartItem` and cart → your existing order payload. **Do not** add a cart or a checkout.

## 5. Laundry implementation (the template)

- **Services/garments:** the Service Selection sheet writes lines to the shared cart on *Continue to Checkout*; the Laundry Bag badge/drawer reflect it live.
- **Subscription plans:** *Subscribe* adds a subscription line to the **same** cart. A cart may hold laundry services **and** a subscription together; the Pricing/Subscription engines decide behaviour at checkout — the cart does not.
- **Checkout:** the Laundry Bag's *Proceed to Checkout* opens the **existing** laundry checkout, which consumes the cart via `cartToOrderItems` and posts to the existing APIs (`/api/core/storefront/laundry-order`, `/laundry-checkout`).
- **PWA:** [`laundry-customer-app.tsx`](../src/components/laundry/app/laundry-customer-app.tsx) uses the **same** `useCartStore` + `laundry-cart` helpers and posts to its existing `/api/laundry/app/orders`. No second cart.

**Identical orders (Web ⇄ PWA):** both surfaces build the order payload from the same `cartToOrderItems(items)`, so the same cart contents produce the same order regardless of surface.

## 6. Persistence & sync

| Customer | Storage | Mechanism |
|---|---|---|
| Guest | Local Storage | zustand `persist` (`quantix-cart-v1`) — survives refresh, browser close, PWA restart. |
| Logged-in | Server (planned) | Hydrate via `replaceItems(items)`; merge local guest cart on login; `updatedAt` is the conflict/last-write signal. |

The **server-sync seam is already in the engine** (`replaceItems`, `updatedAt`, `businessType`). A future **cart-persistence service** (its own lightweight store + endpoint — *not* a duplicate of any order/checkout API) can hydrate/merge on login and enable device sync **without redesigning** the engine or any UI.

## 7. Future-ready (no redesign required)

Because there is one engine with `updatedAt` + `businessType`, the following are additive, non-breaking future features: Abandoned Cart, Reminder Notifications (WhatsApp / Email / Push), Saved Cart, Continue Shopping, Marketing Campaigns, Cart Analytics, Frequently Purchased, Repeat Last Order.

## 8. Regression rules (permanent)

- **Never** create another cart, another checkout, or duplicate order APIs.
- **Never** put pricing or order logic in the cart — reuse the workspace's Order / Pricing / Workflow / Subscription / Payment / Invoice engines.
- Engine extensions must be **additive & optional** so existing product carts keep working.

## 9. Checklist for every new Quantix workspace

- [ ] Use `useCartStore` (no new cart).
- [ ] Add an item-type adapter per [`item-adapter.ts`](../src/lib/cart/item-adapter.ts) (extend `kind` if needed).
- [ ] Selection UI = *Add to Cart*; never bypass the cart.
- [ ] Checkout consumes the cart and posts to the workspace's **existing** order API.
- [ ] Web and PWA share the adapter → identical orders.
- [ ] No new cart, no new checkout, no duplicate APIs, no engine changes.
