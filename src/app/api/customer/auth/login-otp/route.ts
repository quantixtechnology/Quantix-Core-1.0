// POST /api/customer/auth/login-otp
// Mobile: send OTP to customer email.
// Identical to /api/v1/auth/send-otp — proxied here for mobile namespace.
export { POST } from '@/app/api/core/storefront/auth/send-otp/route';
