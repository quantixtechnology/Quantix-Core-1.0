// POST /api/customer/auth/create-password
// Mobile: set password for first time after OTP login. Requires Bearer token.
// Request:  { password, confirmPassword }
// Response: { success, message }
export { POST } from '@/app/api/core/storefront/auth/set-password/route';
