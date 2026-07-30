// ============================================================================
// Structured Logger
// Provides structured logging with request IDs, error tracking, audit logs
// ============================================================================

import crypto from 'crypto'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
export type LogCategory = 'AUTH' | 'PROVISIONING' | 'PAYMENT' | 'EMAIL' | 'WORKSPACE' | 'API' | 'DATABASE' | 'CONFIG' | 'FILES'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  requestId?: string
  userId?: string
  businessId?: string
  duration?: number
  error?: {
    name: string
    message: string
    stack?: string
  }
  metadata?: Record<string, any>
}

/**
 * Generate unique request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomBytes(8).toString('hex')
}

/**
 * Structured logger
 */
class Logger {
  private context: {
    requestId?: string
    userId?: string
    businessId?: string
  }

  constructor() {
    this.context = {}
  }

  setContext(context: { requestId?: string; userId?: string; businessId?: string }) {
    this.context = context
  }

  clearContext() {
    this.context = {}
  }

  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, requestId, userId, businessId, duration, error, metadata } = entry

    const parts = [
      `[${timestamp}]`,
      `[${level}]`,
      `[${category}]`,
      message,
    ]

    if (requestId) parts.push(`(req:${requestId.substring(0, 8)})`)
    if (userId) parts.push(`(user:${userId.substring(0, 8)})`)
    if (businessId) parts.push(`(biz:${businessId.substring(0, 8)})`)
    if (duration) parts.push(`(${duration}ms)`)

    const output = parts.join(' ')

    if (error) {
      return `${output}\n  Error: ${error.name}: ${error.message}`
    }

    if (metadata && Object.keys(metadata).length > 0) {
      return `${output}\n  ${JSON.stringify(metadata)}`
    }

    return output
  }

  debug(category: LogCategory, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      category,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      businessId: this.context.businessId,
      metadata,
    }
    console.log(this.formatEntry(entry))
  }

  info(category: LogCategory, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      businessId: this.context.businessId,
      metadata,
    }
    console.log(this.formatEntry(entry))
  }

  warn(category: LogCategory, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      category,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      businessId: this.context.businessId,
      metadata,
    }
    console.warn(this.formatEntry(entry))
  }

  error(category: LogCategory, message: string, error?: Error, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      category,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      businessId: this.context.businessId,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      metadata,
    }
    console.error(this.formatEntry(entry))
  }

  critical(category: LogCategory, message: string, error?: Error, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      category,
      message,
      requestId: this.context.requestId,
      userId: this.context.userId,
      businessId: this.context.businessId,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      metadata,
    }
    console.error(this.formatEntry(entry))
  }
}

export const logger = new Logger()
