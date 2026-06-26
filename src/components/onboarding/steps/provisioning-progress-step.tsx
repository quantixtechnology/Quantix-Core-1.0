'use client'

import { Card } from '@/components/ui/card'
import { CheckCircle2, Loader2, Clock } from 'lucide-react'

interface Props {
  steps: Array<{ step: string; status: string }>
}

export function ProvisioningProgressStep({ steps }: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Setting Up Your Workspace</h3>
      <div className="space-y-3">
        {steps.map((s) => (
          <Card key={s.step} className="p-4 flex items-center gap-3">
            {s.status === 'COMPLETED' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            {s.status === 'IN_PROGRESS' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
            {s.status === 'PENDING' && <Clock className="w-5 h-5 text-gray-400" />}
            <span className={s.status === 'COMPLETED' ? 'text-green-700' : 'text-gray-700'}>
              {s.step}
            </span>
          </Card>
        ))}
      </div>
      <p className="text-sm text-gray-600">This usually takes 1-2 minutes...</p>
    </div>
  )
}
