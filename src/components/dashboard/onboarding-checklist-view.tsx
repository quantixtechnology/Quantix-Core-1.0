'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ClipboardCheck, UserPlus, CheckCircle2, Clock,
  Eye, ChevronRight,
} from 'lucide-react'

const stats = [
  { label: 'Total', value: '11', icon: ClipboardCheck, color: 'text-slate-600 bg-slate-50' },
  { label: 'Onboarding', value: '3', icon: UserPlus, color: 'text-blue-600 bg-blue-50' },
  { label: 'Completed', value: '7', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Avg Time', value: '5.2 days', icon: Clock, color: 'text-amber-600 bg-amber-50' },
]

const checklistItems = [
  'Business profile setup',
  'Store configuration',
  'Product catalog import',
  'Payment gateway integration',
  'Domain & branding',
  'Delivery zone setup',
  'Staff accounts',
  'POS configuration',
  'Go-live verification',
]

const businesses = [
  { name: 'FreshMart', completed: 9, total: 9, status: 'completed', days: 4 },
  { name: 'CleanHome', completed: 9, total: 9, status: 'completed', days: 6 },
  { name: 'SpiceGarden', completed: 7, total: 9, status: 'onboarding', days: 5 },
  { name: 'TechHub', completed: 9, total: 9, status: 'completed', days: 3 },
  { name: 'QuickWash', completed: 4, total: 9, status: 'onboarding', days: 3 },
]

export function OnboardingChecklistView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Onboarding Checklist by Business</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {businesses.map(b => (
              <div key={b.name} className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{b.name}</span>
                    <Badge className={`text-[10px] ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{b.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{b.completed}/{b.total} · {b.days} days</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all ${b.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${(b.completed / b.total) * 100}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {checklistItems.map((item, i) => {
                    const done = i < b.completed
                    return (
                      <div key={item} className="flex items-center gap-1.5 text-[10px]">
                        <div className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                          {done && <CheckCircle2 className="size-2.5 text-white" />}
                        </div>
                        <span className={done ? '' : 'text-muted-foreground'}>{item}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
