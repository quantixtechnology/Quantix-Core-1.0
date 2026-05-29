// POST /api/customer/auth/validate-reset-token
// Mobile: check if a password reset token is valid before showing reset form.
// Request:  { token }
// Response: { success, valid }
export { POST } from '@/app/api/core/storefront/auth/validate-reset-token/route';
