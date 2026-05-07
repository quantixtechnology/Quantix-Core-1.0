# Task: Create ReportsView and StoreSettingsView Components

## Agent: Full Stack Developer
## Date: 2026-05-07

## Summary
Created two comprehensive view components for the Quantix Core Platform Business Owner panel:

### 1. ReportsView (`src/components/business/reports/reports-view.tsx`)
- **Page Header**: "Reports" title with date range selector (1d/7d/30d/90d) and Export button
- **Sales Tab**: 
  - 4 stat cards (Today Revenue, This Week, This Month, Avg Daily)
  - Daily sales bar chart (7 days) with ChartContainer/recharts
  - Hourly breakdown bar chart
- **Orders Tab**:
  - 4 stat cards (Total Orders, Delivery Orders, POS Orders, Cancelled Rate)
  - Order type distribution pie chart (Delivery/POS/Takeaway)
  - Order status breakdown table with badges
- **Products Tab**:
  - Top products table with rank, name, units sold, revenue, avg rating
  - Category-wise revenue breakdown with progress bars
- **Payments Tab**:
  - Payment method distribution pie chart with custom colors
  - Payment summary table with totals row
  - UPI vs Cash vs Card comparison cards with progress bars

### 2. StoreSettingsView (`src/components/business/settings/store-settings.tsx`)
- **Page Header**: "Store Settings" title
- **General Tab**:
  - Store name, phone, email, address inputs
  - Store availability toggle (Online/Offline) with badge
  - Store timing table (7 days with time inputs and closed toggles)
  - Min order amount and preparation time inputs
  - Save/Reset buttons
- **Delivery Tab**:
  - Delivery radius with visual slider bar
  - Delivery fee and free delivery threshold inputs
  - Delivery partners table with status badges and ratings
  - Delivery zones placeholder with dashed border area
  - Save/Reset buttons
- **Taxes Tab**:
  - GST registration number input
  - GST rates table (0%, 5%, 12%, 18%, 28%) with enable/disable toggles
  - Default GST rate select (filtered by enabled rates)
  - Include GST in price toggle
  - GSTIN by state table (3 states) with add button
  - Save/Reset buttons
- **Printer Tab**:
  - Paper size select (58mm, 80mm, A4)
  - Printer type select (Thermal, Bluetooth, USB, Network)
  - Auto-print on order toggle
  - Print receipt on payment toggle
  - Include QR code toggle
  - Receipt header and footer textareas
  - Number of copies select
  - Save/Reset buttons

### 3. Updated `page.tsx`
- Integrated both views with the BusinessLayout
- Switches between super_admin and business_owner views
- Reports page maps to ReportsView
- Settings page maps to StoreSettingsView

## Technical Details
- All components use "use client" directive
- Data sourced from existing `@/components/business/data.ts`
- Uses shadcn/ui components (Card, Table, Tabs, Switch, Select, etc.)
- Uses recharts with ChartContainer for all charts
- Uses PageHeader and StatCard shared components
- Lint passes with zero errors
- App compiles and serves correctly on localhost:3000
