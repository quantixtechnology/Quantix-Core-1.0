# Task 2-b: Wire SalesView to Real API Data

## Agent: Full-Stack Developer

## Summary
Replaced mock data in SalesView with real API data, added POST endpoint for creating sales team members, and wired up the "Add Sales Rep" button to the API.

## Changes Made

### 1. POST endpoint — `/api/admin/sales-team/route.ts`
- Added `POST` handler alongside existing `GET`
- Accepts: `name`, `email`, `phone`, `region`, `target` (all required)
- Validates all fields present, returns 400 if missing
- Checks for duplicate email, returns 409 if exists
- Hashes default password `Quantix@123` using `hashPassword` from `@/lib/password-utils`
- Uses Prisma `$transaction` to atomically create:
  - `User` record (email, name, phone, passwordHash, authProvider: EMAIL_OTP, emailVerified: true, isActive: true)
  - `SalesTeamMember` record linked to the user (achieved defaults to 0)
- Returns the created `SalesTeamMember` record

### 2. SalesView rewrite — `src/components/admin/sales/sales-view.tsx`
**Removed:**
- Import of `salesTeam`, `leads`, `leadStageColors` from `@/components/dashboard/data`
- Import of `LeadStage` type from mock data
- All mock data objects: `repRenewals`, `repRecentActivity`, `repRevenueMonths`
- `ConversionFunnel` component (depended on mock leads data)
- `getLeadsForRep()` function (depended on mock leads data)
- Hardcoded references to `salesTeam` (mock array)

**Added:**
- Import `useEffect`, `useCallback` from React
- Import `getAuthHeaders` from `@/lib/admin-fetch`
- Import `toast` from `sonner`
- Import `Loader2` icon from lucide-react
- `salesTeam` as `useState<SalesRep[]>([])` — fetched from API
- `loading` state with spinner while fetching
- `adding` state for form submission loading indicator
- `fetchSalesTeam()` callback — GET `/api/admin/sales-team` on mount
- `handleAddSalesRep()` — POST `/api/admin/sales-team` with form data
  - Validates all fields filled
  - Shows toast on success/error
  - Refetches list on success
  - Closes dialog and resets form on success
- "Add Sales Rep" button shows loader during submission
- `getPerformanceLevel` handles `target === 0` edge case (returns "below")
- Grid cards use 3-column stats instead of 4 (removed renewals/active leads that depended on mock leads data)
- Detail sheet simplified: removed Assigned Leads, Conversion Funnel, Revenue Chart, Recent Activity sections that depended on mock data; kept Contact Info, Performance Overview, Key Metrics, Commission Details

### 3. Password utilities — verified
- `src/lib/password-utils.ts` exists with `hashPassword` function using bcryptjs
- Works correctly for hashing default passwords

## API Test Results
- GET `/api/admin/sales-team` → returns 2 existing reps from seed data
- POST with valid data → creates User + SalesTeamMember, returns 200
- POST with duplicate email → returns 409 "A user with this email already exists"
- POST with missing fields → returns 400 "Missing required fields: name, email, phone, region, target"

## Lint
- `bun run lint` passes with zero errors
