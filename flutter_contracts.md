# QUANTIX CUSTOMER APP — Flutter Contracts Freeze
**Status: READY FOR FLUTTER = YES**
**Frozen: 2026-05-24 | API Version: v1.0.0**
**Base URL: `https://{host}/api/v1`**
**OpenAPI: `openapi/customer-v1.yaml`**
**DTO Source: `src/contracts/flutter/index.ts`**

---

## 1. API VERIFICATION TABLE

| Module | Endpoint | Method | Auth | Tenant | Store | Status | Issue |
|---|---|---|---|---|---|---|---|
| **Bootstrap** | `/stores/context` | GET | None | businessId param | storeId param | ✅ READY | — |
| **Bootstrap** | `/stores/nearest` | GET | None | businessId param | — | ✅ READY | — |
| **Bootstrap** | `/stores/nearest` | POST | None | businessId body | — | ✅ READY | — |
| **Bootstrap** | `/app/version` | GET | None | — | — | ✅ READY | — |
| **Auth** | `/auth/send-otp` | POST | None | businessId body | storeId body | ✅ READY | Rate-limited 5/hr |
| **Auth** | `/auth/verify` | POST | None | businessId body | — | ✅ READY | Returns JWT |
| **Profile** | `/profile` | GET | JWT | From JWT | — | ✅ READY | — |
| **Profile** | `/profile` | PUT | JWT | From JWT | — | ✅ READY | Phone 409 check |
| **Addresses** | `/addresses` | GET | JWT | From JWT | — | ✅ READY | — |
| **Addresses** | `/addresses` | POST | JWT | From JWT | — | ✅ READY | Auto-default if first |
| **Addresses** | `/addresses/{id}` | PATCH | JWT | From JWT | — | ✅ READY | — |
| **Addresses** | `/addresses/{id}` | DELETE | JWT | From JWT | — | ✅ READY | Auto-promote next default |
| **Categories** | `/categories` | GET | None | businessId param | — | ✅ READY | Hierarchical tree |
| **Products** | `/products` | GET | None | businessId param | storeId param | ✅ READY | Paginated |
| **Products** | `/products/{id}` | GET | None | From product | — | ✅ READY | — |
| **Cart** | `/cart` | GET | JWT | From JWT | storeId param | ✅ READY | Enriched response |
| **Cart** | `/cart` | POST | JWT | From JWT | storeId body | ✅ READY | Auto-increments qty |
| **Cart** | `/cart` | PATCH | JWT | From JWT | — | ✅ READY | 0 qty = remove |
| **Cart** | `/cart` | DELETE | JWT | From JWT | — | ✅ READY | itemId or clear=true |
| **Coupons** | `/coupons` | GET | JWT | From JWT | — | ✅ READY | usageLeft computed |
| **Orders** | `/orders` | GET | JWT | From JWT | — | ✅ READY | Last 30 |
| **Checkout** | `/orders` | POST | JWT | From JWT | storeId body | ✅ READY | Full promo validation |
| **Orders** | `/orders/{id}/track` | GET | None | — | — | ✅ READY | Full status history |
| **Tracking** | `/orders/{id}/live` | GET | None | — | — | ✅ READY | Partner GPS + ETA |
| **Tracking** | `/orders/{id}/eta` | GET | None | — | — | ✅ READY | Lightweight ETA only |
| **Notifications** | `/notifications` | GET | JWT | From JWT | — | ✅ READY | Paginated |
| **Notifications** | `/notifications/{id}/read` | PATCH | JWT | From JWT | — | ✅ READY | — |
| **Notifications** | `/notifications/read-all` | POST | JWT | From JWT | — | ✅ READY | — |
| **Devices** | `/devices/register` | POST | JWT | From JWT | — | ✅ READY | Multi-device FCM |
| **Devices** | `/devices/unregister` | DELETE | JWT | From JWT | — | ✅ READY | — |
| **CMS** | `/storefront/banners` | GET | None | businessId param | storeId param | ✅ READY | Date-gated |
| **CMS** | `/storefront/promotions` | GET | None | businessId param | — | ✅ READY | Usage-filtered |
| **Payments** | (via `/stores/context`) | GET | None | — | — | ✅ READY | Gateway list returned |
| **Settings** | `/stores/context` | GET | None | — | — | ✅ READY | Full branding config |

**BLOCKERS LEFT: 0**
**MISSING ITEMS: 0**

---

## 2. DTO CONTRACTS

See `src/contracts/flutter/index.ts` for full TypeScript definitions.

### AuthSession
```typescript
{ token, refreshToken, expiresAt, user: { id, email, name, phone, role, businessId } }
```

### CustomerProfile
```typescript
{ id, name, email, phone, avatar, gstNumber, loyaltyTier, loyaltyPoints, totalOrders, totalSpent }
```

### AddressDTO
```typescript
{ id, customerId, label, area, addressLine1, addressLine2, landmark, city, state, pincode,
  country, latitude, longitude, gpsAccuracy, instructions, isDefault, createdAt, updatedAt }
```

### ProductDTO
```typescript
{ id, businessId, categoryId, name, slug, description, shortDesc, type, status, sku,
  images: string[], unit, unitQuantity, isVeg, isFeatured, isPopular, preparationTime,
  minOrderQty, maxOrderQty, tags: string[], workflowType, sortOrder,
  defaultPrice, defaultMrp, stockStatus, availableStock, hasInventory,
  category: CategoryDTO | null, variants: VariantDTO[], metadata, createdAt, updatedAt }
```

### VariantDTO
```typescript
{ id, name, sku, price, mrp, discountPrice, discountPercent, isDefault, isActive,
  attributes: Record<string,string>, stock: number | null }
```

### CartDTO
```typescript
{ success, data: CartItemDTO[], total: number, itemCount: number }
// CartItemDTO: { id, productId, variantId, storeId, quantity, unitPrice, lineTotal,
//               availableQty, inventoryStatus, product: {...}, variant: {...} | null }
```

### OrderDTO
```typescript
{ id, businessId, storeId, orderNumber, orderType, orderSource, status, paymentStatus,
  paymentMethod, subtotal, totalTax, deliveryFee, totalDiscount, totalAmount,
  promoCodeId, deliveryAddress, deliveryLat, deliveryLng, notes,
  createdAt, confirmedAt, deliveredAt, items: OrderItemDTO[] }
```

### OrderTrackingDTO
Full tracking shape including statusHistory[], delivery.partner, delivery.liveTracking[], payments[].

### LiveTrackingDTO
```typescript
{ order: {...}, partner: PartnerTrackingSummary | null,
  location: { lat, lng, timestamp } | null,
  eta: "12 mins" | null, etaMinutes, distanceKm, estimatedArrival, deliveryStatus, isLive }
```

### NotificationDTO
```typescript
{ id, type, channel, title, message, data: object | null, isRead, readAt, sentAt, createdAt }
```

### BannerDTO
```typescript
{ id, title, imageUrl, link, sortOrder, startDate, endDate }
```

---

## 3. WEBSOCKET CONTRACT FREEZE

**Connection:** `ws://{host}:3003`
**Auth:** Pass JWT as `auth.token` in Socket.IO handshake options.

### Room Subscription Rules (Customer App)

| Room | When to join | Purpose |
|---|---|---|
| `user:{userId}` | After login | Personal notifications, order updates |
| `order:{orderId}` | After order creation | Real-time status + live tracking for that order |

### Events the Customer App Receives

#### `order:status_changed`
```json
{
  "orderId": "clxxx",
  "orderNumber": "ORD-20250524-001",
  "previousStatus": "PREPARING",
  "newStatus": "OUT_FOR_DELIVERY",
  "note": "Your order is on the way!",
  "businessId": "clbiz",
  "storeId": "clstore",
  "customerId": "clcust",
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```
→ **Action:** Refresh order state, show status toast, update tracking screen.

#### `delivery:location_updated`
```json
{
  "orderId": "clxxx",
  "partnerId": "clpart",
  "partnerName": "Rajan Kumar",
  "lat": 12.9716,
  "lng": 77.5946,
  "accuracy": 5.2,
  "heading": 180.0,
  "speed": 8.3,
  "etaMinutes": 7,
  "distanceKm": 2.3,
  "businessId": "clbiz",
  "timestamp": "2026-05-24T10:31:00.000Z"
}
```
→ **Action:** Animate marker on Google Map, update ETA chip. (Do NOT poll `/live` when receiving this event.)

#### `partner:assigned`
```json
{
  "orderId": "clxxx",
  "orderNumber": "ORD-20250524-001",
  "partnerId": "clpart",
  "partnerName": "Rajan Kumar",
  "partnerPhone": "+919876543210",
  "businessId": "clbiz",
  "timestamp": "2026-05-24T10:29:00.000Z"
}
```
→ **Action:** Show partner card on tracking screen.

#### `tracking:eta_updated`
```json
{
  "orderId": "clxxx",
  "etaMinutes": 5,
  "distanceKm": 1.7,
  "estimatedArrival": "2026-05-24T10:36:00.000Z",
  "timestamp": "2026-05-24T10:31:30.000Z"
}
```
→ **Action:** Update ETA display without full map re-render.

#### `notification:new`
```json
{
  "notificationId": "clnotif",
  "type": "ORDER_STATUS",
  "title": "Order Confirmed",
  "message": "Your order #ORD-20250524-001 is confirmed",
  "data": { "orderId": "clxxx", "orderNumber": "ORD-20250524-001" },
  "userId": "clusr",
  "timestamp": "2026-05-24T10:28:00.000Z"
}
```
→ **Action:** Show in-app notification banner, increment badge count.

### WebSocket Polling Fallback
If WebSocket is unavailable, Flutter should poll:
- `/orders/{orderId}/live` every **5 seconds** while on tracking screen
- `/notifications` on app foreground resume

---

## 4. GOOGLE MAPS READINESS

| Data Point | Source | Status |
|---|---|---|
| Store lat/lng | `StoreDTO.latitude` + `StoreDTO.longitude` (via `/stores/context` or `/stores/nearest`) | ✅ READY |
| Customer address lat/lng | `AddressDTO.latitude` + `AddressDTO.longitude` + `gpsAccuracy` | ✅ READY |
| Partner live location | `LiveTrackingDTO.location.{lat,lng}` (from `/orders/{id}/live`) | ✅ READY |
| Partner GPS stream | `delivery:location_updated` WebSocket event | ✅ READY |
| ETA calculation | Haversine @ 20 km/h, returned as `etaMinutes` + `distanceKm` | ✅ READY |
| Route polyline | ❌ NOT IMPLEMENTED — Flutter must call Google Directions API directly | Flutter-side |
| Nearest store detection | `/stores/nearest?lat=&lng=` uses Haversine server-side | ✅ READY |
| Delivery radius check | `StoreDTO.deliveryRadius` (km) + Haversine server-side | ✅ READY |

**Google Maps Keys needed in Flutter:**
- `GOOGLE_MAPS_ANDROID_API_KEY` — AndroidManifest.xml
- `GOOGLE_MAPS_IOS_API_KEY` — AppDelegate.swift
- `GOOGLE_DIRECTIONS_API_KEY` — for route polyline (Directions API, enable separately)

---

## 5. FLUTTER APP ARCHITECTURE

```
apps/
  customer_app/
    lib/
      core/
        api/           # Dio client, interceptors, base URLs
        auth/          # JWT storage (FlutterSecureStorage)
        socket/        # Socket.IO client, room subscriptions
        models/        # Freezed DTOs matching src/contracts/flutter/index.ts
        router/        # GoRouter config
        theme/         # Dynamic theming from business branding
      features/
        bootstrap/     # StoreContext load → businessId + storeId resolution
        auth/          # OTP flow (send + verify), session persistence
        home/          # Banners, featured products, categories
        catalog/       # Product listing (paginated), product detail
        cart/          # Cart management, coupon application
        checkout/      # Order creation, address select, payment method
        orders/        # Order history list
        tracking/      # Order track page + live GPS map
        notifications/ # Notification list, read/unread, FCM integration
        profile/       # Customer profile + address book
      main.dart
```

### Feature → API → DTO → Socket → Cache Map

| Feature | APIs Used | DTO | Socket Events | Cache Strategy |
|---|---|---|---|---|
| bootstrap | `/stores/context`, `/app/version` | `StoreContextResponse`, `AppVersionDTO` | — | Hive (15 min TTL) |
| auth | `/auth/send-otp`, `/auth/verify` | `AuthSession` | — | FlutterSecureStorage |
| home | `/storefront/banners`, `/products?isFeatured=true`, `/categories` | `BannerDTO[]`, `ProductDTO[]`, `CategoryDTO[]` | — | Hive (5 min TTL) |
| catalog | `/products`, `/products/{id}` | `ProductDTO` (paginated) | — | Riverpod cache |
| cart | `/cart` (GET/POST/PATCH/DELETE), `/coupons` | `CartDTO`, `CouponDTO[]` | — | Local + server sync |
| checkout | `/orders` POST, `/addresses` | `CreateOrderRequest`, `OrderDTO` | — | None (write-only) |
| orders | `/orders` GET | `OrderDTO[]` | `order:status_changed` | Riverpod 2 min TTL |
| tracking | `/orders/{id}/track`, `/orders/{id}/live` | `OrderTrackingDTO`, `LiveTrackingDTO` | `delivery:location_updated`, `partner:assigned`, `tracking:eta_updated`, `order:status_changed` | Real-time (no cache) |
| notifications | `/notifications` (paginated), PATCH read, POST read-all | `NotificationDTO[]` | `notification:new` | Riverpod + badge count |
| profile | `/profile` GET/PUT, `/addresses` CRUD | `CustomerProfile`, `AddressDTO[]` | — | Riverpod |
| devices | `/devices/register`, `/devices/unregister` | `DeviceRegisterRequest` | — | None |

### Recommended Stack

```yaml
dependencies:
  flutter_riverpod: ^2.x          # State management
  riverpod_annotation: ^2.x       # Code generation
  go_router: ^14.x                # Routing
  dio: ^5.x                       # HTTP client
  retrofit: ^4.x                  # API generation from OpenAPI
  freezed: ^2.x                   # Immutable models
  json_serializable: ^6.x         # JSON codegen
  socket_io_client: ^2.x          # WebSocket / Socket.IO
  firebase_messaging: ^15.x       # FCM push notifications
  google_maps_flutter: ^2.x       # Maps
  flutter_secure_storage: ^9.x    # JWT storage
  hive_flutter: ^1.x              # Local cache (banners, context)
  cached_network_image: ^3.x      # Product/banner images
  intl: ^0.19.x                   # Date/currency formatting
```

### Offline Strategy

| Data | Offline Behavior |
|---|---|
| Store context | Serve cached (Hive), show stale banner if >15 min |
| Product catalog | Serve cached list, disable add-to-cart if offline |
| Cart | Keep local, sync on reconnect |
| Orders | Show cached list with "Last synced at..." |
| Tracking | Show last known position, disable live if no WebSocket |
| Notifications | Show cached list, defer read-marking |

---

## 6. AUTH FLOW (Flutter)

```
App Launch
  ↓
GET /stores/context?businessId={bid}      → Hydrate branding + storeId
  ↓
GET /app/version?platform=android         → Force-update gate
  ↓ (if not forced)
Check FlutterSecureStorage for JWT
  ↓ (no token)
Auth Screen:
  POST /auth/send-otp  { email, businessId }   → OTP via email
  POST /auth/verify    { email, code, phone? }  → JWT + user
  Store JWT in FlutterSecureStorage
  ↓ (token exists)
Validate JWT (check expiresAt client-side)
  ↓ (expired → re-auth, valid → proceed)
POST /devices/register { fcmToken, platform, deviceId }
  ↓
Navigate to Home
```

---

## 7. CHECKOUT FLOW (Flutter)

```
Cart Screen → Review items, apply coupon (/coupons or /storefront/promotions)
  ↓
Select delivery address from /addresses (or add new)
  ↓
GET /stores/nearest or use stored storeId → resolve deliveryFee
  ↓
POST /orders {
  storeId, orderType, items, deliveryAddressId,
  deliveryFee, promoCodeId, paymentMethod
}
  ↓
201 → Navigate to Order Tracking screen
422 (OUT_OF_STOCK) → Show stock error, refresh cart
400 (promo expired) → Clear promoCodeId, retry
  ↓
(if payment online) → Handle Razorpay/Cashfree modal
  ↓
Subscribe to `order:{orderId}` WebSocket room
Listen for `order:status_changed`
```

---

## 8. LIVE TRACKING FLOW (Flutter)

```
Navigate to Tracking screen with orderId
  ↓
GET /orders/{id}/track → Full order + partner + history
  ↓
Connect Socket.IO, join room `order:{orderId}`
  ↓
Listen: `delivery:location_updated` → animate marker on GoogleMap
Listen: `partner:assigned`         → show partner card
Listen: `tracking:eta_updated`     → update ETA chip
Listen: `order:status_changed`     → update status bar
  ↓
If WebSocket fails → poll GET /orders/{id}/live every 5s
  ↓
On `status === DELIVERED` → leave room, show "Delivered" state
```

---

## 9. PAYMENT INTEGRATION NOTES

Payment gateway info is returned from `/stores/context` as `paymentGateways[]`.
Each gateway has `{ id, name, gateway, isTestMode }`.

**Supported gateways (detected by `gateway` field):**
- `RAZORPAY` — use `razorpay_flutter` package
- `CASHFREE` — use `cashfree_pg` package
- `PAYU` — use WebView integration
- `COD` — no gateway, just set `paymentMethod: 'COD'` in order creation

**Flow:**
1. Create order (`POST /orders`) → get `orderId` + `totalAmount`
2. Initiate gateway payment on client with `totalAmount`
3. On gateway callback success → update order payment status via webhook (server-side, automatic)
4. Flutter listens for `payment:received` WebSocket event OR polls `/orders/{id}/track`

---

## 10. FCM PUSH NOTIFICATION SETUP

**On login:**
```dart
final token = await FirebaseMessaging.instance.getToken();
await api.post('/devices/register', {
  'fcmToken': token,
  'platform': Platform.isAndroid ? 'ANDROID' : 'IOS',
  'deviceId': deviceId,
  'appVersion': packageInfo.version,
});
```

**On token refresh:**
```dart
FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
  api.post('/devices/register', { 'fcmToken': newToken, ... });
});
```

**On logout:**
```dart
await api.delete('/devices/unregister?fcmToken=$token');
```

**Notification routing by `type`:**
| type | Navigate to |
|---|---|
| `ORDER_STATUS` | `/orders/{data.orderId}/track` |
| `DELIVERY` | `/tracking/{data.orderId}` |
| `PROMO` | `/catalog` or `/cart` |
| `PAYMENT` | `/orders/{data.orderId}` |
| `SYSTEM` | `/notifications` |

---

## FINAL CHECKLIST

- [x] All v1 endpoints verified and routed
- [x] OpenAPI spec generated (`openapi/customer-v1.yaml`)
- [x] TypeScript DTO contracts frozen (`src/contracts/flutter/index.ts`)
- [x] WebSocket events documented with payload shapes
- [x] Google Maps data points confirmed
- [x] FCM multi-device support live
- [x] Promo validation complete (all 4 types + limits)
- [x] TypeScript check clean (0 errors)
- [x] Committed and pushed to `main`

**READY FOR FLUTTER = YES**
