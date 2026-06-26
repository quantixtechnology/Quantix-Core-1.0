'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

interface Props {
  onProductSelect: (productCode: string) => void
}

export function ProductSelectionStep({ onProductSelect }: Props) {
  const [products, setProducts] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/businesses/products')
      .then((r) => r.json())
      .then((result) => {
        setProducts(result.data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Select Product</h3>
      <div className="grid grid-cols-3 gap-4">
        {products.map((p) => (
          <Card
            key={p.code}
            className={`p-4 cursor-pointer border-2 transition-all ${
              selected === p.code ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => setSelected(p.code)}
          >
            <Package className="w-8 h-8 mb-2 text-blue-600" />
            <h4 className="font-semibold">{p.name}</h4>
            <p className="text-sm text-gray-600">{p.description}</p>
            <p className="text-xs text-gray-500 mt-2">v{p.version}</p>
          </Card>
        ))}
      </div>
      <Button onClick={() => selected && onProductSelect(selected)} disabled={!selected}>
        Continue
      </Button>
    </div>
  )
}
