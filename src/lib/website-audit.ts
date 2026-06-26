import { db } from "@/lib/db"

export interface AuditLogData {
  userId?: string
  userName?: string
  email?: string
  role?: string
  action: "CREATE" | "UPDATE" | "DELETE" | "PUBLISH"
  resourceType: string // Feature, Testimonial, FAQ, etc.
  resourceId?: string
  description: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  severity?: "INFO" | "WARNING" | "CRITICAL"
}

export const logWebsiteAudit = async (data: AuditLogData) => {
  try {
    await db.platformAuditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        email: data.email,
        role: data.role,
        module: "WEBSITE_MANAGEMENT",
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        description: data.description,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        severity: data.severity || "INFO",
      },
    })
  } catch (error) {
    // Log error but don't throw - audit failure shouldn't block operations
    console.error("[Website Audit] Failed to log action:", error)
  }
}

// Helper to extract changed fields
export const getChangedFields = (oldValues: Record<string, any>, newValues: Record<string, any>) => {
  const changed: Record<string, { old: any; new: any }> = {}

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)])

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed[key] = {
        old: oldValues[key],
        new: newValues[key],
      }
    }
  }

  return changed
}

// Format description for common actions
export const formatAuditDescription = (action: string, resourceType: string, details?: string): string => {
  const baseText = `${action} ${resourceType}`
  return details ? `${baseText}: ${details}` : baseText
}
