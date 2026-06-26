// ============================================================================
// Production Configuration Validator
// Validates all required environment variables before deployment
// ============================================================================

export interface ConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  config: {
    database: boolean
    email: boolean
    payment: boolean
    authentication: boolean
    storage: boolean
  }
}

/**
 * Validate all production configuration
 */
export function validateProductionConfig(): ConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const config = {
    database: false,
    email: false,
    payment: false,
    authentication: false,
    storage: false,
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Database
  // ──────────────────────────────────────────────────────────────────────────
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    errors.push('DATABASE_URL is not configured')
  } else if (databaseUrl.includes('file:./') || databaseUrl.includes('file:/')) {
    warnings.push('DATABASE_URL is using SQLite file storage (not recommended for production)')
  } else if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    warnings.push('DATABASE_URL is pointing to localhost (check if this is intentional)')
  } else {
    config.database = true
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Email (SMTP)
  // ──────────────────────────────────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const mailFrom = process.env.MAIL_FROM

  if (!smtpHost) {
    errors.push('SMTP_HOST is not configured (required for transactional emails)')
  } else if (!smtpUser) {
    errors.push('SMTP_USER is not configured')
  } else if (!smtpPass) {
    errors.push('SMTP_PASS is not configured')
  } else if (!mailFrom) {
    errors.push('MAIL_FROM is not configured')
  } else {
    config.email = true
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Payment (Razorpay)
  // ──────────────────────────────────────────────────────────────────────────
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET
  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!razorpayKeyId) {
    errors.push('RAZORPAY_KEY_ID is not configured (required for payment processing)')
  } else if (razorpayKeyId.startsWith('rzp_test_')) {
    warnings.push('RAZORPAY_KEY_ID is using sandbox/test credentials (not production)')
  } else if (!razorpayKeyId.startsWith('rzp_live_')) {
    warnings.push('RAZORPAY_KEY_ID does not appear to be a valid key format')
  }

  if (!razorpayKeySecret) {
    errors.push('RAZORPAY_KEY_SECRET is not configured')
  }

  if (!razorpayWebhookSecret) {
    errors.push('RAZORPAY_WEBHOOK_SECRET is not configured')
  }

  if (razorpayKeyId?.startsWith('rzp_live_') && razorpayKeySecret && razorpayWebhookSecret) {
    config.payment = true
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Authentication
  // ──────────────────────────────────────────────────────────────────────────
  const credentialEncryptKey = process.env.CREDENTIAL_ENCRYPT_KEY

  if (!credentialEncryptKey) {
    errors.push('CREDENTIAL_ENCRYPT_KEY is not configured (required for credential encryption)')
  } else if (credentialEncryptKey.length < 32) {
    errors.push(`CREDENTIAL_ENCRYPT_KEY is too short (${credentialEncryptKey.length} chars, minimum 32)`)
  } else {
    config.authentication = true
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Storage
  // ──────────────────────────────────────────────────────────────────────────
  const uploadRoot = process.env.UPLOAD_ROOT

  if (!uploadRoot) {
    warnings.push('UPLOAD_ROOT not configured (will use ./public/uploads)')
  } else {
    config.storage = true
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public Domain
  // ──────────────────────────────────────────────────────────────────────────
  const publicDomain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN

  if (!publicDomain) {
    errors.push('NEXT_PUBLIC_STOREFRONT_DOMAIN is not configured')
  } else if (publicDomain.includes('localhost') || publicDomain === 'quantixtechnology.in') {
    warnings.push(`NEXT_PUBLIC_STOREFRONT_DOMAIN is set to ${publicDomain} (verify this is correct)`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  }
}

/**
 * Get production checklist status
 */
export function getProductionChecklist() {
  const validation = validateProductionConfig()

  return {
    status: validation.valid ? 'READY' : 'INCOMPLETE',
    checklist: [
      { item: 'Database configured', done: validation.config.database, critical: true },
      { item: 'Email (SMTP) configured', done: validation.config.email, critical: true },
      { item: 'Payment (Razorpay) configured', done: validation.config.payment, critical: true },
      { item: 'Authentication keys configured', done: validation.config.authentication, critical: true },
      { item: 'Storage configured', done: validation.config.storage, critical: false },
    ],
    errors: validation.errors,
    warnings: validation.warnings,
  }
}
