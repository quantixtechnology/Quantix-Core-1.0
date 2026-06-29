'use client'

// ============================================================================
// Force / Change Password — shared, product-agnostic
//
// Reused by Business Owners and Employees (and platform users). When a user has
// mustChangePassword=true (set at provisioning, on user creation, or after a
// reset), the login flow routes here and dashboard access is blocked until the
// password is changed. Registry-driven redirect on success via
// getWorkspaceEntryRoute — no product-specific logic.
// ============================================================================

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { getWorkspaceEntryRoute } from '@/lib/workspace-routes'

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <ChangePasswordForm />
    </Suspense>
  )
}

function ChangePasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const u = localStorage.getItem('quantix_auth_user')
      const parsed = u ? JSON.parse(u) : null
      if (!parsed?.id) {
        router.replace('/')
        return
      }
      setUserId(parsed.id)
    } catch {
      router.replace('/')
    }
  }, [router])

  // Where to send the user after a successful change: explicit ?next=, else the
  // product workspace route from ?product=, else app root.
  const destination = (): string => {
    const explicit = params.get('next')
    if (explicit) return explicit
    const product = params.get('product')
    if (product) return getWorkspaceEntryRoute(product)
    return '/'
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 6) { setError('New password must be at least 6 characters'); return }
    if (next !== confirm) { setError('New password and confirmation do not match'); return }
    if (!userId) { setError('Session expired. Please sign in again.'); return }
    setBusy(true)
    try {
      const token = localStorage.getItem('quantix_auth_token')
      const res = await fetch('/api/core/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, currentPassword: current, newPassword: next }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || 'Failed to change password')

      // Reflect the cleared flag in the stored session so guards stop redirecting here.
      try {
        const u = localStorage.getItem('quantix_auth_user')
        if (u) {
          const parsed = JSON.parse(u)
          parsed.mustChangePassword = false
          localStorage.setItem('quantix_auth_user', JSON.stringify(parsed))
        }
      } catch { /* non-blocking */ }

      router.replace(destination())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-gray-900">Change your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          For security, you must set a new password before continuing.
        </p>
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-gray-600">Current password</label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="text-sm text-gray-600">New password</label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Confirm new password</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Change password &amp; continue
          </Button>
        </form>
      </Card>
    </div>
  )
}
