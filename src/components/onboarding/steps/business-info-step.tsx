'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  initialData: any
  onSubmit: (data: any) => void
  loading: boolean
}

export function BusinessInfoStep({ initialData, onSubmit, loading }: Props) {
  const [form, setForm] = useState(initialData)

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Business Information</h3>
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Business Name"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
        <Input
          placeholder="Business Slug"
          value={form.businessSlug}
          onChange={(e) => setForm({ ...form, businessSlug: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
        <Input
          placeholder="Phone"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
        />
        <Input
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Input
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => onSubmit(form)}
          disabled={!form.businessName || !form.businessSlug || loading}
          size="lg"
        >
          {loading ? 'Creating...' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
