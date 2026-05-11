# Task 4 — Wire Business Dashboard Views to Real API Data

## Agent: Main Developer
## Date: 2026-03-05

## Summary
Modified business dashboard views (Orders, Products, Customers, Categories) to use real API data instead of hardcoded demo data. Fixed several bugs in the existing code and added missing API routes.

## Changes Made

### 1. Created Product Update/Delete API Route
**File:** `src/app/api/core/storefront/products/[productId]/route.ts`
- **GET** `/api/core/storefront/products/[productId]` — Get single product with variants and category
- **PUT** `/api/core/storefront/products/[productId]` — Update product fields and variants (replaces all variants in a transaction)
- **DELETE** `/api/core/storefront/products/[productId]` — Delete product

### 2. Fixed Business Dashboard (`src/components/business/dashboard/business-dashboard.tsx`)
- **Bug Fix:** Added missing `useMemo` import (was only importing `useState, useEffect, useCallback`)
- **Bug Fix:** Changed `statsData` reference to `dashboardData` (the variable was misnamed)
- **Improvement:** `lowStockProducts` now computed from real API data instead of hardcoded `0`
- **Improvement:** `topProducts` now uses real product data instead of `Math.random()` for "sold" count

### 3. Fixed Customers View (`src/components/business/customers/customers-view.tsx`)
- **Bug Fix:** Removed unused `DEMO_BUSINESSES` import from `@/stores/admin-store`
- **Bug Fix:** Removed unused `useAdminStore` import
- **Improvement:** Added real order history fetching from API (`GET /api/core/orders?businessId=xxx&customerId=yyy`) when opening a customer detail sheet

### 4. Fixed Products View (`src/components/business/products/products-view.tsx`)
- **Added:** `updateProductMutation` — Calls `PUT /api/core/storefront/products/[productId]`
- **Added:** `deleteProductMutation` — Calls `DELETE /api/core/storefront/products/[productId]`
- **Improved:** `handleSaveProduct` for editing now calls the update API instead of just showing a toast
- **Improved:** `handleToggleAvailability` now calls the update API with new status instead of just showing a toast
- **Improved:** `handleDeleteProduct` now calls the delete API instead of just showing a toast
- **Improved:** `handleSaveVariant` now updates the entire product's variants via the update API

### 5. Verified Orders View (`src/components/business/orders/orders-view.tsx`)
- Already using real API data via `useOrders` hook and `useUpdateOrderStatus` mutation
- Gets `businessId` from `useBusinessContext()` and sets it as business context
- Maps API response fields to local Order type with `mapApiOrder()`
- Status updates work via `PUT /api/core/orders/[orderId]/status`

## API Routes Verified
All API routes properly support `businessId`:
1. ✅ `GET /api/core/orders` — Supports `businessId` query param
2. ✅ `GET /api/core/storefront/products` — Supports `businessId` query param and `x-business-id` header
3. ✅ `GET /api/core/storefront/categories` — Supports `businessId` query param and `x-business-id` header
4. ✅ `GET /api/core/businesses/[businessId]/customers` — Returns customers from path param
5. ✅ `GET /api/core/businesses/[businessId]/dashboard` — Returns real stats from database

## Remaining Demo Data Imports (Out of Scope)
These files still import from `@/lib/demo-data` but were not in the task scope:
- `src/components/business/settings/store-settings.tsx`
- `src/components/business/reports/reports-view.tsx`
- `src/components/business/pos/pos-view.tsx`

## Lint Status
✅ All lint checks pass
✅ Dev server compiles successfully
