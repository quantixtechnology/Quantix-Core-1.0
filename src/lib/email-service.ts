// ============================================================================
// QUANTIX CORE — Email Service (Nodemailer)
// Reads SMTP config from environment variables.
// Falls back gracefully when SMTP is not configured.
// ============================================================================

import nodemailer from 'nodemailer'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  }
}

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  const cfg = getSmtpConfig()
  if (!cfg) return null
  if (!_transporter) {
    _transporter = nodemailer.createTransport(cfg)
  }
  return _transporter
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null
}

export async function sendEmailOtp(
  to: string,
  code: string,
  storeName: string = 'Quantix',
  fromOverride?: string
): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter()
  if (!t) {
    console.warn('[email-service] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env')
    return { sent: false, error: 'SMTP not configured' }
  }

  const cfg = getSmtpConfig()!
  const from = fromOverride || process.env.SMTP_FROM || `"${storeName}" <${cfg.auth.user}>`

  try {
    await t.sendMail({
      from,
      to,
      subject: `${code} is your ${storeName} verification code`,
      text: `Your ${storeName} verification code is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
          <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 4px">${storeName}</h2>
          <p style="color:#666;font-size:14px;margin:0 0 24px">Verification Code</p>
          <p style="color:#444;font-size:14px;margin:0 0 12px">Use this code to verify your phone number:</p>
          <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin:0 0 20px">
            <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#111;font-family:monospace">${code}</span>
          </div>
          <p style="color:#888;font-size:12px;margin:0">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#bbb;font-size:11px;margin:0">Powered by Quantix — If you didn't request this, ignore this email.</p>
        </div>
      `,
    })
    console.log(`[email-service] OTP sent to ${to}`)
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SMTP send failed'
    console.error(`[email-service] Send failed to ${to}:`, msg)
    return { sent: false, error: msg }
  }
}

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
  fromOverride?: string
): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter()
  if (!t) return { sent: false, error: 'SMTP not configured' }
  const cfg = getSmtpConfig()!
  const from = fromOverride || process.env.SMTP_FROM || cfg.auth.user
  try {
    await t.sendMail({ from, to, subject, html })
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'SMTP send failed' }
  }
}
