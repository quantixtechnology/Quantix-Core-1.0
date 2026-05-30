# Platform Image System

How product images are rendered consistently across every Quantix storefront website and mobile app.

---

## Architecture

```
Platform defaults (config layer)
        │
        ├── Web: src/config/product-image-config.ts
        │         └── PLATFORM_IMAGE_DEFAULTS
        │                   │
        │         resolveImageConfig(businessOverride?)
        │                   │
        │         useAdminStore.currentImageConfig   ← hydrated at storefront load
        │                   │
        │         StorefrontProductCard              ← reads config from store
        │                   │
        │         <ProductImage config={...} />      ← renders with config values
        │
        └── Flutter: lib/core/config/product_image_config.dart
                      └── ProductImageConfig.platform (const defaults)
                                │
                      ProductImageConfig.fromMap(ecommerceConfig.imageConfig)
                                │
                      ProductImageWidget(config: ...)  ← renders with config values
```

---

## Web Components

### `src/config/product-image-config.ts`

Single source of truth for all image display values. No magic numbers anywhere in image rendering code.

```ts
export interface ProductImageConfig {
  cardHeight:      number   // product card image zone height in px  (default: 112)
  padding:         number   // inner padding in px                   (default: 8)
  borderRadius:    number   // container border-radius in px         (default: 0)
  backgroundColor: string   // CSS color for the container           (default: '#ffffff')
  fitMode:         'contain' | 'cover'                              // (default: 'contain')
}
```

### `src/components/storefront/web/product-image.tsx`

Shared `<ProductImage>` used on every product surface:

| Feature | Implementation |
|---------|----------------|
| Skeleton while loading | `animate-pulse` gradient overlay, hidden on `onLoad` |
| Fade-in | `opacity: 0 → 1` via inline `transition: opacity 0.3s ease` |
| Lazy loading | `loading="lazy"` + `decoding="async"` |
| Error state | Emoji placeholder, no broken image icons |
| Config-driven styles | padding / bg / radius / fit from `ProductImageConfig` |

**Call-site pattern:**
```tsx
// Card surface — size set by parent zone, config from store
<ProductImage
  src={resolveImageUrl(images[0])}
  alt={product.name}
  fallbackEmoji="🥩"
  className="w-full h-full"
  config={currentImageConfig}   // from useAdminStore()
/>

// Detail page gallery — fills its aspect-square container
<ProductImage src={url} alt={name} className="w-full h-full" />

// Cart thumbnail — fixed 72×72
<ProductImage src={url} alt={name} className="w-[72px] h-[72px]" />
```

### `src/components/storefront/web/storefront-product-card.tsx`

**Single shared product card** — replaces the duplicate `ProductCard` that previously existed in both `storefront-home.tsx` and `storefront-category.tsx`.

Layout zones (all fixed; cards align regardless of content length):

```
┌─────────────────────────────┐
│  IMAGE ZONE                 │  height = currentImageConfig.cardHeight (default 112px)
│  (ProductImage fills this)  │
├─────────────────────────────┤
│  TITLE  (1 line, truncated) │
│  VARIANT / SHORT DESC       │
├─────────────────────────────┤
│  PRICE ──────── ACTION BTN  │  action = qty stepper (in-cart) or + button
└─────────────────────────────┘
```

Features included:
- VEG / NON-VEG / HALAL / freshnessTag badges (gated by business-type config)
- OUT OF STOCK overlay
- Discount % badge
- In-cart quantity stepper (shows when item is already in cart)

---

## Flutter Components

### `lib/core/config/product_image_config.dart`

```dart
const platform = ProductImageConfig(
  cardHeight:      120,
  padding:         8,
  borderRadius:    0,
  backgroundColor: Colors.white,
  fit:             BoxFit.contain,
  fallbackEmoji:   '📦',
);

// Business override from ecommerceConfig.imageConfig:
final config = ProductImageConfig.fromMap(
  storeContext.ecommerceConfig['imageConfig'] as Map<String, dynamic>?,
);
```

### `lib/core/widgets/product_image_widget.dart`

```dart
ProductImageWidget(
  imageUrl: ImageUrlUtils.resolve(product.images.firstOrNull),
  width: double.infinity,
  height: cfg.cardHeight,
  config: cfg,              // optional; defaults to ProductImageConfig.platform
)
```

| Feature | Implementation |
|---------|----------------|
| Shimmer while loading | `Shimmer.fromColors` via `placeholder:` |
| Fade-in | `FadeTransition` + `AnimationController` in `imageBuilder:` |
| Retry on error | `GestureDetector` → `CachedNetworkImage.evictFromCache` |
| Disk/memory cache | `CachedNetworkImage` handles both automatically |
| Config-driven | All sizing/styling from `ProductImageConfig` |

### `lib/core/utils/image_url_utils.dart`

Mirrors `src/lib/image-url.ts`:

```dart
ImageUrlUtils.resolve('/uploads/products/abc/image.jpg')
// → 'https://app.quantixtechnology.in/api/core/files/products/abc/image.jpg'

ImageUrlUtils.resolveAll(product.images)
// → List<String> with all nulls and empties stripped
```

---

## Business-Level Overrides

A business can customize product image appearance by setting `imageConfig` inside `business.settings.ecommerceConfig` (via the Business Admin → Store Settings panel, or directly in the database).

**Example — Green Mart (taller cards, more padding):**
```json
{
  "ecommerceConfig": {
    "imageConfig": {
      "cardHeight": 150,
      "padding": 12,
      "fitMode": "contain"
    }
  }
}
```

**Example — Arbaz Fresh Meat (compact cards for dense grid):**
```json
{
  "ecommerceConfig": {
    "imageConfig": {
      "cardHeight": 100,
      "padding": 4,
      "fitMode": "contain"
    }
  }
}
```

**How it flows to the UI:**

1. Storefront loads → `StorefrontContextLoader` calls `/api/core/storefront/store-context`
2. If `ecommerceConfig.imageConfig` is present, `setImageConfig()` is called on `useAdminStore`
3. `StorefrontProductCard` reads `currentImageConfig` from the store
4. `<ProductImage>` receives the merged config and renders with business values
5. Cards on home, category, and search all update automatically

Missing keys fall back to `PLATFORM_IMAGE_DEFAULTS`. No field is required.

---

## Image URL Resolution

Both web and Flutter use the same logic:

| Input | Output |
|-------|--------|
| `/uploads/products/x/img.jpg` | `/api/core/files/products/x/img.jpg` (web) or `https://app.../api/core/files/...` (Flutter) |
| `https://cdn.example.com/img.jpg` | unchanged (already absolute) |
| `null` / `""` | `""` / `null` — caller shows placeholder |

---

## Adding a New Business

No code changes required. When a new business is created:

1. Their storefront automatically uses `PLATFORM_IMAGE_DEFAULTS`
2. All shared components (`<ProductImage>`, `ProductImageWidget`) are already in use
3. Image URLs are resolved by the shared utilities
4. If they want custom sizing, add `imageConfig` to their `ecommerceConfig` settings

---

## Surfaces Using the Shared System

| Surface | Web component | Flutter widget |
|---------|--------------|----------------|
| Home featured grid | `StorefrontProductCard` | `ProductImageWidget` in `HomePage` |
| Category product grid | `StorefrontProductCard` | `ProductImageWidget` in `ProductsPage` |
| Product detail gallery | `<ProductImage>` | `ProductImageWidget` in `ProductDetailPage` |
| Search results | `StorefrontProductCard` | `ProductImageWidget` in `SearchPage` |
| Cart items | `<ProductImage>` | `ProductImageWidget` in `CartPage` |
| Cart drawer (web) | `<ProductImage>` | — |
