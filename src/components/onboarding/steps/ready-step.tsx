'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  businessId: string
  state: any
}

export function ReadyStep({ businessId, state }: Props) {
  return (
    <div className="space-y-6 text-center py-12">
      <CheckCircle2 className="w-24 h-24 text-green-600 mx-auto" />
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Workspace Ready!</h3>
        <p className="text-gray-600">Your {state.productCode} business is ready to use</p>
      </div>
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="grid grid-cols-3 gap-4 text-left">
          <div>
            <p className="text-sm text-gray-600">Business</p>
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
        </div>
      </Card>
      <div className="flex justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/dashboard">View Dashboard</Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/businesses/${businessId}`}>Open Business</Link>
        </Button>
      </div>
    </div>
  )
}
