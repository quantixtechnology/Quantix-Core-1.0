'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  state: any
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

export function ReviewStep({ state, onSubmit, onBack, loading }: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Review & Confirm</h3>
      <Card className="p-6 bg-gray-50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Business Name</p>
            <p className="font-semibold">{state.businessName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Product</p>
            <p className="font-semibold">{state.productCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <p className="font-semibold">{state.subscriptionPlanCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-semibold">{state.contactEmail}</p>
          </div>
        </div>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? 'Creating...' : 'Create Business'}
        </Button>
      </div>
    </div>
  )
}
