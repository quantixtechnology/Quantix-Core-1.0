---
Task ID: 1
Agent: Main Agent
Task: Fix Categories, Customers, and Products visibility for business-specific demo data

Work Log:
- Added business-specific dashboard data to demo-data.ts: DemoDashboardStats, DemoDailySales, DemoHourlySales, DemoRecentActivity, DemoTopProducts, DemoBusinessOrders for all 4 business types (standard_grocery, standard_laundry, pro_laundry, pro_carwash)
- Added 6 new export functions: getDemoDashboardStats, getDemoDailySales, getDemoHourlySales, getDemoRecentActivity, getDemoTopProducts, getDemoBusinessOrders
- Updated BusinessDashboard component to use context-aware demo data via demoBusinessId
- Added Product Catalog Overview section to Business Dashboard showing categories with emoji icons, product counts, and workflow type badges
- Added Top Products, Workflows Active, and Operations summary cards to dashboard bottom
- Updated Orders View to use business-specific demo orders as fallback with workflow badges
- Added PICKUP, APPOINTMENT, SUBSCRIPTION order types to Orders View
- Added workflow badge display on orders with WORKFLOW_CONFIGS color coding
- Verified lint passes with no errors
- Verified dev server runs and serves pages correctly

Stage Summary:
- Categories are now visible in Business Dashboard (Product Catalog Overview section) and Products View
- Sample customers are business-specific (laundry customers for laundry business, car wash customers for car wash, etc.)
- Products are visible in the Business Dashboard overview section with category cards showing workflow assignments
- Orders show business-specific data with workflow type badges
- All data switches correctly when using the Demo Switcher
