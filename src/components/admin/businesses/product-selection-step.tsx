'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'

interface ProductInfo {
  code: string
  name: string
  description?: string
  version: string
  storage: number
  plans: Array<{
    code: string
    name: string
    storageQuotaMB: number
    userLimit: number
    branchLimit: number
  }>
}

interface ProductSelectionStepProps {
  onProductSelect: (productCode: string, planCode: string) => void
  selectedProduct?: string
  selectedPlan?: string
}

export function ProductSelectionStep({
  onProductSelect,
  selectedProduct,
  selectedPlan,
}: ProductSelectionStepProps) {
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [selectedProductCode, setSelectedProductCode] = useState<string>(selectedProduct || '')
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(selectedPlan || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      // The products route is platform-admin gated, so it needs the admin token.
      const response = await fetch('/api/admin/businesses/products', { headers: getAuthHeaders() })
      const result = await response.json()

      if (!result.success) {
        setError('Failed to load products')
        return
      }

      setProducts(result.data)
      setError(null)
    } catch (err) {
      setError('Error loading products')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const currentProduct = products.find((p) => p.code === selectedProductCode)

  const handleProductSelect = (productCode: string) => {
    setSelectedProductCode(productCode)
    setSelectedPlanCode('') // Reset plan selection when product changes
  }

  const handlePlanSelect = (planCode: string) => {
    setSelectedPlanCode(planCode)
    onProductSelect(selectedProductCode, planCode)
  }

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>
  }

  if (error) {
    return <div className="text-red-600 py-8">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Select Product</h3>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card
            key={product.code}
            className={`cursor-pointer transition-all ${
              selectedProductCode === product.code ? 'border-blue-600 ring-2 ring-blue-600' : ''
            }`}
            onClick={() => handleProductSelect(product.code)}
          >
            <CardHeader>
              <CardTitle className="text-lg">{product.name}</CardTitle>
              <p className="text-sm text-gray-600">{product.description}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Version</p>
                <p className="font-semibold">{product.version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Default Storage</p>
                <p className="font-semibold">{(product.storage / 1024 / 1024).toFixed(0)} GB</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Plans</p>
                <div className="flex flex-wrap gap-1">
                  {product.plans.slice(0, 3).map((plan) => (
                    <Badge key={plan.code} variant="secondary">
                      {plan.code}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Selection */}
      {currentProduct && (
        <div className="space-y-4">
          <h4 className="font-semibold">Select Subscription Plan</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentProduct.plans.map((plan) => (
              <Card
                key={plan.code}
                className={`cursor-pointer transition-all ${
                  selectedPlanCode === plan.code ? 'border-green-600 ring-2 ring-green-600' : ''
                }`}
                onClick={() => handlePlanSelect(plan.code)}
              >
                <CardContent className="pt-6 space-y-3">
                  <h5 className="font-semibold text-center">{plan.name}</h5>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Storage</span>
                      <span className="font-semibold">{(plan.storageQuotaMB / 1024 / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Users</span>
                      <span className="font-semibold">{plan.userLimit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Branches</span>
                      <span className="font-semibold">{plan.branchLimit}</span>
                    </div>
                  </div>
                  {selectedPlanCode === plan.code && (
                    <div className="text-center pt-2 border-t">
                      <Badge className="bg-green-600">Selected</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {selectedProductCode && selectedPlanCode && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>Selected:</strong> {currentProduct?.name} • {selectedPlanCode} Plan
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
