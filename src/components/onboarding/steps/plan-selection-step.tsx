'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  productCode: string
  onPlanSelect: (planCode: string) => void
}

export function PlanSelectionStep({ productCode, onPlanSelect }: Props) {
  const [plans, setPlans] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/products/${productCode}/profile`)
      .then((r) => r.json())
      .then((result) => {
        setPlans(result.data?.plans || [])
        if (result.data?.plans?.length > 0) {
          setSelected(result.data.plans[0].code)
        }
      })
  }, [productCode])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Select Subscription Plan</h3>
      <div className="grid grid-cols-3 gap-4">
        {plans.map((p) => (
          <Card
            key={p.code}
            className={`p-4 cursor-pointer border-2 ${selected === p.code ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}
            onClick={() => setSelected(p.code)}
          >
            <h4 className="font-semibold">{p.name}</h4>
            <div className="text-sm text-gray-600 mt-3 space-y-1">
              <p>Storage: {(p.storageQuotaMB / 1024 / 1024).toFixed(0)}GB</p>
              <p>Users: {p.userLimit}</p>
              <p>Branches: {p.branchLimit}</p>
            </div>
          </Card>
        ))}
      </div>
      <Button onClick={() => selected && onPlanSelect(selected)}>Continue</Button>
    </div>
  )
}
