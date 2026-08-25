import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The business fallback showed only reassurance — the error was nowhere on
// screen, not even in development. Its wording ("loading your business data")
// also reads like a failed request when what it means is a RENDER throw, which
// sends every investigation to the network tab first.
// ============================================================================

const SRC = readFileSync(join(__dirname, '../../components/error/error-boundary.tsx'), 'utf8')

describe('the business error screen names its cause', () => {
  it('renders the error message', () => {
    expect(SRC).toContain('{error?.message || "Unknown error"}')
  })

  it('renders the component stack, which says WHERE it threw', () => {
    expect(SRC).toContain('componentStack.trim().split')
    // …and the boundary actually passes it down.
    expect(SRC).toContain('componentStack={this.state.errorInfo?.componentStack}')
    expect(SRC).toContain('componentStack={componentStack}')
  })

  it('offers the details for copying, so a report is one click', () => {
    expect(SRC).toContain('Copy details')
    expect(SRC).toContain('navigator.clipboard?.writeText(details)')
    expect(SRC).toContain('URL: ${window.location.href}')
  })

  it('is not hidden behind a development check', () => {
    const fb = SRC.slice(SRC.indexOf('function BusinessErrorFallback'), SRC.indexOf('/** Customer app error fallback'))
    // The CODE form, not the word — the comment above the block mentions it.
    expect(fb).not.toContain('process.env.NODE_ENV')
    expect(fb).not.toContain('isDevelopment')
  })

  it('says render, not "loading data" — the old wording misdirected', () => {
    expect(SRC).toContain('This screen failed to render.')
    expect(SRC).not.toContain('We encountered an error loading your business data')
  })

  it('keeps the reassurance and the retry', () => {
    expect(SRC).toContain('Your orders and operations are not affected.')
    expect(SRC).toContain('Try Again')
  })
})
