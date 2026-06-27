'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Loader2, Package, MapPin, TrendingUp, Check, ChevronLeft, ChevronRight } from 'lucide-react'

// Step components
import { BusinessInfoStep } from './steps/business-info-step'
import { ProductSelectionStep } from './steps/product-selection-step'
import { PlanSelectionStep } from './steps/plan-selection-step'
import { ReviewStep } from './steps/review-step'
import { ProvisioningProgressStep } from './steps/provisioning-progress-step'
import { ReadyStep } from './steps/ready-step'

export type OnboardingStep = 'info' | 'product' | 'plan' | 'review' | 'provisioning' | 'ready'

interface ResourceAllocation {
  storageGB: number
  maxUsers: number
  maxStores: number
}

interface OnboardingState {
  // Business Info
  businessName: string
  businessSlug: string
  ownerName?: string
  contactEmail: string
  contactPhone: string
  address?: string
  addressLine2?: string
  city?: string
  state?: string
  pinCode?: string
  country: string

  // Product & Plan
  productCode?: string
  subscriptionPlanCode?: string

  // Resource Allocation
  resourceAllocation: ResourceAllocation

  // Workspace
  businessId?: string
  workspaceId?: string
}

interface WizardProps {
  businessId?: string
  initialStep?: OnboardingStep
}

export function BusinessOnboardingWizard({ businessId, initialStep = 'info' }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResumingExisting, setIsResumingExisting] = useState(!!businessId)

  const [state, setState] = useState<OnboardingState>({
    businessName: '',
    businessSlug: '',
    country: 'India',
    contactEmail: '',
    contactPhone: '',
    resourceAllocation: {
      storageGB: 10,
      maxUsers: 10,
      maxStores: 1,
    },
  })

  const [provisioningProgress, setProvisioningProgress] = useState<Array<{
    step: string
    status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
  }>>([])

  // Load existing business if resuming
  useEffect(() => {
    if (businessId && isResumingExisting) {
      const loadBusiness = async () => {
        try {
          const res = await fetch(`/api/admin/businesses/${businessId}`)
          if (res.ok) {
            const result = await res.json()
            const business = result.data
            setState((prev) => ({
              ...prev,
              businessName: business.name || '',
              businessSlug: business.slug || '',
              ownerName: business.ownerName || '',
              contactEmail: business.contactEmail || '',
              contactPhone: business.contactPhone || '',
              address: business.address || '',
              city: business.city || '',
              state: business.state || '',
              pinCode: business.pincode || '',
              country: business.country || 'India',
              productCode: business.productCode || undefined,
              subscriptionPlanCode: business.subscriptionPlanCode || undefined,
              businessId: business.id,
            }))
          }
        } catch (err) {
          console.error('Failed to load business:', err)
        }
      }
      loadBusiness()
      setIsResumingExisting(false)
    }
  }, [businessId, isResumingExisting])

  // Step 1: Business Information
  const handleBusinessInfoSubmit = async (data: any) => {
    try {
      setLoading(true)
      setError(null)

      // Create business with new payload format
      const response = await fetch('/api/admin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          slug: data.businessSlug,
          ownerName: data.ownerName,
          email: data.contactEmail,
          phone: data.contactPhone,
          address1: data.address,
          address2: data.addressLine2,
          city: data.city,
          state: data.state,
          pincode: data.pinCode,
          country: data.country || 'India',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Display error message
        const errorMsg = result.message || result.error || 'Failed to create business'
        setError(errorMsg)
        return
      }

      setState((prev) => ({
        ...prev,
        ...data,
        businessId: result.data?.id,
      }))

      setCurrentStep('product')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Product Selection
  const handleProductSelect = (productCode: string) => {
    setState((prev) => ({
      ...prev,
      productCode,
      subscriptionPlanCode: undefined, // Reset plan
    }))
    setCurrentStep('plan')
  }

  // Step 3: Plan Selection
  const handlePlanSelect = (planCode: string) => {
    setState((prev) => ({
      ...prev,
      subscriptionPlanCode: planCode,
    }))
    setCurrentStep('review')
  }

  // Step 4: Review & Provisioning
  const handleReviewSubmit = async () => {
    try {
      setLoading(true)
      setError(null)

      // Assign product to business
      const assignResponse = await fetch('/api/admin/businesses/assign-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: state.businessId,
          productCode: state.productCode,
          subscriptionPlanCode: state.subscriptionPlanCode,
        }),
      })

      if (!assignResponse.ok) {
        throw new Error('Failed to assign product')
      }

      setCurrentStep('provisioning')

      // Trigger provisioning with customized resource allocation
      const provisionResponse = await fetch('/api/admin/businesses/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: state.businessId,
          resourceAllocation: state.resourceAllocation,
        }),
      })

      if (!provisionResponse.ok) {
        throw new Error('Provisioning failed')
      }

      const provisioningResult = await provisionResponse.json()

      setState((prev) => ({
        ...prev,
        workspaceId: provisioningResult.data.workspaceId,
      }))

      // Monitor provisioning progress
      monitorProvisioning(state.businessId!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setCurrentStep('review')
    } finally {
      setLoading(false)
    }
  }

  // Navigation handlers
  const handlePrevious = () => {
    const stepOrder: OnboardingStep[] = ['info', 'product', 'plan', 'review', 'provisioning', 'ready']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1])
      setError(null)
    }
  }

  const handleNext = () => {
    const stepOrder: OnboardingStep[] = ['info', 'product', 'plan', 'review', 'provisioning', 'ready']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
      setError(null)
    }
  }

  const handleClose = () => {
    // Navigate back to businesses list
    const adminStore = (globalThis as any).__ADMIN_STORE
    if (adminStore?.setActivePage) {
      adminStore.setActivePage('businesses')
    }
  }

  // Monitor provisioning progress
  const monitorProvisioning = async (businessId: string) => {
    try {
      // Poll provisioning status
      const pollStatus = async () => {
        const response = await fetch(`/api/admin/businesses/provision?businessId=${businessId}`)
        const result = await response.json()

        if (result.data?.steps) {
          setProvisioningProgress(
            result.data.steps.map((step: any) => ({
              step: formatStepName(step.name),
              status: step.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
            }))
          )

          // Add in-progress step
          const inProgressSteps = result.data.steps.filter((s: any) => s.status === 'FAILED')
          if (inProgressSteps.length === 0 && result.data.steps.length > 0) {
            const completed = result.data.steps.filter((s: any) => s.status === 'COMPLETED').length
            if (completed < result.data.steps.length) {
              setProvisioningProgress((prev) => {
                const updated = [...prev]
                if (updated[completed]) {
                  updated[completed].status = 'IN_PROGRESS'
                }
                return updated
              })
            }
          }

          // Check if complete
          if (result.data.status === 'COMPLETED') {
            setCurrentStep('ready')
            return
          }
        }

        // Continue polling
        setTimeout(pollStatus, 2000)
      }

      pollStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to monitor provisioning')
    }
  }

  const steps: Array<{ id: OnboardingStep; label: string; icon: any }> = [
    { id: 'info', label: 'Business Info', icon: Package },
    { id: 'product', label: 'Product', icon: MapPin },
    { id: 'plan', label: 'Plan', icon: TrendingUp },
    { id: 'review', label: 'Review', icon: Check },
    { id: 'provisioning', label: 'Setup', icon: Loader2 },
    { id: 'ready', label: 'Ready', icon: CheckCircle2 },
  ]

  const getStepStatus = (stepId: OnboardingStep) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId)
    const currentIndex = steps.findIndex((s) => s.id === currentStep)

    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'pending'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Business</h1>
          <p className="text-lg text-gray-600">Complete setup with automatic provisioning</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-8">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id)
              const Icon = step.icon
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                      status === 'completed'
                        ? 'bg-green-100 border-green-500'
                        : status === 'current'
                          ? 'bg-blue-100 border-blue-500'
                          : 'bg-gray-100 border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${
                        status === 'completed'
                          ? 'text-green-600'
                          : status === 'current'
                            ? 'text-blue-600'
                            : 'text-gray-400'
                      }`}
                    />
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Step labels */}
          <div className="flex justify-between text-sm font-medium text-gray-600">
            {steps.map((step) => (
              <span key={step.id}>{step.label}</span>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Step Content */}
        <Card className="shadow-xl">
          <CardContent className="pt-8 pb-8">
            {currentStep === 'info' && (
              <BusinessInfoStep
                initialData={state}
                onSubmit={handleBusinessInfoSubmit}
                loading={loading}
              />
            )}

            {currentStep === 'product' && (
              <>
                <ProductSelectionStep onProductSelect={handleProductSelect} />
                <div className="flex justify-between gap-2 mt-8 pt-6 border-t">
                  <Button variant="outline" onClick={handlePrevious}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <div className="w-px bg-gray-200" />
                </div>
              </>
            )}

            {currentStep === 'plan' && state.productCode && (
              <>
                <PlanSelectionStep
                  productCode={state.productCode}
                  onPlanSelect={handlePlanSelect}
                />
                <div className="flex justify-between gap-2 mt-8 pt-6 border-t">
                  <Button variant="outline" onClick={handlePrevious}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <div className="w-px bg-gray-200" />
                </div>
              </>
            )}

            {currentStep === 'review' && (
              <>
                <ReviewStep
                  state={state}
                  resourceAllocation={state.resourceAllocation}
                  onResourceChange={(allocation) =>
                    setState((prev) => ({ ...prev, resourceAllocation: allocation }))
                  }
                  onSubmit={handleReviewSubmit}
                  loading={loading}
                />
                <div className="flex justify-between gap-2 mt-8 pt-6 border-t">
                  <Button variant="outline" onClick={handlePrevious}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <Button onClick={handleReviewSubmit} disabled={loading} size="lg">
                    {loading ? 'Starting Provisioning...' : 'Start Provisioning'}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'provisioning' && (
              <ProvisioningProgressStep
                steps={provisioningProgress}
              />
            )}

            {currentStep === 'ready' && state.businessId && (
              <ReadyStep businessId={state.businessId} state={state} onClose={handleClose} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatStepName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
