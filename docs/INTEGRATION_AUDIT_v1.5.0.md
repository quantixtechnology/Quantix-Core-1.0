# Integration Audit: Business Onboarding Wizard v1.5.0

**Date:** 2026-06-27  
**Status:** ❌ NOT INTEGRATED - CRITICAL GAPS FOUND

---

## AUDIT QUESTIONS & ANSWERS

### 1. Is it replacing the existing Business Creation flow?

**Answer:** ❌ NO

**Finding:**
- Old creation dialog still exists in `BusinessesView` (line 767-970)
- Dialog has inline form with manual plan selection
- Old `handleCreateBusiness()` function creates business without provisioning
- **New wizard is completely separate, not integrated**

### 2. Is it connected to the Business menu?

**Answer:** ❌ NO

**Finding:**
- "Create Business" button in BusinessesView opens OLD dialog (line 767)
- No menu link to new BusinessOnboardingWizard component
- New wizard exists in `/src/components/onboarding/` but unreachable from main menu
- Admin navigation doesn't include wizard as a separate route/view

### 3. Can a new Commerce Business be created completely from the UI?

**Answer:** ⚠️ PARTIAL

**Finding:**
- YES: Can create via old dialog
- NO: Cannot use new product-driven wizard from UI
- NO: No product selection in old dialog
- NO: No provisioning from old dialog
- **Flow is incomplete and outdated**

### 4. Can provisioning be triggered from the UI?

**Answer:** ❌ NO

**Finding:**
- Old dialog creates business without provisioning
- Provisioning APIs exist (`POST /api/admin/businesses/provision`)
- No UI component triggers provisioning after business creation
- **Provisioning step completely missing from current UI flow**

### 5. Does Open Workspace work after provisioning?

**Answer:** ❌ NO - FEATURE MISSING ENTIRELY

**Finding:**
- No "Open Workspace" button found in BusinessesView
- No function calls Runtime Registry to get workspace URL
- No routing based on Business.productCode
- No integration with ProductRuntimeRegistry
- **Complete feature does not exist yet**

### 6. Does Runtime Registry determine the destination?

**Answer:** ❌ NO - NOT IMPLEMENTED

**Finding:**
- ProductRuntimeRegistry exists and is functional
- No code calls it to resolve workspace URLs
- No integration with business workspace opening
- **Critical missing piece for workspace routing**

### 7. Are there any duplicate Business Creation screens remaining?

**Answer:** ✅ YES - OLD SCREEN IS DUPLICATE

**Finding:**
- Old dialog in BusinessesView (lines 767-970)
- New wizard component exists separately
- Both do similar functions but:
  - Old: Creates business, no provisioning, no product selection
  - New: Full workflow with product, plan, provisioning
- **Old screen should be replaced entirely**

---

## CRITICAL GAPS IDENTIFIED

### Gap 1: Navigation Integration ❌
- BusinessOnboardingWizard component created
- NOT integrated into main menu or routing
- No way for users to access it
- **Fix:** Add "onboarding" route to admin page.tsx case statement

### Gap 2: Old Dialog Still Active ❌
- Old business creation dialog still in BusinessesView
- Still being used instead of new wizard
- Incomplete flow (no provisioning, no product selection)
- **Fix:** Remove old dialog and replace "Create Business" button with link to wizard

### Gap 3: No Workspace Opening Feature ❌
- Completely missing from codebase
- No "Open Workspace" button
- No function to get workspace URL from Runtime Registry
- No routing based on Business.productCode
- **Fix:** Implement workspace opening with Runtime Registry lookup

### Gap 4: Provisioning Not Triggered from UI ❌
- APIs exist but not called from UI
- Users can't trigger provisioning from admin interface
- Only achievable via direct API call
- **Fix:** Wire up provisioning in wizard Step 4 (already exists in code)

### Gap 5: Product Registry Not Used ❌
- Old business creation doesn't use Product Registry
- No product selection in old flow
- Hardcoded plans instead of product-driven selection
- **Fix:** Remove old dialog entirely, use new wizard that already has product selection

---

## SUMMARY TABLE

| Item | Status | Location | Issue |
|------|--------|----------|-------|
| Wizard Component | ✅ Built | `src/components/onboarding/` | Not integrated |
| Step Components | ✅ Built | `src/components/onboarding/steps/` | Not integrated |
| Menu Integration | ❌ Missing | `src/app/page.tsx` | Wizard not linked |
| Old Dialog | ✅ Exists | `BusinessesView.tsx` | Should be removed |
| Provisioning APIs | ✅ Exist | `src/app/api/admin/businesses/provision` | Not called from UI |
| Workspace Opening | ❌ Missing | N/A | Needs implementation |
| Runtime Registry Integration | ❌ Missing | N/A | Needed for workspace routing |

---

## REQUIRED FIXES (BLOCKING)

### Fix 1: Add Wizard to Admin Navigation
**File:** `src/app/page.tsx`

**Change:**
```tsx
// Add import
const BusinessOnboardingWizard = dynamic(() => 
  import("@/components/onboarding/business-onboarding-wizard").then(m => ({ 
    default: m.BusinessOnboardingWizard 
  })), { loading: () => <PageLoader /> }
)

// Add to switch statement
case "create-business": return <BusinessOnboardingWizard />
```

**Impact:** Wizard becomes accessible from admin menu

### Fix 2: Replace "Create Business" Button
**File:** `src/components/admin/businesses/businesses-view.tsx`

**Change:**
- Remove old dialog creation (lines 767-970)
- Replace "Create Business" button with navigation to `?slug=create-business`
- Remove `formName`, `formSlug`, `formType`, `handleCreateBusiness` state/functions

**Impact:** Old flow replaced with new wizard

### Fix 3: Implement Workspace Opening
**File:** `src/components/admin/businesses/businesses-view.tsx` (business detail view)

**New Function:**
```tsx
const handleOpenWorkspace = async (business: BusinessApiData) => {
  if (!business.productCode) {
    toast.error("Business has no product assigned")
    return
  }

  try {
    // Get workspace URL from Runtime Registry
    const response = await fetch(
      `/api/admin/products/runtime/${encodeURIComponent(business.productCode)}`
    )
    const result = await response.json()
    
    if (!result.success || !result.data?.runtime?.workspaceUrl) {
      toast.error("Cannot determine workspace URL")
      return
    }

    // Build workspace URL
    const workspaceUrl = `${result.data.runtime.workspaceUrl}/${business.id}`
    window.open(workspaceUrl, '_blank')
  } catch (error) {
    toast.error("Failed to open workspace")
  }
}
```

**Add Button to Business Details:**
```tsx
<Button onClick={() => handleOpenWorkspace(selectedBusiness)}>
  Open Workspace
</Button>
```

**Impact:** Workspace launching via Runtime Registry

---

## INTEGRATION CHECKLIST

- [ ] Add wizard to navigation in page.tsx
- [ ] Test wizard navigation from admin menu
- [ ] Add "Open Workspace" button to business detail view
- [ ] Implement workspace opening function with Runtime Registry
- [ ] Test: Create business with wizard
- [ ] Test: Provisioning completes
- [ ] Test: Open Workspace button works
- [ ] Test: Commerce business opens Commerce dashboard
- [ ] Test: Laundry business opens Laundry dashboard
- [ ] Test: Car Wash business opens Car Wash dashboard
- [ ] Remove old business creation dialog
- [ ] Verify no duplicate code remains
- [ ] Build succeeds
- [ ] Create PR with fixes

---

## VERDICT

**The Business Onboarding Wizard is BUILT but NOT INTEGRATED.**

The component exists and works correctly when called directly, but:
- Users cannot access it from the admin menu
- Old dialog is still being used
- Workspace opening feature is completely missing
- No integration with Runtime Registry for workspace routing

**Next step:** Implement the 3 required fixes above to complete the integration.

---

**STATUS:** Ready for integration work (implementation is complete, integration is pending)
