"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  CalendarCheck,
  Phone,
  Send,
  PhoneCall,
  MessageCircle,
  CalendarPlus,
} from "lucide-react"
import type { CommentType } from "./crm-data"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { getRelativeTime } from "@/lib/utils"
import { toast } from "sonner"

const commentTypeConfig: Record<CommentType, { icon: React.ElementType; color: string; bgColor: string; label: string; borderClass: string }> = {
  comment: {
    icon: MessageSquare,
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    label: "Comment",
    borderClass: "border-l-slate-400",
  },
  follow_up: {
    icon: CalendarCheck,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    label: "Follow-up Note",
    borderClass: "border-l-amber-400",
  },
  call_outcome: {
    icon: Phone,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    label: "Call Outcome",
    borderClass: "border-l-emerald-400",
  },
}

// API response comment shape
interface ApiComment {
  id: string
  type: string
  content: string
  metadata?: Record<string, unknown>
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  createdAt: string
}

// Internal comment type matching the UI expectations
interface LeadComment {
  id: string
  leadId: string
  userId: string
  userName: string
  content: string
  createdAt: string
  type: CommentType
}

function isValidCommentType(t: string): t is CommentType {
  return ["comment", "follow_up", "call_outcome"].includes(t)
}

interface LeadCommentsFeedProps {
  leadId: string
  maxHeight?: string
}

export function LeadCommentsFeed({ leadId, maxHeight = "400px" }: LeadCommentsFeedProps) {
  const [commentType, setCommentType] = useState<CommentType>("comment")
  const [commentText, setCommentText] = useState("")
  const [comments, setComments] = useState<LeadComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!leadId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/core/leads/${leadId}/comments`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const mapped: LeadComment[] = (json.data as ApiComment[]).map((c) => ({
          id: c.id,
          leadId,
          userId: c.user?.id || "",
          userName: c.user?.name || "Unknown",
          content: c.content,
          createdAt: c.createdAt,
          type: isValidCommentType(c.type) ? c.type : "comment",
        }))
        setComments(mapped)
      } else {
        setComments([])
      }
    } catch (err) {
      console.error("Failed to fetch lead comments:", err)
      setError("Failed to load comments")
      setComments([])
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchComments()
  }, [leadId])

  const handleAddComment = async () => {
    if (!commentText.trim() || !leadId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/core/leads/${leadId}/comments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: commentType,
          content: commentText.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setCommentText("")
        toast.success("Comment added")
        fetchComments() // Refresh the list
      } else {
        toast.error(json.error || "Failed to add comment")
      }
    } catch (err) {
      console.error("Failed to add comment:", err)
      toast.error("Failed to add comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const sortedComments = [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {error}
        <Button variant="link" size="sm" onClick={fetchComments} className="ml-2">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Comment Input */}
      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Select value={commentType} onValueChange={(v) => setCommentType(v as CommentType)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(commentTypeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon className="h-3.5 w-3.5" />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder={
            commentType === "comment"
              ? "Add a comment..."
              : commentType === "follow_up"
              ? "Add a follow-up note..."
              : "Log call outcome..."
          }
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={3}
          className="text-sm resize-none"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700">
              <PhoneCall className="h-3 w-3" /> Log Call
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-600 hover:text-green-700">
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700">
              <CalendarPlus className="h-3 w-3" /> Follow-up
            </Button>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!commentText.trim() || isSubmitting}
            onClick={handleAddComment}
          >
            <Send className="h-3 w-3" /> {isSubmitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      {/* Comments List */}
      {sortedComments.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No comments yet. Add the first one above.
        </div>
      ) : (
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3">
            {sortedComments.map((comment) => {
              const config = commentTypeConfig[comment.type]
              const TypeIcon = config.icon

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg border border-l-4 ${config.borderClass} ${config.bgColor} p-3`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-medium">
                        {getInitials(comment.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{comment.userName}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 ${config.color}`}>
                          <TypeIcon className="h-2.5 w-2.5 mr-1" />
                          {config.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {getRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
