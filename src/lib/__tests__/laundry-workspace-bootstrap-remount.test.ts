// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { LaundryWorkspaceBootstrap } from '@/components/laundry/laundry-workspace-bootstrap'
/** children is optional here so createElement can take it as an argument. */
const Bootstrap = LaundryWorkspaceBootstrap as React.FC<{ businessId?: string; children?: React.ReactNode }>
import { useAuthStore } from '@/stores/auth-store'

// ============================================================================
// RE-VALIDATING A SESSION MUST NOT TEAR DOWN THE WORKSPACE.
//
// LaundryWorkspaceBootstrap gates the whole Laundry workspace behind an ordered
// Auth → Tenant → RBAC check. That gate is right on the FIRST render. The
// defect is that it runs the same way on every LATER run: the effect calls
// setStatus("loading") unconditionally, and "loading" renders a min-h-screen
// loader INSTEAD of children — so the entire workspace unmounts, waits on a
// network round-trip to /api/laundry/rbac/me, and mounts again from scratch.
//
// Its dependency array includes `token`, and the access token is rotated on a
// 20-minute interval (TOKEN_REFRESH_INTERVAL_MS in auth-provider), so this
// fires during ordinary work. For an operator on the Sorting queue the effect
// is: every local state goes (the open bag panel included), the document
// collapses from a 120-order list to one screen, the browser clamps scroll to
// the top, and about a second later — the length of the fetch — the page comes
// back at the "Scan barcode for Sorting" box.
//
// This mounts the REAL component and drives the REAL store.
// ============================================================================

let container: HTMLDivElement
let root: Root

const CHILD = 'workspace-child'

/** A child that records its own mount/unmount, the way the workstation would. */
let mounts = 0
let unmounts = 0
function Child() {
  React.useEffect(() => {
    mounts++
    return () => { unmounts++ }
  }, [])
  return React.createElement('div', { 'data-testid': CHILD }, 'Sorting workstation')
}

const childOnScreen = () => !!container.querySelector(`[data-testid="${CHILD}"]`)
const loaderOnScreen = () => (container.textContent || '').includes('Loading Laundry Workspace')

/** An authenticated, hydrated, synced session — the steady state of real use. */
function signIn(token: string) {
  useAuthStore.setState({
    isAuthenticated: true, token, _isHydrated: true, _isSynced: true,
  } as never)
}

beforeEach(() => {
  mounts = 0; unmounts = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('fetch', vi.fn(async () => ({
    status: 200,
    json: async () => ({ success: true, data: { businessId: 'biz-1' } }),
  })) as never)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function mount() {
  signIn('token-1')
  await act(async () => {
    root.render(
      React.createElement(Bootstrap, { businessId: 'biz-1' }, React.createElement(Child)),
    )
  })
  await act(async () => { await Promise.resolve() })
}

describe('1 · the first bootstrap gates the workspace, as designed', () => {
  it('renders the workspace once the RBAC check resolves', async () => {
    await mount()
    expect(childOnScreen()).toBe(true)
    expect(loaderOnScreen()).toBe(false)
    expect(mounts).toBe(1)
    expect(unmounts).toBe(0)
  })
})

describe('2 · a token rotation must not unmount the workspace', () => {
  it('keeps the same mounted child when the access token is refreshed', async () => {
    await mount()
    expect(mounts).toBe(1)

    // What auth-provider does every TOKEN_REFRESH_INTERVAL_MS.
    await act(async () => { useAuthStore.setState({ token: 'token-2' } as never) })
    await act(async () => { await Promise.resolve() })

    // THE DEFECT: before the fix the child is torn down and rebuilt here, and
    // the operator's page collapses to a single loading screen in between.
    expect(unmounts, 'workspace was unmounted by a token refresh').toBe(0)
    expect(mounts, 'workspace was re-mounted by a token refresh').toBe(1)
    expect(childOnScreen()).toBe(true)
  })

  it('never shows the full-screen loader again once the workspace is up', async () => {
    await mount()
    let sawLoader = false
    for (const t of ['token-2', 'token-3']) {
      await act(async () => { useAuthStore.setState({ token: t } as never) })
      if (loaderOnScreen()) sawLoader = true
      await act(async () => { await Promise.resolve() })
      if (loaderOnScreen()) sawLoader = true
    }
    expect(sawLoader, 'the min-h-screen loader replaced the workspace mid-session').toBe(false)
    expect(childOnScreen()).toBe(true)
  })

  it('re-validates in the background — the RBAC call still happens', async () => {
    await mount()
    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    await act(async () => { useAuthStore.setState({ token: 'token-2' } as never) })
    await act(async () => { await Promise.resolve() })
    const after = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    expect(after).toBeGreaterThan(before)   // the check is NOT skipped, only silent
  })
})

describe('3 · a session that genuinely dies still recovers, not silently', () => {
  it('a 401 on re-validation still shows the recovery screen', async () => {
    await mount()
    expect(childOnScreen()).toBe(true)
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401, json: async () => ({}) })) as never)
    await act(async () => { useAuthStore.setState({ token: 'dead' } as never) })
    await act(async () => { await Promise.resolve() })
    expect(container.textContent).toContain('Unable to load this workspace')
    expect(childOnScreen()).toBe(false)
  })
})
