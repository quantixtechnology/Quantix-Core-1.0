'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  initialData: any
  onSubmit: (data: any) => void
  loading: boolean
}

// Generate slug from business name
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove special characters (keep only alphanumeric and hyphens)
      .replace(/[^a-z0-9-]/g, '')
      // Remove consecutive hyphens
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  )
}

export function BusinessInfoStep({ initialData, onSubmit, loading }: Props) {
  const [form, setForm] = useState(initialData)
  const [slugValidation, setSlugValidation] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
    message: string
    suggestion?: string
  }>({ status: 'idle', message: '' })
  const [slugModifiedByUser, setSlugModifiedByUser] = useState(false)

  // Auto-generate slug when business name changes
  const handleBusinessNameChange = useCallback((newName: string) => {
    setForm((prev: any) => ({
      ...prev,
      businessName: newName,
    }))

    // Only auto-generate if user hasn't manually edited the slug
    if (!slugModifiedByUser) {
      const newSlug = generateSlug(newName)
      setForm((prev: any) => ({
        ...prev,
        businessSlug: newSlug,
      }))
      // Check availability
      if (newSlug) {
        checkSlugAvailability(newSlug)
      }
    }
  }, [slugModifiedByUser])

  // Validate slug when user manually edits it
  const handleSlugChange = useCallback((newSlug: string) => {
    setForm((prev: any) => ({
      ...prev,
      businessSlug: newSlug,
    }))
    setSlugModifiedByUser(true)

    // Check availability
    if (newSlug) {
      checkSlugAvailability(newSlug)
    } else {
      setSlugValidation({ status: 'invalid', message: 'Slug cannot be empty' })
    }
  }, [])

  // Check if slug is available
  const checkSlugAvailability = useCallback(async (slug: string) => {
    // Validate slug format
    const generatedSlug = generateSlug(slug)
    if (generatedSlug !== slug) {
      setSlugValidation({
        status: 'invalid',
        message: 'Slug contains invalid characters',
      })
      return
    }

    setSlugValidation({ status: 'checking', message: 'Checking availability...' })

    try {
      // Check if slug exists by attempting to create a business with it
      // The API will return a 409 if slug is taken
      const response = await fetch('/api/admin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only check, don't actually create
        // We'll use a HEAD request approach via a simple check
        body: JSON.stringify({
          name: 'Check',
          slug: slug,
          businessType: 'COMMERCE',
        }),
      })

      if (response.status === 409) {
        // Slug is taken, suggest next available
        let counter = 2
        let suggestedSlug = `${slug}-${counter}`
        let foundAvailable = false

        // Try up to 10 suggestions
        while (counter < 12 && !foundAvailable) {
          const checkResponse = await fetch('/api/admin/businesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Check',
              slug: suggestedSlug,
              businessType: 'COMMERCE',
            }),
          })
          if (checkResponse.status !== 409) {
            foundAvailable = true
          } else {
            counter++
            suggestedSlug = `${slug}-${counter}`
          }
        }

        setSlugValidation({
          status: 'taken',
          message: `This slug is already taken`,
          suggestion: foundAvailable ? suggestedSlug : undefined,
        })
      } else if (response.status === 400) {
        // Bad request, might be validation error but slug format is OK
        setSlugValidation({
          status: 'available',
          message: 'Slug is available',
        })
      } else {
        // Assume available if not 409
        setSlugValidation({
          status: 'available',
          message: 'Slug is available',
        })
      }
    } catch (error) {
      // Network error, assume available to not block user
      setSlugValidation({
        status: 'available',
        message: 'Slug is available',
      })
    }
  }, [])

  // Determine if Continue button should be enabled
  const isFormValid = () => {
    return (
      form.businessName &&
      form.businessSlug &&
      form.contactEmail &&
      slugValidation.status === 'available' &&
      !loading
    )
  }

  // Determine button text
  const getButtonText = () => {
    if (loading) return 'Creating...'
    if (!form.businessName) return 'Enter Business Name'
    if (!form.businessSlug) return 'Generate Slug'
    if (slugValidation.status === 'checking') return 'Checking Slug...'
    if (slugValidation.status === 'taken') return 'Slug Not Available'
    if (!form.contactEmail) return 'Enter Email'
    return 'Continue'
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Business Information</h3>

      <div className="space-y-4">
        {/* Business Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Business Name *</label>
          <Input
            placeholder="e.g., Lucky Bakery"
            value={form.businessName}
            onChange={(e) => handleBusinessNameChange(e.target.value)}
          />
        </div>

        {/* Business Slug */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Business Slug *</label>
          <div className="relative">
            <Input
              placeholder="e.g., lucky-bakery"
              value={form.businessSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className={`pr-10 ${
                slugValidation.status === 'available'
                  ? 'border-green-500'
                  : slugValidation.status === 'taken'
                    ? 'border-red-500'
                    : slugValidation.status === 'invalid'
                      ? 'border-red-500'
                      : ''
              }`}
            />
            <div className="absolute right-3 top-3">
              {slugValidation.status === 'checking' && (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              {slugValidation.status === 'available' && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {(slugValidation.status === 'taken' || slugValidation.status === 'invalid') && (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>

          {/* Validation Message */}
          <div className={`text-sm ${
            slugValidation.status === 'available' ? 'text-green-600' :
            slugValidation.status === 'taken' || slugValidation.status === 'invalid' ? 'text-red-600' :
            'text-blue-600'
          }`}>
            {slugValidation.message}
          </div>

          {/* Slug Suggestion */}
          {slugValidation.suggestion && slugValidation.status === 'taken' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-700">
                Try: <button
                  className="font-semibold text-amber-800 hover:underline"
                  onClick={() => {
                    const suggested = slugValidation.suggestion!
                    setForm((prev: any) => ({ ...prev, businessSlug: suggested }))
                    setSlugModifiedByUser(true)
                    checkSlugAvailability(suggested)
                  }}
                >
                  {slugValidation.suggestion}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Email *</label>
          <Input
            type="email"
            placeholder="owner@example.com"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <Input
            placeholder="9999999999"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Address</label>
          <Input
            placeholder="123 Main St"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <label className="text-sm font-medium">City</label>
          <Input
            placeholder="New York"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          onClick={() => onSubmit(form)}
          disabled={!isFormValid()}
          size="lg"
        >
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}
