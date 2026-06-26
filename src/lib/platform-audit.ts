// ============================================================================
// Platform Audit Logger — Quantix internal operations only.
// Server-side only — do NOT import in client components.
//
// Usage: call logPlatformEvent() fire-and-forget anywhere in an API route.
// Never await it — audit failures must never break the main request.
//
//   logPlatformEvent({ userId, userName, email, role, module, action,
//                      description, resourceType, resourceId, req })
// ============================================================================

import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditModule =
  | 'AUTHENTICATION'
  | 'PROPOSALS'
  | 'LEADS'
  | 'CRM'
  | 'HRMS'
  | 'COMMISSION'
  | 'SUBSCRIPTIONS'
  | 'BRAND_STUDIO'
  | 'USER_MANAGEMENT'
  | 'ROLES_PERMISSIONS'
  | 'SETTINGS'
  | 'DEPLOYMENT'
  | 'WORKFLOW'
  | 'SYSTEM'
  | 'PRODUCTS'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'FAILED_LOGIN'
  | 'PASSWORD_CHANGE'
  | 'SESSION_EXPIRED'
  | 'PAGE_VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'DOWNLOAD'
  | 'PREVIEW'
  | 'EXPORT'
  | 'SEND'
  | 'ENABLE'
  | 'DISABLE'
  | 'ASSIGN'
  | 'REVOKE'
  | 'GENERATE'
  | 'DEPLOY'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface AuditEventParams {
  userId?:       string | null
  userName?:     string | null
  email?:        string | null
  role?:         string | null
  module:        AuditModule
  action:        AuditAction
  page?:         string | null
  resourceType?: string | null
  resourceId?:   string | null
  description:   string
  oldValues?:    Record<string, unknown> | null
  newValues?:    Record<string, unknown> | null
  /** Override auto-inferred severity when needed */
  severity?:     AuditSeverity
  ipAddress?:    string | null
  sessionId?:    string | null
  /** Pass the NextRequest to auto-extract IP, browser, OS, device */
  req?:          NextRequest | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity inference
// ─────────────────────────────────────────────────────────────────────────────

function inferSeverity(action: AuditAction): AuditSeverity {
  switch (action) {
    case 'DELETE':
    case 'FAILED_LOGIN':
      return 'CRITICAL'
    case 'ARCHIVE':
    case 'DISABLE':
    case 'REVOKE':
    case 'ASSIGN':
    case 'PASSWORD_CHANGE':
    case 'UPDATE':
      return 'WARNING'
    default:
      return 'INFO'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User-agent parsing
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedUA {
  browser:         string
  operatingSystem: string
  deviceType:      string
}

function parseUserAgent(ua: string | null): ParsedUA {
  if (!ua) return { browser: 'Unknown', operatingSystem: 'Unknown', deviceType: 'Desktop' }

  let browser = 'Other'
  if (ua.includes('Edg/') || ua.includes('EdgA/'))          browser = 'Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera/'))     browser = 'Opera'
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome'
  else if (ua.includes('Firefox/'))                          browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'

  let os = 'Other'
  if      (ua.includes('Windows NT'))                         os = 'Windows'
  else if (ua.includes('Android'))                            os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad'))      os = 'iOS'
  else if (ua.includes('Mac OS X'))                           os = 'macOS'
  else if (ua.includes('Linux'))                              os = 'Linux'

  let device = 'Desktop'
  if      (ua.includes('Mobile') || ua.includes('iPhone'))   device = 'Mobile'
  else if (ua.includes('iPad')   || ua.includes('Tablet'))   device = 'Tablet'

  return { browser, operatingSystem: os, deviceType: device }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core logger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget platform audit event.
 * Never throws. Never blocks the calling request.
 * Never awaited — call as: `logPlatformEvent({...})`
 */
export function logPlatformEvent(params: AuditEventParams): void {
  const { req } = params

  const ipAddress = params.ipAddress
    ?? req?.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req?.headers.get('x-real-ip')
    ?? null

  const rawUA = req?.headers.get('user-agent') ?? null
  const { browser, operatingSystem, deviceType } = parseUserAgent(rawUA)

  const severity = params.severity ?? inferSeverity(params.action)

  void (async () => {
    try {
      await db.platformAuditLog.create({
        data: {
          userId:          params.userId      ?? null,
          userName:        params.userName    ?? null,
          email:           params.email       ?? null,
          role:            params.role        ?? null,
          module:          params.module,
          action:          params.action,
          page:            params.page        ?? null,
          resourceType:    params.resourceType ?? null,
          resourceId:      params.resourceId  ?? null,
          description:     params.description,
          oldValues:       params.oldValues ? JSON.stringify(params.oldValues) : null,
          newValues:       params.newValues ? JSON.stringify(params.newValues) : null,
          severity,
          ipAddress,
          browser,
          operatingSystem,
          deviceType,
          sessionId:       params.sessionId   ?? null,
        },
      })
    } catch {
      // Audit failures must never break the main request
    }
  })()
}
