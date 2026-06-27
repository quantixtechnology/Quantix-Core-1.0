'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  initialData: any
  onSubmit: (data: any) => void
  loading: boolean
}

// Indian States and Union Territories
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
  'Delhi',
  'Puducherry',
  'Ladakh',
  'Jammu and Kashmir',
]

// Generate slug from business name
function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

// Validate PIN code (Indian PIN code format: 6 digits)
function validatePinCode(pinCode: string): boolean {
  return /^\d{6}$/.test(pinCode.trim())
}

// Validate email
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validate mobile (10 digits)
function validateMobile(mobile: string): boolean {
  return /^\d{10}$/.test(mobile.trim())
}

export function BusinessInfoStep({ initialData, onSubmit, loading }: Props) {
  const [form, setForm] = useState({
    businessName: initialData.businessName || '',
    businessSlug: initialData.businessSlug || '',
    ownerName: initialData.ownerName || '',
    contactEmail: initialData.contactEmail || '',
    contactPhone: initialData.contactPhone || '',
    address: initialData.address || '',
    addressLine2: initialData.addressLine2 || '',
    city: initialData.city || '',
    state: initialData.state || '',
    pinCode: initialData.pinCode || '',
    country: initialData.country || 'India',
  })

  const [slugValidation, setSlugValidation] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
    message: string
    suggestion?: string
  }>({ status: 'idle', message: '' })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [slugModifiedByUser, setSlugModifiedByUser] = useState(false)

  // Validate a single field
  const validateField = useCallback((fieldName: string, value: string): string => {
    switch (fieldName) {
      case 'contactEmail':
        return value && !validateEmail(value) ? 'Invalid email format' : ''
      case 'contactPhone':
        return value && !validateMobile(value) ? 'Mobile must be 10 digits' : ''
      case 'pinCode':
        return value && !validatePinCode(value) ? 'PIN Code must be 6 digits' : ''
      default:
        return ''
    }
  }, [])

  // Handle field changes
  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setForm((prev) => ({ ...prev, [fieldName]: value }))

    // Clear error for this field if it becomes valid
    const error = validateField(fieldName, value)
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }))

    // Auto-generate slug when business name changes
    if (fieldName === 'businessName' && !slugModifiedByUser) {
      const newSlug = generateSlug(value)
      setForm((prev) => ({ ...prev, businessSlug: newSlug }))
      if (newSlug) {
        checkSlugAvailability(newSlug)
      }
    }
  }, [slugModifiedByUser, validateField])

  // Handle slug change
  const handleSlugChange = useCallback((newSlug: string) => {
    setForm((prev) => ({ ...prev, businessSlug: newSlug }))
    setSlugModifiedByUser(true)

    if (newSlug) {
      checkSlugAvailability(newSlug)
    } else {
      setSlugValidation({ status: 'invalid', message: 'Slug cannot be empty' })
    }
  }, [])

  // Check slug availability
  const checkSlugAvailability = useCallback(async (slug: string) => {
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
      const response = await fetch('/api/admin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Check',
          slug: slug,
          businessType: 'COMMERCE',
        }),
      })

      if (response.status === 409) {
        let counter = 2
        let suggestedSlug = `${slug}-${counter}`
        let foundAvailable = false

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
          message: 'This slug is already taken',
          suggestion: foundAvailable ? suggestedSlug : undefined,
        })
      } else {
        setSlugValidation({
          status: 'available',
          message: 'Slug is available',
        })
      }
    } catch (error) {
      setSlugValidation({
        status: 'available',
        message: 'Slug is available',
      })
    }
  }, [])

  // Check if form is valid
  const isFormValid = (): boolean => {
    return (
      form.businessName.trim() &&
      form.businessSlug.trim() &&
      form.ownerName.trim() &&
      validateEmail(form.contactEmail) &&
      validateMobile(form.contactPhone) &&
      form.address.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      validatePinCode(form.pinCode) &&
      slugValidation.status === 'available' &&
      !loading
    )
  }

  const getButtonText = (): string => {
    if (loading) return 'Creating...'
    if (!form.businessName) return 'Enter Business Name'
    if (!form.businessSlug) return 'Generate Slug'
    if (slugValidation.status === 'checking') return 'Checking Slug...'
    if (slugValidation.status === 'taken') return 'Slug Not Available'
    if (!form.ownerName) return 'Enter Owner Name'
    if (!validateEmail(form.contactEmail)) return 'Enter Valid Email'
    if (!validateMobile(form.contactPhone)) return 'Enter Valid Mobile'
    if (!form.address) return 'Enter Address'
    if (!form.city) return 'Enter City'
    if (!form.state) return 'Select State'
    if (!validatePinCode(form.pinCode)) return 'Enter Valid PIN Code'
    return 'Continue'
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Business Information</h3>

      <div className="space-y-4 grid grid-cols-2 gap-4">
        {/* Business Name */}
        <div className="space-y-2 col-span-2">
          <label className="text-sm font-medium">Business Name *</label>
          <Input
            placeholder="e.g., Lucky Bakery"
            value={form.businessName}
            onChange={(e) => handleFieldChange('businessName', e.target.value)}
          />
        </div>

        {/* Business Slug */}
        <div className="space-y-2 col-span-2">
          <label className="text-sm font-medium">Business Slug *</label>
          <div className="relative">
            <Input
              placeholder="e.g., lucky-bakery"
              value={form.businessSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className={`pr-10 ${
                slugValidation.status === 'available'
                  ? 'border-green-500'
                  : slugValidation.status === 'taken' || slugValidation.status === 'invalid'
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
          <div className={`text-sm ${
            slugValidation.status === 'available' ? 'text-green-600' :
            slugValidation.status === 'taken' || slugValidation.status === 'invalid' ? 'text-red-600' :
            'text-blue-600'
          }`}>
            {slugValidation.message}
          </div>
          {slugValidation.suggestion && slugValidation.status === 'taken' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-700">
                Try: <button
                  className="font-semibold text-amber-800 hover:underline"
                  onClick={() => {
                    const suggested = slugValidation.suggestion!
                    setForm((prev) => ({ ...prev, businessSlug: suggested }))
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

        {/* Owner Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Owner Name *</label>
          <Input
            placeholder="e.g., John Doe"
            value={form.ownerName}
            onChange={(e) => handleFieldChange('ownerName', e.target.value)}
          />
        </div>

        {/* Business Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Business Email *</label>
          <Input
            type="email"
            placeholder="owner@example.com"
            value={form.contactEmail}
            onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
            className={fieldErrors.contactEmail ? 'border-red-500' : ''}
          />
          {fieldErrors.contactEmail && (
            <p className="text-xs text-red-600">{fieldErrors.contactEmail}</p>
          )}
        </div>

        {/* Business Mobile */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Business Mobile *</label>
          <Input
            placeholder="9999999999"
            value={form.contactPhone}
            onChange={(e) => handleFieldChange('contactPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            maxLength="10"
            className={fieldErrors.contactPhone ? 'border-red-500' : ''}
          />
          {fieldErrors.contactPhone && (
            <p className="text-xs text-red-600">{fieldErrors.contactPhone}</p>
          )}
        </div>

        {/* Address Line 1 */}
        <div className="space-y-2 col-span-2">
          <label className="text-sm font-medium">Address Line 1 *</label>
          <Input
            placeholder="e.g., 123 Main Street"
            value={form.address}
            onChange={(e) => handleFieldChange('address', e.target.value)}
          />
        </div>

        {/* Address Line 2 */}
        <div className="space-y-2 col-span-2">
          <label className="text-sm font-medium">Address Line 2</label>
          <Input
            placeholder="e.g., Apartment, Suite (optional)"
            value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <label className="text-sm font-medium">City *</label>
          <Input
            placeholder="e.g., Mumbai"
            value={form.city}
            onChange={(e) => handleFieldChange('city', e.target.value)}
          />
        </div>

        {/* State */}
        <div className="space-y-2">
          <label className="text-sm font-medium">State *</label>
          <Select value={form.state} onValueChange={(value) => handleFieldChange('state', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select State or UT" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* PIN Code */}
        <div className="space-y-2">
          <label className="text-sm font-medium">PIN Code *</label>
          <Input
            placeholder="400001"
            value={form.pinCode}
            onChange={(e) => handleFieldChange('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength="6"
            className={fieldErrors.pinCode ? 'border-red-500' : ''}
          />
          {fieldErrors.pinCode && (
            <p className="text-xs text-red-600">{fieldErrors.pinCode}</p>
          )}
        </div>

        {/* Country */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Country</label>
          <Input
            placeholder="India"
            value={form.country}
            disabled
            className="bg-gray-100"
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
