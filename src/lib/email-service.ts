// ============================================================================
// QUANTIX CORE — Email Service (Nodemailer / Gmail SMTP)
//
// Required .env keys — NO hardcoded fallbacks:
//   SMTP_HOST   smtp.gmail.com
//   SMTP_PORT   465          (465 = SMTPS/secure, 587 = STARTTLS)
//   SMTP_USER   otp@quantixtechnology.in
//   SMTP_PASS   <Gmail App Password — 16 chars, no spaces>
//   MAIL_FROM   "Quantix OTP <otp@quantixtechnology.in>"
// ============================================================================

import nodemailer from 'nodemailer'

const OTP_VALIDITY_MINUTES = 10
const RETRY_ATTEMPTS = 2
const RETRY_DELAY_MS = 1500

// ── SMTP transport ───────────────────────────────────────────────────────────
// Rebuilt fresh every process start — no stale cached credentials.
// To pick up .env changes: npm run build && pm2 restart quantix --update-env

function buildTransport(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  const port = Number(process.env.SMTP_PORT)
  if (!port) {
    console.error('[email-service] SMTP_PORT is missing or invalid in .env')
    return null
  }

  // Port 465 = implicit TLS (secure:true). Port 587/25 = STARTTLS (secure:false).
  const secure = port === 465

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout:   8_000,
    socketTimeout:     15_000,
  })
}

let _transport: nodemailer.Transporter | null = null

function getTransport(): nodemailer.Transporter | null {
  if (!_transport) _transport = buildTransport()
  return _transport
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PORT)
}

// MAIL_FROM only — no fallback chain, no hardcoded addresses.
function defaultFrom(): string {
  const from = process.env.MAIL_FROM
  if (!from) console.error('[email-service] MAIL_FROM is not set in .env')
  return from ?? ''
}

// ── OTP HTML template ────────────────────────────────────────────────────────

function buildOtpHtml(otp: string, businessName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${businessName} — Login OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px 40px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;font-weight:600;">Quantix Technology</p>
              <h1 style="margin:6px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;font-weight:500;">Your login verification code</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.5;">
                Enter the code below to sign in to your account.
              </p>

              <!-- OTP Block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:28px 24px;">
                    <p style="margin:0 0 8px;font-size:12px;color:#059669;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:12px;color:#064e3b;font-family:'Courier New',Courier,monospace;line-height:1;">${otp}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:0;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏱ This code is valid for <strong>${OTP_VALIDITY_MINUTES} minutes</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not request this code, you can safely ignore this email.
                Someone may have typed your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <strong style="color:#10b981;">Quantix Technology</strong>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">
                © ${new Date().getFullYear()} Quantix Technology. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildOtpText(otp: string, businessName: string): string {
  return [
    `${businessName} — Login OTP`,
    '',
    `Your verification code is: ${otp}`,
    '',
    `This code is valid for ${OTP_VALIDITY_MINUTES} minutes.`,
    '',
    'If you did not request this OTP, please ignore this email.',
    '',
    'Powered by Quantix Technology',
  ].join('\n')
}

// ── Retry helper ─────────────────────────────────────────────────────────────

async function sendWithRetry(
  transport: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
): Promise<void> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS + 1; attempt++) {
    try {
      await transport.sendMail(mailOptions)
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt <= RETRY_ATTEMPTS) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
      }
    }
  }
  throw lastError
}

// ── Primary export: sendOTPEmail ─────────────────────────────────────────────

export interface OTPEmailOptions {
  to: string
  otp: string
  businessName: string
  storeId?: string
  tenantId?: string
}

export async function sendOTPEmail(opts: OTPEmailOptions): Promise<{ sent: boolean; error?: string }> {
  const { to, otp, businessName, storeId, tenantId } = opts

  const transport = getTransport()
  if (!transport) {
    console.warn('[OTP EMAIL] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env')
    return { sent: false, error: 'SMTP not configured' }
  }

  const subject = `${businessName} - Login OTP`

  try {
    await sendWithRetry(transport, {
      from:    defaultFrom(),
      to,
      subject,
      text:    buildOtpText(otp, businessName),
      html:    buildOtpHtml(otp, businessName),
    })

    console.log(
      '[OTP EMAIL SENT]',
      `Tenant: ${tenantId ?? '—'}`,
      `| Business: ${businessName}`,
      `| Store: ${storeId ?? '—'}`,
      `| Recipient: ${to}`,
    )
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SMTP send failed'
    console.error('[OTP EMAIL ERROR]', `Recipient: ${to}`, `| Error: ${msg}`)
    return { sent: false, error: msg }
  }
}

// ── Backward-compat alias (used by legacy auth routes) ───────────────────────

export async function sendEmailOtp(
  to: string,
  code: string,
  storeName: string = 'Quantix',
  _fromOverride?: string,          // retained for signature compat, ignored
): Promise<{ sent: boolean; error?: string }> {
  return sendOTPEmail({ to, otp: code, businessName: storeName })
}

// ── Password reset email template ────────────────────────────────────────────

function buildPasswordResetHtml(resetLink: string, businessName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${businessName} — Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px 40px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;font-weight:600;">Quantix Technology</p>
              <h1 style="margin:6px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;font-weight:500;">Reset your password</p>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.5;">
                We received a request to reset your account password. Click the button below to create a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏱ This link is valid for <strong>15 minutes</strong>. If it expires, request a new one.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Or copy and paste this link in your browser:</p>
              <p style="margin:0 0 20px;font-size:12px;color:#6b7280;word-break:break-all;">${resetLink}</p>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <strong style="color:#10b981;">Quantix Technology</strong>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">
                © ${new Date().getFullYear()} Quantix Technology. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface PasswordResetEmailOptions {
  to: string
  resetLink: string
  businessName: string
}

export async function sendPasswordResetEmail(opts: PasswordResetEmailOptions): Promise<{ sent: boolean; error?: string }> {
  const { to, resetLink, businessName } = opts

  const transport = getTransport()
  if (!transport) {
    console.warn('[PASSWORD RESET EMAIL] SMTP not configured')
    return { sent: false, error: 'SMTP not configured' }
  }

  try {
    await sendWithRetry(transport, {
      from:    defaultFrom(),
      to,
      subject: `Reset Your Password — ${businessName}`,
      html:    buildPasswordResetHtml(resetLink, businessName),
      text:    `Reset your password for ${businessName}.\n\nClick here: ${resetLink}\n\nThis link expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
    })
    console.log('[PASSWORD RESET EMAIL SENT]', `Business: ${businessName}`, `| Recipient: ${to}`)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SMTP send failed'
    console.error('[PASSWORD RESET EMAIL ERROR]', `Recipient: ${to}`, `| Error: ${msg}`)
    return { sent: false, error: msg }
  }
}

// ── Welcome email template ───────────────────────────────────────────────────

function buildWelcomeHtml(customerName: string, businessName: string, storefrontUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Welcome to ${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px 40px 28px;text-align:center;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;font-weight:600;">Welcome to</p>
              <h1 style="margin:6px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:600;">Hi ${customerName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
                Your account has been created and your password is set. You're all ready to shop at <strong>${businessName}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${storefrontUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Start Shopping</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you have any questions, reply to this email or contact us through the store.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <strong style="color:#10b981;">Quantix Technology</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export interface WelcomeEmailOptions {
  to: string
  customerName: string
  businessName: string
  storefrontUrl: string
}

export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<{ sent: boolean; error?: string }> {
  const { to, customerName, businessName, storefrontUrl } = opts

  const transport = getTransport()
  if (!transport) {
    console.warn('[WELCOME EMAIL] SMTP not configured')
    return { sent: false, error: 'SMTP not configured' }
  }

  try {
    await sendWithRetry(transport, {
      from:    defaultFrom(),
      to,
      subject: `Welcome to ${businessName}!`,
      html:    buildWelcomeHtml(customerName, businessName, storefrontUrl),
      text:    `Welcome to ${businessName}, ${customerName}!\n\nYour account is ready. Shop now: ${storefrontUrl}\n\nPowered by Quantix Technology`,
    })
    console.log('[WELCOME EMAIL SENT]', `Business: ${businessName}`, `| Recipient: ${to}`)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SMTP send failed'
    console.error('[WELCOME EMAIL ERROR]', `Recipient: ${to}`, `| Error: ${msg}`)
    return { sent: false, error: msg }
  }
}

// ── Generic transactional mailer ─────────────────────────────────────────────

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransport()
  if (!transport) return { sent: false, error: 'SMTP not configured' }
  try {
    await sendWithRetry(transport, { from: defaultFrom(), to, subject, html })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'SMTP send failed' }
  }
}
