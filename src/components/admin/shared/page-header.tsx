"use client"

import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  )
}
