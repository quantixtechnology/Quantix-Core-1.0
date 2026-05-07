"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { leadComments, formatRelativeTime } from "./crm-data"
import type { CommentType } from "./crm-data"

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

interface LeadCommentsFeedProps {
  leadId: string
  maxHeight?: string
}

export function LeadCommentsFeed({ leadId, maxHeight = "400px" }: LeadCommentsFeedProps) {
  const [commentType, setCommentType] = useState<CommentType>("comment")
  const [commentText, setCommentText] = useState("")

  const comments = leadComments
    .filter((c) => c.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const handleAddComment = () => {
    // In production, this would call an API
    setCommentText("")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
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
            disabled={!commentText.trim()}
            onClick={handleAddComment}
          >
            <Send className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No comments yet. Add the first one above.
        </div>
      ) : (
        <ScrollArea style={{ maxHeight }}>
          <div className="space-y-3">
            {comments.map((comment) => {
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
                          {formatRelativeTime(comment.createdAt)}
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
