'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getWorkspaceEntryRoute } from '@/lib/workspace-routes'

interface Props {
  businessId: string
  state: any
  onClose?: () => void
}

export function ReadyStep({ businessId, state, onClose }: Props) {
  const router = useRouter()

  // Real in-app entry route for this product (single source of truth).
  // Previously this built `/<product>/dashboard`, which 404'd for LAUNDRY
  // because no /laundry/dashboard route exists.
  const workspaceRoute = getWorkspaceEntryRoute(state.productCode)

  // Auto-redirect to product workspace after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(workspaceRoute)
    }, 2000)

    return () => clearTimeout(timer)
  }, [workspaceRoute, router])

  return (
    <div className="space-y-6 text-center py-12">
      <CheckCircle2 className="w-24 h-24 text-green-600 mx-auto animate-pulse" />
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
      <p className="text-sm text-gray-600">Redirecting to workspace in 2 seconds...</p>
      <div className="flex justify-center gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Back to Businesses
          </Button>
        )}
        <Button asChild>
          <Link href={workspaceRoute}>
            <ArrowRight className="w-4 h-4 mr-2" />
            Launch {state.productCode} Workspace
          </Link>
        </Button>
      </div>
    </div>
  )
}
