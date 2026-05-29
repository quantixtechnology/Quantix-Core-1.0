// POST /api/customer/auth/forgot-password
// Mobile: send password reset link to customer email.
// Request:  { email, businessId } OR { email, businessSlug }
// Response: { success, message }
export { POST } from '@/app/api/core/storefront/auth/forgot-password/route';
