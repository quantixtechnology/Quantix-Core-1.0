// POST /api/customer/auth/change-password
// Mobile: change password for logged-in customer. Requires Bearer token.
// Request:  { currentPassword, newPassword, confirmPassword }
// Response: { success, message }
export { POST } from '@/app/api/core/storefront/auth/change-password/route';
