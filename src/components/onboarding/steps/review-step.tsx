'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Minus, Plus } from 'lucide-react'

interface ResourceAllocation {
  storageGB: number
  maxUsers: number
  maxStores: number
}

interface Props {
  state: any
  resourceAllocation: ResourceAllocation
  onResourceChange: (allocation: ResourceAllocation) => void
  onSubmit: () => void
  loading: boolean
}

export function ReviewStep({ state, resourceAllocation, onResourceChange, onSubmit, loading }: Props) {
  // Validation helpers
  const updateStorage = (value: number) => {
    const validated = Math.max(1, Math.min(500, value))
    onResourceChange({ ...resourceAllocation, storageGB: validated })
  }

  const updateUsers = (value: number) => {
    const validated = Math.max(1, Math.min(1000, value))
    onResourceChange({ ...resourceAllocation, maxUsers: validated })
  }

  const updateStores = (value: number) => {
    const validated = Math.max(1, Math.min(500, value))
    onResourceChange({ ...resourceAllocation, maxStores: validated })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Review & Confirm</h3>

      {/* Business Information */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h4 className="font-semibold mb-4">Business Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Business Name</p>
            <p className="font-semibold">{state.businessName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Business Slug</p>
            <p className="font-semibold">{state.businessSlug}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Owner Name</p>
            <p className="font-semibold">{state.ownerName || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-semibold text-sm">{state.contactEmail}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-semibold">{state.contactPhone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">City</p>
            <p className="font-semibold">{state.city}</p>
          </div>
        </div>
      </Card>

      {/* Product & Plan Information */}
      <Card className="p-6 bg-purple-50 border-purple-200">
        <h4 className="font-semibold mb-4">Product & Subscription</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Product</p>
            <p className="font-semibold">{state.productCode || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Plan</p>
            <p className="font-semibold">{state.subscriptionPlanCode || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Resource Allocation - Editable */}
      <Card className="p-6 bg-green-50 border-green-200">
        <h4 className="font-semibold mb-6">Resource Allocation</h4>
        <div className="space-y-6">
          {/* Storage */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Storage (GB)</label>
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStorage(resourceAllocation.storageGB - 1)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min="1"
                max="500"
                value={resourceAllocation.storageGB}
                onChange={(e) => updateStorage(parseInt(e.target.value) || 1)}
                className="w-24 text-center"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStorage(resourceAllocation.storageGB + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500 ml-2">1 - 500 GB</span>
            </div>
          </div>

          {/* Users */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Users</label>
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateUsers(resourceAllocation.maxUsers - 1)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min="1"
                max="1000"
                value={resourceAllocation.maxUsers}
                onChange={(e) => updateUsers(parseInt(e.target.value) || 1)}
                className="w-24 text-center"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateUsers(resourceAllocation.maxUsers + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500 ml-2">1 - 1,000</span>
            </div>
          </div>

          {/* Stores / Branches */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Stores / Branches</label>
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStores(resourceAllocation.maxStores - 1)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                min="1"
                max="500"
                value={resourceAllocation.maxStores}
                onChange={(e) => updateStores(parseInt(e.target.value) || 1)}
                className="w-24 text-center"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStores(resourceAllocation.maxStores + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500 ml-2">1 - 500</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-3">Review Summary:</p>
        <ul className="space-y-2 text-sm">
          <li>✓ Business created with all information</li>
          <li>✓ Product assigned: {state.productCode}</li>
          <li>✓ Plan assigned: {state.subscriptionPlanCode}</li>
          <li>✓ Resources allocated: {resourceAllocation.storageGB}GB storage, {resourceAllocation.maxUsers} users, {resourceAllocation.maxStores} store(s)</li>
          <li>✓ Ready for provisioning</li>
        </ul>
      </div>
    </div>
  )
}
