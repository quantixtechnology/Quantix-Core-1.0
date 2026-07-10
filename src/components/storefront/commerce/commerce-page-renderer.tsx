"use client"

// Phase 3 — CommercePageRenderer.
//
// Receives a resolved PUBLISHED page (from /api/core/storefront/template) and
// renders its visible sections in published order through the section registry.
// Guarantees:
//   • sections render in published sortOrder
//   • hidden sections (visibilityConfig) do not render
//   • unknown section types fail safe (skipped, logged) — never crash the page
//   • one throwing section is isolated by an error boundary — the rest render
//   • HEADER/FOOTER are omitted here (provided by the functional global chrome)
import React from "react"
import type { LiveSection } from "@/lib/commerce/live-storefront"
import { SECTION_COMPONENTS, CHROME_SECTIONS, type RenderContext } from "./commerce-sections"

class SectionErrorBoundary extends React.Component<{ type: string; children: React.ReactNode }, { failed: boolean }> {
  constructor(props: { type: string; children: React.ReactNode }) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error(`[CommerceSection] "${this.props.type}" failed to render`, err) }
  render() { return this.state.failed ? null : this.props.children }
}

function isHidden(section: LiveSection): boolean {
  const v = section.visibilityConfig || {}
  // Explicit master hide flag.
  if (v.hidden === true || v.visible === false) return true
  // If ALL breakpoints are explicitly false, the section is hidden everywhere.
  const bps = ["desktop", "tablet", "mobile"] as const
  const present = bps.filter((b) => typeof v[b] === "boolean")
  if (present.length > 0 && present.every((b) => v[b] === false)) return true
  return false
}

export function CommercePageRenderer({ sections, ctx }: { sections: LiveSection[]; ctx: RenderContext }) {
  const body = (sections || [])
    .filter((s) => !CHROME_SECTIONS.has(s.type))
    .filter((s) => !isHidden(s))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div data-commerce-template-renderer>
      {body.map((section) => {
        const Component = SECTION_COMPONENTS[section.type]
        if (!Component) {
          // Unknown section type → fail safe (skip). Logged for diagnostics.
          if (typeof window !== "undefined") console.warn(`[CommercePageRenderer] no renderer for section type "${section.type}" — skipped`)
          return null
        }
        return (
          <SectionErrorBoundary key={section.id} type={section.type}>
            <Component section={section} ctx={ctx} />
          </SectionErrorBoundary>
        )
      })}
    </div>
  )
}
