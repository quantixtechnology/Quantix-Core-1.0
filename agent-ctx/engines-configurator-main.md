# Task: Business Model Configurator Components

## Summary
Created 2 business model configurator components in `/home/z/my-project/src/components/engines/` and integrated them into the main page.

## Files Created/Modified

### 1. `/home/z/my-project/src/components/engines/laundry-configurator.tsx`
- **Export**: `LaundryConfiguratorView`
- **3 Tabs**:
  - **Subscription Wash Model** — Uses Subscription Engine + Dynamic Billing Engine + Pickup & Drop Engine. Plan configuration with Basic/Standard/Premium tiers, weight tracking examples, workflow steps, settings.
  - **Standard Piece-Based Wash** — Uses Ecommerce Engine + Pickup & Drop Engine. Service catalog table with 8 item types, order flow, settings.
  - **Weight-Based Wash** — Uses Dynamic Billing Engine + Pickup & Drop Engine + Approval Workflow Engine. Pricing tiers, workflow with customer approval step, approval workflow config, settings.

### 2. `/home/z/my-project/src/components/engines/carwash-configurator.tsx`
- **Export**: `CarwashConfiguratorView`
- **3 Tabs**:
  - **Subscription Service Plans** — Uses Subscription Engine. Credit-based plans with external_wash/internal_wash/detailing credits, credit tracking, expiry & renewal config.
  - **Standard Service Booking** — Uses Service Booking Engine + Pickup & Drop Engine. Service catalog with 7 services, booking flow, slot settings.
  - **Ecommerce Accessories** — Uses Ecommerce Engine. Product catalog with 6 products, order flow, delivery settings.

### 3. `/home/z/my-project/src/app/page.tsx`
- Replaced with a clean layout that shows both configurators via a top-level tab switcher (Laundry Business / Car & Bike Wash).

## Style Conventions
- All text compact (`text-xs` for labels/data, `text-sm` for section headers)
- Emerald-600/700 for active/primary colors
- Engine tags using Badge with `variant="outline"` and emerald colors
- Workflow steps as horizontal flow with arrows using flex layout
- Cards with clean spacing (`p-4`, `gap-3`)
- No emoji in component text
- Inline mock data, no API calls
- 'use client' directive on all components

## Verification
- Lint passes clean (`bun run lint` - no errors)
- Dev server compiles and serves the page successfully (200 responses)
