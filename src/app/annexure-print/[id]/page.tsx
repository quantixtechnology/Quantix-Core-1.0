"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { authFetch } from "@/lib/admin-fetch"

interface AnnexureData {
  id: string
  label: string
  annexureRef?: string
  title: string
  content: string
  createdAt: string
  offerLetter: {
    offerRef?: string
    candidateName: string
    designation: string
    joiningDate?: string
    department?: string
    workLocation?: string
  }
}

interface HrmsSettings {
  companyName?: string
  registeredAddress?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  authorizedSignatory?: string
  authorizedSignatoryDesignation?: string
  signatureImage?: string
  stampImage?: string
  website?: string
  companyPhone?: string
  companyEmail?: string
}

interface PlatformSettings {
  companyName?: string
  companyWebsite?: string
  logoUrl?: string
  compactLogoUrl?: string
  watermarkUrl?: string
  primaryColor?: string
  secondaryColor?: string
  hrmsAccentColor?: string
  signatoryName?: string
  signatoryDesignation?: string
  signatorySignUrl?: string
  signatoryStampUrl?: string
}

function groupHtmlSections(html: string): string {
  const parts = html.split(/(?=<h[1-3][^>]*>)/i)
  return parts.map((part) => {
    const isSection = /^<h[1-3][^>]*>/i.test(part.trimStart())
    return isSection ? `<div class="doc-section">${part}</div>` : part
  }).join('\n')
}

function processPageBreaks(html: string): string {
  return html
    .replace(/<p[^>]*>\s*\{\{PAGE_BREAK\}\}\s*<\/p>/gi, '<div class="page-break"></div>')
    .replace(/\{\{PAGE_BREAK\}\}/g, '<div class="page-break"></div>')
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderContent(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('<')) return processPageBreaks(groupHtmlSections(content))
  return content
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.trim() === '{{PAGE_BREAK}}'
      ? '<div class="page-break"></div>'
      : `<p class="body-p">${escHtml(l)}</p>`,
    )
    .join('\n')
}

export default function AnnexurePrintPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [annexure, setAnnexure] = useState<AnnexureData | null>(null)
  const [hrms, setHrms] = useState<HrmsSettings>({})
  const [platform, setPlatform] = useState<PlatformSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return

    // silentFailure: true — prevents clearAuthAndRedirect() on 401,
    // which would fire a StorageEvent killing the parent app session.
    const opts = { silentFailure: true } as const
    const safeJson = (res: Response) =>
      res.ok
        ? res.json().catch(() => ({ success: false }))
        : Promise.resolve({ success: false, status: res.status })

    Promise.all([
      authFetch(`/api/admin/hrms/annexures/${id}`, opts),
      authFetch('/api/admin/hrms/settings', opts),
      authFetch('/api/admin/branding', opts),
    ])
      .then(([ar, hr, pr]) => {
        if (ar.status === 401 || ar.status === 403) {
          throw new Error('Session expired or access denied. Please sign in and try again.')
        }
        return Promise.all([ar.json(), safeJson(hr), safeJson(pr)])
      })
      .then(([aj, hj, pj]) => {
        if (!aj.success) throw new Error(aj.error || 'Annexure not found')
        setAnnexure(aj.data)
        if (hj.success && hj.data) setHrms(hj.data as HrmsSettings)
        if (pj.success && pj.data) setPlatform(pj.data as PlatformSettings)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!loading && annexure && typeof window !== 'undefined') {
      if (new URLSearchParams(window.location.search).get('print') === '1') {
        setTimeout(() => window.print(), 800)
      }
    }
  }, [loading, annexure])

  const handleDownloadPdf = async () => {
    if (!annexure) return
    try {
      setDownloading(true)
      const res = await authFetch(`/api/admin/hrms/annexures/${id}/pdf`, { silentFailure: true } as Parameters<typeof authFetch>[1])
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const ref  = annexure.annexureRef || `Annexure-${annexure.label}`
      a.download = `${ref.replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial,sans-serif', color: '#6b7280', fontSize: 14 }}>
      Loading document…
    </div>
  )

  if (error || !annexure) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial,sans-serif', color: '#dc2626', fontSize: 14 }}>
      {error || 'Document not found. Please sign in and try again.'}
    </div>
  )

  const accent    = hrms.primaryColor   || platform.hrmsAccentColor || platform.primaryColor  || '#1E3A8A'
  const secondary = hrms.secondaryColor || platform.secondaryColor  || '#475569'
  const company   = hrms.companyName    || platform.companyName     || 'Quantix Technology'
  const logoUrl   = platform.logoUrl    || platform.compactLogoUrl  || hrms.logo || null
  const watermarkUrl = platform.watermarkUrl || null

  const footerAddress = (hrms.registeredAddress || '').replace(/\n+/g, ', ').trim()
  const footerContact = [hrms.companyPhone, hrms.companyEmail, hrms.website || platform.companyWebsite]
    .filter(Boolean).join(' | ')

  const annexureRef  = annexure.annexureRef || `Annexure ${annexure.label}`
  const offerRef     = annexure.offerLetter.offerRef || ''
  const dateStr      = new Date(annexure.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const bodyHtml     = renderContent(annexure.content)

  const sigImageUrl = platform.signatoryStampUrl || platform.signatorySignUrl || hrms.stampImage || hrms.signatureImage || null
  const sigName     = platform.signatoryName        || hrms.authorizedSignatory            || 'Authorized Signatory'
  const sigDesig    = platform.signatoryDesignation || hrms.authorizedSignatoryDesignation || ''

  return (
    <>
      <style>{`
/* ─── Reset ──────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.35;
  color: #1a1a1a;
  background: #e5e7eb;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ─── Screen shell ───────────────────────────────────────── */
.page-shell {
  max-width: 800px;
  margin: 28px auto 56px;
  box-shadow: 0 4px 32px rgba(0,0,0,0.16);
}

/* ─── Document: flex column so doc-body(flex:1) pushes footer to bottom ─ */
.doc {
  background: #fff;
  min-height: 1122px;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ─── Watermark ──────────────────────────────────────────── */
.doc-watermark {
  position: absolute; inset: 0;
  pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  z-index: 0; overflow: hidden;
}
.doc-watermark img {
  max-width: 52%; max-height: 52%;
  object-fit: contain; opacity: 0.06;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* All structural children above watermark */
.doc-header-region, .doc-body, .doc-footer, .accent-bar-bottom,
.title-band { position: relative; z-index: 1; }

/* ─── Accent bars ────────────────────────────────────────── */
.accent-bar-top    { height: 5px; background: ${accent}; }
.accent-bar-bottom { height: 4px; background: ${accent}; }

/* ─── Header ─────────────────────────────────────────────── */
.doc-header {
  padding: 14px 40px 12px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  border-bottom: 2px solid ${accent};
  background: #fff;
}
.brand-logo {
  width: auto; max-width: 210px; min-width: 140px;
  height: auto; max-height: 54px;
  object-fit: contain; display: block; image-rendering: auto;
}
.brand-name-text {
  font-size: 13pt; font-weight: 800; color: #0f172a;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.doc-meta {
  text-align: right; font-size: 8pt; color: #374151; line-height: 1.7; flex-shrink: 0;
}
.doc-ref {
  font-family: 'Courier New', monospace; font-size: 7.5pt;
  background: #f3f4f6; border: 1px solid #e5e7eb;
  padding: 2px 7px; border-radius: 3px; display: inline-block;
  margin-bottom: 3px; letter-spacing: 0.06em;
}

/* ─── Title band ─────────────────────────────────────────── */
.title-band    { background: ${accent}; padding: 8px 40px 10px; }
.doc-title     { font-size: 11pt; font-weight: 700; color: #fff; letter-spacing: 0.18em; text-transform: uppercase; }
.doc-subtitle  { font-size: 8.5pt; color: rgba(255,255,255,0.82); letter-spacing: 0.06em; margin-top: 3px; }
.doc-annexure-ref { font-size: 6.5pt; color: rgba(255,255,255,0.58); font-style: italic; margin-top: 2px; letter-spacing: 0.02em; }

/* ─── Body: flex:1 absorbs extra space, pushing footer to the bottom ─── */
.doc-body { flex: 1; padding: 16px 40px 20px; }

/* ─── Content body ───────────────────────────────────────── */
.content-body { font-size: 9.5pt; line-height: 1.4; color: #1e293b; }
.content-body .doc-section { break-inside: avoid; page-break-inside: avoid; }
.content-body .sec-heading {
  font-size: 8.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: ${accent}; margin: 12px 0 5px; padding-bottom: 4px; border-bottom: 1.5px solid #e2e8f0;
  break-after: avoid; page-break-after: avoid;
}
.content-body h1 { font-size: 12pt; font-weight: 700; color: #0f172a; margin: 14px 0 6px; break-after: avoid; page-break-after: avoid; }
.content-body h2 { font-size: 10pt; font-weight: 600; color: ${accent}; margin: 11px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; break-after: avoid; page-break-after: avoid; }
.content-body h3 { font-size: 9pt; font-weight: 600; color: ${secondary}; letter-spacing: 0.06em; text-transform: uppercase; margin: 9px 0 4px; break-after: avoid; page-break-after: avoid; }
.content-body p, .content-body .body-p { margin-bottom: 5px; orphans: 3; widows: 3; }
.content-body strong { font-weight: 700; color: #0f172a; }
.content-body em     { font-style: italic; }
.content-body u      { text-decoration: underline; }
.content-body ul, .content-body ol { padding-left: 18px; margin: 4px 0 8px; break-inside: avoid; page-break-inside: avoid; }
.content-body ul { list-style-type: disc; }
.content-body ol { list-style-type: decimal; }
.content-body li { margin-bottom: 2px; font-size: 9.5pt; break-inside: avoid; }
.content-body hr, .content-body .sec-rule { border: none; border-top: 1px solid #e5e7eb; margin: 8px 0; }
.content-body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.5pt; break-inside: avoid; page-break-inside: avoid; }
.content-body table th { background: ${accent}18; color: #0f172a; font-weight: 700; padding: 5px 8px; border: 1px solid #d1d5db; text-align: left; }
.content-body table td { padding: 4px 8px; border: 1px solid #e5e7eb; }
.content-body table tr:nth-child(even) td { background: #f8fafc; }

/* ─── Signatory ──────────────────────────────────────────── */
.signatory-section { margin-top: 24px; padding-top: 14px; border-top: 1.5px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid; }
.signatory-label { font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 16px; }
.sig-block { display: flex; flex-direction: column; max-width: 260px; }
.sig-for { font-size: 6pt; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; font-weight: 700; margin-bottom: 12px; }
.sig-img-wrap { display: flex; align-items: flex-end; min-height: 90px; padding-bottom: 6px; }
.sig-img-wrap img { max-height: 120px; width: auto; max-width: 260px; object-fit: contain; display: block; image-rendering: high-quality; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sig-line { width: 240px; border: none; border-top: 1.5px solid #374151; margin: 0 0 8px; }
.sig-name  { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.sig-desig { font-size: 8.5pt; color: #374151; margin-bottom: 3px; }
.sig-auth  { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-top: 2px; }

/* ─── Page break token ───────────────────────────────────── */
.page-break { page-break-before: always; break-before: page; display: block; height: 0; margin: 0; padding: 0; }

/* ─── Footer: in flex flow — doc-body(flex:1) pushes it to the bottom ─── */
.doc-footer {
  background: #f8fafc; border-top: 1px solid #e2e8f0;
  padding: 7px 40px;
  font-size: 7pt; color: #9ca3af; letter-spacing: 0.03em;
  text-align: center; line-height: 1.5;
}
.footer-co      { font-weight: 700; color: #64748b; font-size: 7.5pt; }
.footer-addr    { color: #6b7280; }
.footer-contact { color: #9ca3af; }
.footer-page    { display: none; }

/* ─── Floating action buttons (screen only) ──────────────── */
.fab-group {
  position: fixed; bottom: 24px; right: 24px;
  display: flex; gap: 8px; z-index: 9999;
}
.fab-primary, .fab-secondary {
  border: none; padding: 10px 22px; border-radius: 7px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 18px rgba(0,0,0,0.22);
  letter-spacing: 0.03em; display: flex; align-items: center; gap: 7px;
}
.fab-primary   { background: ${accent}; color: #fff; }
.fab-secondary { background: #fff; color: ${accent}; border: 1.5px solid ${accent}; }
.fab-primary:hover   { opacity: 0.88; }
.fab-secondary:hover { opacity: 0.78; }
.fab-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* ─── Print / Chrome Save as PDF ────────────────────────── */
@media print {
  /*
   * margin: 0 removes browser URL/date/page-number from top, left, right.
   * The footer is fixed at bottom: 0 on every page via position:fixed,
   * repeating automatically across all pages including {{PAGE_BREAK}} pages.
   * Use "Download PDF" for the Puppeteer-rendered PDF with Page X of Y.
   */
  /* Page 1: margin 0 so the accent bar + header sit flush at the top edge.
     Page 2+: 12mm top margin gives breathing room after a {{PAGE_BREAK}}. */
  @page       { size: A4; margin: 12mm 0 0 0; }
  @page :first { margin: 0; }

  html, body {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 9.5pt;
  }

  .page-shell { max-width: 100%; margin: 0; box-shadow: none; }
  .fab-group  { display: none !important; }

  /* min-height: 297mm fills an A4 page for single-page documents */
  .doc { min-height: 297mm; }

  /* Tighter padding for A4 */
  .doc-header { padding: 11px 36px 10px; }
  .title-band { padding: 7px 36px 9px; }

  /*
   * padding-bottom: 24mm reserves space above the fixed footer so content
   * never flows behind it on any page.
   */
  .doc-body { padding: 12px 36px 24mm; }

  /* ── Footer: fixed at bottom of EVERY printed page ────── */
  .doc-footer {
    position: fixed;
    bottom: 4px; /* sits above the 4px accent bar */
    left: 0; right: 0;
    padding: 5px 36px 3px;
    z-index: 9999;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }
  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-text { text-align: left; }
  .footer-page {
    display: block;
    font-size: 7.5pt;
    font-weight: 600;
    color: #64748b;
    white-space: nowrap;
  }
  /* counter(pages) is unreliable for fixed elements outside @page context —
     use only counter(page) for browser print. Puppeteer PDF has accurate
     "Page X of Y" via its injected pageNumber / totalPages spans. */
  .footer-page::after {
    content: "Page " counter(page);
  }
  /* Accent bar fixed at very bottom of every page */
  .accent-bar-bottom {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 4px;
    z-index: 9999;
  }

  .brand-logo { max-width: 210px; min-width: 140px; height: auto; image-rendering: auto; }
  .doc-section       { break-inside: avoid; page-break-inside: avoid; }
  .signatory-section { break-inside: avoid; page-break-inside: avoid; }
  .sig-img-wrap img {
    max-height: 120px; width: auto; max-width: 260px; object-fit: contain;
    image-rendering: high-quality; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .content-body h1, .content-body h2, .content-body h3,
  .sec-heading { break-after: avoid !important; page-break-after: avoid !important; }
  .body-p, .content-body p { orphans: 3; widows: 3; }
  .doc-watermark { position: absolute; }
}
`}</style>

      {/* Download PDF + Print buttons — hidden in print */}
      <div className="fab-group">
        <button
          className="fab-primary"
          onClick={handleDownloadPdf}
          disabled={downloading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
        <button className="fab-secondary" onClick={() => window.print()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print
        </button>
      </div>

      <div className="page-shell">
        <div className="doc">

          {watermarkUrl && (
            <div className="doc-watermark">
              <img src={watermarkUrl} alt="" aria-hidden />
            </div>
          )}

          {/* Header: in document flow — appears on page 1 only */}
          <div className="doc-header-region">
            <div className="accent-bar-top" />

            <header className="doc-header">
              <div>
                {logoUrl
                  ? <img src={logoUrl} alt={company} className="brand-logo" />
                  : <div className="brand-name-text">{company}</div>
                }
              </div>
              <div className="doc-meta">
                <div className="doc-ref">{annexureRef}</div>
                {offerRef && <div style={{ fontSize: '7pt', color: '#94a3b8' }}>Offer: {offerRef}</div>}
                <div>Date: {dateStr}</div>
              </div>
            </header>
          </div>

          {/* Title band: in flow — appears once on page 1 */}
          <div className="title-band">
            <div className="doc-title">Annexure {annexure.label}</div>
            <div className="doc-subtitle">{annexure.title}</div>
            {offerRef && (
              <div className="doc-annexure-ref">Ref: {offerRef} — Annexure {annexure.label}</div>
            )}
          </div>

          <main className="doc-body">
            {bodyHtml ? (
              <div className="content-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              <div className="content-body">
                <p className="body-p" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                  No content has been entered for this annexure.
                </p>
              </div>
            )}

            <div className="signatory-section">
              <div className="signatory-label">Authorized Signatory</div>
              <div className="sig-block">
                <div className="sig-for">For {company}</div>
                {sigImageUrl ? (
                  <div className="sig-img-wrap">
                    <img src={sigImageUrl} alt="Authorized Signatory" crossOrigin="anonymous" />
                  </div>
                ) : null}
                <div className="sig-line" style={!sigImageUrl ? { marginTop: 80 } : undefined} />
                <div className="sig-name">{sigName}</div>
                {sigDesig && <div className="sig-desig">{sigDesig}</div>}
                <div className="sig-auth">Authorized Signatory</div>
              </div>
            </div>
          </main>

          {/* Footer: in flex flow on screen; fixed at bottom of every page in print */}
          <footer className="doc-footer">
            <div className="footer-inner">
              <div className="footer-text">
                <div className="footer-co">{company}</div>
                {footerAddress && <div className="footer-addr">{footerAddress}</div>}
                {footerContact && <div className="footer-contact">{footerContact}</div>}
              </div>
              {/* "Page N" — populated by CSS counter(page) in @media print */}
              <div className="footer-page" />
            </div>
          </footer>
          <div className="accent-bar-bottom" />

        </div>
      </div>
    </>
  )
}
