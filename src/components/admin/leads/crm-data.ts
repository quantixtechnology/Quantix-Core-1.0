// ============================================================================
// Quantix Core Platform — CRM Extension Mock Data
// Phase 4: Sales Team CRM Extension
// ============================================================================

export type ActivityType =
  | "STAGE_CHANGE"
  | "COMMENT"
  | "FOLLOW_UP"
  | "CALL"
  | "WHATSAPP"
  | "DEMO_SHARED"
  | "PAYMENT_FOLLOW_UP"
  | "ONBOARDING_NOTE"

export interface LeadActivity {
  id: string
  leadId: string
  type: ActivityType
  userId: string
  userName: string
  timestamp: string
  previousStage?: string
  newStage?: string
  content: string
  metadata?: Record<string, string>
}

export type CommentType = "comment" | "follow_up" | "call_outcome"

export interface LeadComment {
  id: string
  leadId: string
  userId: string
  userName: string
  content: string
  createdAt: string
  type: CommentType
}

export interface ContactStats {
  totalAttempts: number
  totalFollowUps: number
  totalCalls: number
  totalWhatsApp: number
  totalDemosShared: number
  daysSinceLastContact: number
}

export interface SalesRepMetrics {
  repId: string
  repName: string
  leadsAssigned: number
  callsMade: number
  followUpsCompleted: number
  demosShared: number
  conversions: number
  renewalsClosed: number
  revenueGenerated: number
  conversionRate: number
}

export type ReminderType = "PENDING" | "OVERDUE" | "INACTIVITY"

export interface FollowUpReminder {
  id: string
  leadId: string
  leadName: string
  type: ReminderType
  scheduledDate: string
  salesRepId: string
  salesRepName: string
}

export interface StageFunnelItem {
  stage: string
  count: number
  conversionRate: number
}

// ---- Mock Data ----

export const leadActivities: LeadActivity[] = [
  {
    id: "act_1",
    leadId: "lead_1",
    type: "STAGE_CHANGE",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-19T14:30:00Z",
    previousStage: "LEAD",
    newStage: "DEMO_SHARED",
    content: "Stage advanced from LEAD to DEMO_SHARED",
  },
  {
    id: "act_2",
    leadId: "lead_1",
    type: "CALL",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-19T11:00:00Z",
    content: "Initial discovery call — business owner interested in food delivery platform",
    metadata: { duration: "18 min", outcome: "Interested" },
  },
  {
    id: "act_3",
    leadId: "lead_1",
    type: "WHATSAPP",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-18T16:45:00Z",
    content: "Sent product brochure and pricing via WhatsApp",
    metadata: { templateUsed: "product_intro_v2" },
  },
  {
    id: "act_4",
    leadId: "lead_1",
    type: "COMMENT",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-17T10:20:00Z",
    content: "Lead came from Meta Ads campaign for food delivery vertical. High intent — filled out demo request form.",
  },
  {
    id: "act_5",
    leadId: "lead_2",
    type: "DEMO_SHARED",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-18T13:00:00Z",
    content: "Shared live demo of car wash subscription management module",
    metadata: { demoType: "Live", attendees: "3" },
  },
  {
    id: "act_6",
    leadId: "lead_2",
    type: "FOLLOW_UP",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-17T09:30:00Z",
    content: "Follow-up call scheduled after initial WhatsApp inquiry. Business owner wants to see car wash module.",
  },
  {
    id: "act_7",
    leadId: "lead_2",
    type: "WHATSAPP",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-16T15:20:00Z",
    content: "Received WhatsApp inquiry about car wash management platform",
  },
  {
    id: "act_8",
    leadId: "lead_3",
    type: "STAGE_CHANGE",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-20T10:00:00Z",
    previousStage: "DEMO_SHARED",
    newStage: "NEGOTIATION",
    content: "Stage advanced from DEMO_SHARED to NEGOTIATION",
  },
  {
    id: "act_9",
    leadId: "lead_3",
    type: "CALL",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-19T14:00:00Z",
    content: "Pricing negotiation call — client asking for discount on yearly plan",
    metadata: { duration: "25 min", outcome: "Negotiating" },
  },
  {
    id: "act_10",
    leadId: "lead_3",
    type: "FOLLOW_UP",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-18T11:30:00Z",
    content: "Sent follow-up email with demo recording and custom pricing proposal",
  },
  {
    id: "act_11",
    leadId: "lead_4",
    type: "PAYMENT_FOLLOW_UP",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-19T16:00:00Z",
    content: "Sent payment reminder — client confirmed payment will be processed by EOD tomorrow",
  },
  {
    id: "act_12",
    leadId: "lead_4",
    type: "STAGE_CHANGE",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-15T12:00:00Z",
    previousStage: "NEGOTIATION",
    newStage: "PAYMENT_PENDING",
    content: "Stage advanced from NEGOTIATION to PAYMENT_PENDING",
  },
  {
    id: "act_13",
    leadId: "lead_5",
    type: "STAGE_CHANGE",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-16T09:00:00Z",
    previousStage: "PAYMENT_PENDING",
    newStage: "PAYMENT_RECEIVED",
    content: "Payment of ₹59,988 received for StyleHut Fashion — Yearly plan",
  },
  {
    id: "act_14",
    leadId: "lead_5",
    type: "CALL",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-14T11:00:00Z",
    content: "Payment confirmation call — client confirmed bank transfer initiated",
    metadata: { duration: "8 min", outcome: "Payment Confirmed" },
  },
  {
    id: "act_15",
    leadId: "lead_6",
    type: "ONBOARDING_NOTE",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-10T14:30:00Z",
    content: "Onboarding completed. Client went live with laundry pickup & delivery module.",
  },
  {
    id: "act_16",
    leadId: "lead_7",
    type: "COMMENT",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-08T09:00:00Z",
    content: "Lead marked as LOST — client chose competitor platform. May revisit in Q2.",
  },
  {
    id: "act_17",
    leadId: "lead_8",
    type: "DEMO_SHARED",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-20T11:00:00Z",
    content: "Shared demo of cosmetics e-commerce template with inventory management",
    metadata: { demoType: "Recorded", attendees: "2" },
  },
  {
    id: "act_18",
    leadId: "lead_8",
    type: "WHATSAPP",
    userId: "sales_2",
    userName: "Rahul Verma",
    timestamp: "2025-01-19T14:30:00Z",
    content: "WhatsApp intro message sent — client responded positively",
  },
  {
    id: "act_19",
    leadId: "lead_1",
    type: "FOLLOW_UP",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-20T09:00:00Z",
    content: "Scheduled demo follow-up for TasteBud Restaurant — they want to see order management",
  },
  {
    id: "act_20",
    leadId: "lead_3",
    type: "DEMO_SHARED",
    userId: "sales_1",
    userName: "Priya Sharma",
    timestamp: "2025-01-15T13:00:00Z",
    content: "Shared live demo of grocery delivery platform with inventory and subscription modules",
    metadata: { demoType: "Live", attendees: "4" },
  },
]

export const leadComments: LeadComment[] = [
  {
    id: "cmt_1",
    leadId: "lead_1",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Initial discovery call went well. Amit is very interested in the food delivery module. He currently manages 3 restaurants and wants a unified platform.",
    createdAt: "2025-01-19T11:05:00Z",
    type: "call_outcome",
  },
  {
    id: "cmt_2",
    leadId: "lead_1",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Sent product brochure via WhatsApp. Client acknowledged and asked for a demo slot next week.",
    createdAt: "2025-01-18T16:50:00Z",
    type: "follow_up",
  },
  {
    id: "cmt_3",
    leadId: "lead_1",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Lead quality looks good — came from Meta Ads food delivery campaign. High intent signal.",
    createdAt: "2025-01-17T10:22:00Z",
    type: "comment",
  },
  {
    id: "cmt_4",
    leadId: "lead_2",
    userId: "sales_2",
    userName: "Rahul Verma",
    content: "Demo was well-received. Suresh wants to see the car wash subscription module with recurring billing.",
    createdAt: "2025-01-18T13:15:00Z",
    type: "call_outcome",
  },
  {
    id: "cmt_5",
    leadId: "lead_2",
    userId: "sales_2",
    userName: "Rahul Verma",
    content: "Follow-up scheduled for Monday. Client is comparing with 2 other vendors.",
    createdAt: "2025-01-17T09:35:00Z",
    type: "follow_up",
  },
  {
    id: "cmt_6",
    leadId: "lead_3",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Meera is pushing for a 15% discount on the yearly plan. Need manager approval for anything above 10%.",
    createdAt: "2025-01-19T14:10:00Z",
    type: "comment",
  },
  {
    id: "cmt_7",
    leadId: "lead_3",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Pricing negotiation call — client considering yearly plan at ₹49,999 with 10% discount.",
    createdAt: "2025-01-19T14:05:00Z",
    type: "call_outcome",
  },
  {
    id: "cmt_8",
    leadId: "lead_4",
    userId: "sales_2",
    userName: "Rahul Verma",
    content: "Payment confirmed verbally. Dr. Rajesh said accounts team will process by tomorrow EOD.",
    createdAt: "2025-01-19T16:05:00Z",
    type: "follow_up",
  },
  {
    id: "cmt_9",
    leadId: "lead_5",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Payment received! Neha confirmed bank transfer of ₹59,988 for yearly plan. Onboarding to start next week.",
    createdAt: "2025-01-16T09:05:00Z",
    type: "comment",
  },
  {
    id: "cmt_10",
    leadId: "lead_7",
    userId: "sales_1",
    userName: "Priya Sharma",
    content: "Lost to competitor. Anita said the other platform offered a 3-month free trial. We should consider a trial period offering.",
    createdAt: "2025-01-08T09:05:00Z",
    type: "comment",
  },
  {
    id: "cmt_11",
    leadId: "lead_8",
    userId: "sales_2",
    userName: "Rahul Verma",
    content: "Kavita is interested in the cosmetics template. She runs a small beauty products chain with 2 stores.",
    createdAt: "2025-01-19T14:35:00Z",
    type: "comment",
  },
]

export const leadContactStats: Record<string, ContactStats> = {
  lead_1: { totalAttempts: 5, totalFollowUps: 2, totalCalls: 1, totalWhatsApp: 1, totalDemosShared: 0, daysSinceLastContact: 1 },
  lead_2: { totalAttempts: 4, totalFollowUps: 1, totalCalls: 0, totalWhatsApp: 1, totalDemosShared: 1, daysSinceLastContact: 2 },
  lead_3: { totalAttempts: 7, totalFollowUps: 2, totalCalls: 2, totalWhatsApp: 0, totalDemosShared: 1, daysSinceLastContact: 0 },
  lead_4: { totalAttempts: 6, totalFollowUps: 2, totalCalls: 1, totalWhatsApp: 0, totalDemosShared: 1, daysSinceLastContact: 1 },
  lead_5: { totalAttempts: 8, totalFollowUps: 3, totalCalls: 2, totalWhatsApp: 1, totalDemosShared: 1, daysSinceLastContact: 4 },
  lead_6: { totalAttempts: 3, totalFollowUps: 1, totalCalls: 1, totalWhatsApp: 0, totalDemosShared: 0, daysSinceLastContact: 27 },
  lead_7: { totalAttempts: 4, totalFollowUps: 2, totalCalls: 1, totalWhatsApp: 0, totalDemosShared: 1, daysSinceLastContact: 12 },
  lead_8: { totalAttempts: 3, totalFollowUps: 0, totalCalls: 0, totalWhatsApp: 1, totalDemosShared: 1, daysSinceLastContact: 0 },
}

export const salesRepMetrics: SalesRepMetrics[] = [
  {
    repId: "sales_1",
    repName: "Priya Sharma",
    leadsAssigned: 12,
    callsMade: 34,
    followUpsCompleted: 22,
    demosShared: 8,
    conversions: 5,
    renewalsClosed: 3,
    revenueGenerated: 299940,
    conversionRate: 41.7,
  },
  {
    repId: "sales_2",
    repName: "Rahul Verma",
    leadsAssigned: 18,
    callsMade: 47,
    followUpsCompleted: 31,
    demosShared: 12,
    conversions: 8,
    renewalsClosed: 5,
    revenueGenerated: 539892,
    conversionRate: 44.4,
  },
]

export const followUpReminders: FollowUpReminder[] = [
  {
    id: "rem_1",
    leadId: "lead_1",
    leadName: "TasteBud Restaurant",
    type: "PENDING",
    scheduledDate: "2025-01-21",
    salesRepId: "sales_1",
    salesRepName: "Priya Sharma",
  },
  {
    id: "rem_2",
    leadId: "lead_2",
    leadName: "WashMaster Pro",
    type: "OVERDUE",
    scheduledDate: "2025-01-18",
    salesRepId: "sales_2",
    salesRepName: "Rahul Verma",
  },
  {
    id: "rem_3",
    leadId: "lead_3",
    leadName: "GreenLeaf Organic",
    type: "PENDING",
    scheduledDate: "2025-01-22",
    salesRepId: "sales_1",
    salesRepName: "Priya Sharma",
  },
  {
    id: "rem_4",
    leadId: "lead_4",
    leadName: "MedPlus Health",
    type: "OVERDUE",
    scheduledDate: "2025-01-19",
    salesRepId: "sales_2",
    salesRepName: "Rahul Verma",
  },
  {
    id: "rem_5",
    leadId: "lead_8",
    leadName: "BeautyBox Store",
    type: "PENDING",
    scheduledDate: "2025-01-25",
    salesRepId: "sales_2",
    salesRepName: "Rahul Verma",
  },
  {
    id: "rem_6",
    leadId: "lead_6",
    leadName: "CleanPro Services",
    type: "INACTIVITY",
    scheduledDate: "2025-01-10",
    salesRepId: "sales_2",
    salesRepName: "Rahul Verma",
  },
  {
    id: "rem_7",
    leadId: "lead_7",
    leadName: "HomeCare Plus",
    type: "INACTIVITY",
    scheduledDate: "2025-01-08",
    salesRepId: "sales_1",
    salesRepName: "Priya Sharma",
  },
]

export const stageFunnelData: StageFunnelItem[] = [
  { stage: "LEAD", count: 1, conversionRate: 100 },
  { stage: "DEMO_SHARED", count: 2, conversionRate: 75 },
  { stage: "NEGOTIATION", count: 1, conversionRate: 50 },
  { stage: "PAYMENT_PENDING", count: 1, conversionRate: 37.5 },
  { stage: "PAYMENT_RECEIVED", count: 1, conversionRate: 25 },
  { stage: "ONBOARDING", count: 0, conversionRate: 12.5 },
  { stage: "DEPLOYMENT", count: 0, conversionRate: 12.5 },
  { stage: "ACTIVE", count: 1, conversionRate: 12.5 },
]

// Helper: format relative time
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date("2025-01-20T18:00:00Z") // Fixed reference for consistent demo
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

// Helper: activity type config
export const activityTypeConfig: Record<ActivityType, { icon: string; color: string; bgColor: string; label: string }> = {
  STAGE_CHANGE: { icon: "ArrowRightLeft", color: "text-violet-700", bgColor: "bg-violet-100", label: "Stage Change" },
  COMMENT: { icon: "MessageSquare", color: "text-slate-700", bgColor: "bg-slate-100", label: "Comment" },
  FOLLOW_UP: { icon: "CalendarCheck", color: "text-amber-700", bgColor: "bg-amber-100", label: "Follow-up" },
  CALL: { icon: "Phone", color: "text-emerald-700", bgColor: "bg-emerald-100", label: "Call" },
  WHATSAPP: { icon: "MessageCircle", color: "text-green-700", bgColor: "bg-green-100", label: "WhatsApp" },
  DEMO_SHARED: { icon: "MonitorPlay", color: "text-blue-700", bgColor: "bg-blue-100", label: "Demo Shared" },
  PAYMENT_FOLLOW_UP: { icon: "IndianRupee", color: "text-orange-700", bgColor: "bg-orange-100", label: "Payment Follow-up" },
  ONBOARDING_NOTE: { icon: "Rocket", color: "text-purple-700", bgColor: "bg-purple-100", label: "Onboarding" },
}
