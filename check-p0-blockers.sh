#!/bin/bash

echo "=== P0 BLOCKER CHECKS ==="
echo ""

echo "1. Email Configuration:"
grep -q "SMTP_HOST\|SMTP_USER\|SMTP_PASS" .env 2>/dev/null && echo "✅ Email vars in .env" || echo "❌ Email vars MISSING from .env"

echo ""
echo "2. Payment Configuration:"
grep -q "RAZORPAY\|STRIPE" .env 2>/dev/null && echo "✅ Payment vars in .env" || echo "❌ Payment vars MISSING from .env"

echo ""
echo "3. Database:"
test -f db/custom.db && echo "✅ Database file exists" || echo "❌ Database file MISSING"

echo ""
echo "4. Product Provisioners Registered:"
grep -r "ProductProvisionerRegistry.register" src --include="*.ts" | wc -l | awk '{if ($1 > 0) print "✅ Provisioners registered: " $1; else print "❌ NO provisioners registered"}'

echo ""
echo "5. Product Runtime Config:"
grep -r "registerRuntime\|ProductRuntimeRegistry.register" src --include="*.ts" | wc -l | awk '{if ($1 > 0) print "✅ Runtime configs registered: " $1; else print "❌ NO runtime configs"}'

echo ""
echo "6. Business Creation API:"
test -f src/app/api/admin/businesses/route.ts && echo "✅ Business creation API exists" || echo "❌ Business creation API MISSING"

echo ""
echo "7. Provisioning API:"
test -f src/app/api/admin/businesses/provision/route.ts && echo "✅ Provisioning API exists" || echo "❌ Provisioning API MISSING"

echo ""
echo "8. Workspace Launch Code:"
grep -q "handleOpenWorkspace\|workspaceUrl" src/components/admin/businesses/businesses-view.tsx && echo "✅ Workspace launch implemented" || echo "❌ Workspace launch NOT implemented"

echo ""
