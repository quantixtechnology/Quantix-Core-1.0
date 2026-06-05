"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { authFetch } from "@/lib/admin-fetch"

interface OfferLetterData {
  id: string
  candidateName: string
  candidateEmail?: string
  candidateMobile?: string
  designation: string
  department?: string
  reportingManager?: string
  workLocation?: string
  joiningDate?: string
  employmentType: string
  content: string
  status: string
  createdAt: string
  createdBy?: string
}

interface BrandSettings {
  companyName?: string
  tagline?: string
  hrmsLogoUrl?: string
  logoUrl?: string
  hrmsAccentColor?: string
  primaryColor?: string
  signatoryName?: string
  signatoryDesignation?: string
  signatorySignUrl?: string
  signatoryStampUrl?: string
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseContentToHtml(content: string): string {
  if (!content) return ''

  const lines = content.split('\n')

  // Find signatory footer: last "---" before "FOR QUANTIX TECHNOLOGY"
  let stopAt = lines.length
  for (let j = lines.length - 1; j >= Math.max(0, lines.length - 40); j--) {
    const upper = lines[j].trim().toUpperCase()
    if (upper.startsWith('FOR QUANTIX')) {
      // Walk back to the preceding ---
      let k = j - 1
      while (k >= 0 && lines[k].trim() === '') k--
      stopAt = (lines[k]?.trim() === '---') ? k : j
      break
    }
  }

  // Skip the boilerplate header: QUANTIX TECHNOLOGY / OFFER LETTER / Date: / ---
  let startAt = 0
  while (startAt < Math.min(12, lines.length)) {
    const l = lines[startAt].trim()
    const u = l.toUpperCase()
    if (
      l === '' || u === 'QUANTIX TECHNOLOGY' || u === 'OFFER LETTER' ||
      l.startsWith('Date:') || l === '---'
    ) { startAt++ } else { break }
  }

  const html: string[] = []
  let listItems: string[] = []
  let inList = false

  const flushList = () => {
    if (inList) {
      html.push(`<ul class="ol">${listItems.map(it => `<li>${it}</li>`).join('')}</ul>`)
      listItems = []
      inList = false
    }
  }

  for (let i = startAt; i < stopAt; i++) {
    const line = lines[i].trim()

    if (line === '---') {
      flushList()
      html.push('<hr class="sec-rule" />')
      continue
    }

    if (line === '') {
      flushList()
      continue
    }

    // Bullet items
    if (line.startsWith('•')) {
      inList = true
      listItems.push(escHtml(line.slice(1).trim()))
      continue
    }

    flushList()

    // PRIVATE & CONFIDENTIAL badge
    if (line.toUpperCase() === 'PRIVATE & CONFIDENTIAL' || line.toUpperCase() === 'PRIVATE AND CONFIDENTIAL') {
      html.push(`<div class="confidential-badge">&#128274; PRIVATE &amp; CONFIDENTIAL</div>`)
      continue
    }

    // Subject line
    if (line.startsWith('Subject:')) {
      html.push(`<p class="subject-line"><strong>Subject:</strong> ${escHtml(line.slice(8).trim())}</p>`)
      continue
    }

    // ALL-CAPS section headings (3+ chars, no digits, no colon)
    const upper = line.toUpperCase()
    if (
      line.length >= 4 &&
      line === upper &&
      /[A-Z]{3}/.test(line) &&
      !/\d/.test(line) &&
      !line.includes(':') &&
      line !== 'TO,'
    ) {
      html.push(`<h3 class="sec-heading">${escHtml(line)}</h3>`)
      continue
    }

    // Signature blank lines
    if (/^_{3,}$/.test(line)) {
      html.push(`<div class="sig-blank"></div>`)
      continue
    }

    // "To," address label
    if (line === 'To,') {
      html.push(`<p class="to-label">To,</p>`)
      continue
    }

    // Key: (label ending in colon, next line is the value)
    if (line.endsWith(':') && i + 1 < stopAt) {
      const next = lines[i + 1].trim()
      if (next && next !== '---' && !next.startsWith('•') && next.length <= 120) {
        html.push(
          `<div class="kv-row"><span class="kv-label">${escHtml(line)}</span>` +
          `<span class="kv-value">${escHtml(next)}</span></div>`
        )
        i++
        continue
      }
    }

    // Regular paragraph
    html.push(`<p class="body-p">${escHtml(line)}</p>`)
  }

  flushList()
  return html.join('\n')
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SENT: 'Sent', ACCEPTED: 'Accepted',
  REJECTED: 'Rejected', EXPIRED: 'Expired',
}

export default function OfferLetterPrintPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [letter, setLetter] = useState<OfferLetterData | null>(null)
  const [brand, setBrand] = useState<BrandSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      authFetch(`/api/admin/hrms/offer-letters/${id}`),
      authFetch('/api/admin/platform-settings'),
    ])
      .then(([lr, br]) => Promise.all([lr.json(), br.json()]))
      .then(([lj, bj]) => {
        if (!lj.success) throw new Error(lj.error || 'Offer letter not found')
        setLetter(lj.data)
        if (bj.success) setBrand(bj.data)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!loading && letter && typeof window !== 'undefined') {
      const auto = new URLSearchParams(window.location.search).get('print') === '1'
      if (auto) setTimeout(() => window.print(), 900)
    }
  }, [loading, letter])

  const accent = brand.hrmsAccentColor || brand.primaryColor || '#2563EB'
  const logoUrl = brand.hrmsLogoUrl || brand.logoUrl || null
  const company = brand.companyName || 'QUANTIX TECHNOLOGY'
  const tagline = brand.tagline || ''

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#6b7280', fontSize: 15 }}>
      Loading document…
    </div>
  )

  if (error || !letter) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#dc2626', fontSize: 15 }}>
      {error || 'Document not found. Please sign in to the admin panel and try again.'}
    </div>
  )

  const refNum  = `QT/HR/${new Date(letter.createdAt).getFullYear()}/${letter.id.slice(-6).toUpperCase()}`
  const dateStr = new Date(letter.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const joinStr = letter.joiningDate
    ? new Date(letter.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  const empType = (letter.employmentType || '').replace(/_/g, ' ')
  const bodyHtml = parseContentToHtml(letter.content)

  return (
    <>
      <style>{`
/* ── Reset ───────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1a1a1a;
  background: #e8e8e8;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Screen page shell ───────────────────────────────────── */
.page-shell {
  max-width: 820px;
  margin: 32px auto 60px;
  box-shadow: 0 6px 40px rgba(0,0,0,0.18);
}

/* ── Document ────────────────────────────────────────────── */
.doc {
  background: #fff;
  min-height: 1122px; /* A4 at 96dpi */
  display: flex;
  flex-direction: column;
}

/* ── Accent bar top ──────────────────────────────────────── */
.accent-bar-top {
  height: 6px;
  background: ${accent};
}

/* ── Header ──────────────────────────────────────────────── */
.doc-header {
  padding: 28px 48px 22px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 2.5px solid ${accent};
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  height: 54px;
  max-width: 150px;
  object-fit: contain;
}

.brand-logo-q {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background: ${accent};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 900;
  color: #fff;
  letter-spacing: -1px;
  flex-shrink: 0;
}

.brand-text {}

.brand-name {
  font-size: 16pt;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.1;
}

.brand-tagline {
  font-size: 8pt;
  color: #6b7280;
  letter-spacing: 0.04em;
  margin-top: 3px;
}

.doc-meta {
  text-align: right;
  font-size: 9pt;
  color: #374151;
  line-height: 1.8;
  flex-shrink: 0;
}

.doc-ref {
  font-family: 'Courier New', Courier, monospace;
  font-size: 8.5pt;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 2px 8px;
  border-radius: 3px;
  display: inline-block;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

/* ── Title band ──────────────────────────────────────────── */
.title-band {
  background: ${accent};
  padding: 13px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.doc-title {
  font-size: 13pt;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.doc-status-pill {
  font-size: 7.5pt;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 20px;
  background: rgba(255,255,255,0.22);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.45);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Body ────────────────────────────────────────────────── */
.doc-body {
  flex: 1;
  padding: 32px 48px 40px;
}

/* ── Candidate info block ────────────────────────────────── */
.candidate-block {
  background: #f8fafc;
  border-left: 5px solid ${accent};
  padding: 18px 22px;
  margin-bottom: 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 32px;
}

.candidate-top {
  grid-column: 1 / -1;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 12px;
  margin-bottom: 2px;
}

.candidate-name {
  font-size: 14pt;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 3px;
}

.candidate-contact {
  font-size: 9pt;
  color: #6b7280;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.cand-field {}

.cand-field-label {
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #94a3b8;
  font-weight: 700;
  margin-bottom: 2px;
}

.cand-field-value {
  font-size: 9.5pt;
  color: #0f172a;
  font-weight: 600;
}

/* ── Content body ────────────────────────────────────────── */
.content-body {
  font-size: 10.5pt;
  line-height: 1.7;
  color: #1e293b;
}

.content-body .body-p {
  margin-bottom: 9px;
}

.content-body .sec-heading {
  font-size: 9.5pt;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${accent};
  margin: 24px 0 10px;
  padding-bottom: 5px;
  border-bottom: 1.5px solid #e2e8f0;
}

.content-body .sec-rule {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 18px 0;
}

.content-body .ol {
  padding-left: 20px;
  margin: 8px 0 14px;
}

.content-body .ol li {
  margin-bottom: 5px;
  font-size: 10.5pt;
}

.content-body .confidential-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 4px 12px;
  border-radius: 4px;
  margin-bottom: 14px;
  text-transform: uppercase;
}

.content-body .subject-line {
  font-size: 10.5pt;
  margin: 8px 0 16px;
  color: #0f172a;
}

.content-body .to-label {
  font-size: 10pt;
  color: #374151;
  margin-bottom: 3px;
}

.content-body .kv-row {
  display: flex;
  gap: 8px;
  margin-bottom: 7px;
  align-items: baseline;
}

.content-body .kv-label {
  font-weight: 700;
  font-size: 10pt;
  color: #374151;
  white-space: nowrap;
}

.content-body .kv-value {
  font-size: 10pt;
  color: #0f172a;
}

.content-body .sig-blank {
  width: 200px;
  border-bottom: 1.5px solid #374151;
  margin: 8px 0 4px;
}

/* ── Signatory section ───────────────────────────────────── */
.signatory-section {
  margin-top: 36px;
  padding-top: 28px;
  border-top: 2px solid #e2e8f0;
  page-break-inside: avoid;
}

.signatory-section-heading {
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #94a3b8;
  margin-bottom: 20px;
}

.signatory-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.sig-block {}

.sig-for {
  font-size: 7.5pt;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9ca3af;
  font-weight: 700;
  margin-bottom: 10px;
}

.sig-image-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 64px;
  margin-bottom: 6px;
}

.sig-image {
  max-height: 56px;
  max-width: 110px;
  object-fit: contain;
}

.sig-stamp {
  max-height: 52px;
  max-width: 52px;
  object-fit: contain;
  opacity: 0.85;
}

.sig-line {
  width: 220px;
  border-bottom: 1.5px solid #374151;
  margin-bottom: 8px;
}

.sig-name {
  font-size: 10.5pt;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 2px;
}

.sig-designation {
  font-size: 9pt;
  color: #6b7280;
  margin-bottom: 2px;
}

.sig-company {
  font-size: 8.5pt;
  font-weight: 700;
  color: ${accent};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 3px;
}

.acceptance-date-field {
  margin-top: 14px;
  font-size: 9pt;
  color: #374151;
}

/* ── Footer ──────────────────────────────────────────────── */
.doc-footer {
  margin-top: auto;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: 10px 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 7.5pt;
  color: #9ca3af;
  letter-spacing: 0.03em;
}

.footer-company { font-weight: 700; color: #64748b; }

.accent-bar-bottom { height: 5px; background: ${accent}; }

/* ── Print button (screen only) ──────────────────────────── */
.print-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  background: ${accent};
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,0.22);
  z-index: 9999;
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.print-fab:hover { opacity: 0.9; }

/* ── Print / PDF ─────────────────────────────────────────── */
@media print {
  @page {
    size: A4;
    margin: 0;
  }

  html, body {
    background: #fff;
    margin: 0;
    padding: 0;
    font-size: 10pt;
  }

  .page-shell {
    max-width: 100%;
    margin: 0;
    box-shadow: none;
  }

  .print-fab { display: none !important; }

  .doc {
    min-height: 100vh;
  }

  .doc-body { padding: 24px 42px 32px; }

  .doc-header { padding: 22px 42px 18px; }

  .title-band { padding: 11px 42px; }

  .doc-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
  }

  .accent-bar-bottom {
    position: fixed;
    bottom: 28px;
    left: 0;
    right: 0;
  }

  .signatory-section { page-break-inside: avoid; }

  h3.sec-heading { page-break-after: avoid; }
}
`}</style>

      {/* Screen-only print button */}
      <button className="print-fab" onClick={() => window.print()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
        </svg>
        Print / Save as PDF
      </button>

      <div className="page-shell">
        <div className="doc">

          {/* Top accent bar */}
          <div className="accent-bar-top" />

          {/* Header: logo + company + ref/date */}
          <header className="doc-header">
            <div className="brand-group">
              {logoUrl
                ? <img src={logoUrl} alt={company} className="brand-logo" />
                : <div className="brand-logo-q">Q</div>
              }
              <div className="brand-text">
                <div className="brand-name">{company}</div>
                {tagline && <div className="brand-tagline">{tagline}</div>}
              </div>
            </div>
            <div className="doc-meta">
              <div className="doc-ref">{refNum}</div>
              <div>Date: {dateStr}</div>
            </div>
          </header>

          {/* Title band */}
          <div className="title-band">
            <span className="doc-title">Offer Letter</span>
            <span className="doc-status-pill">{STATUS_LABELS[letter.status] ?? letter.status}</span>
          </div>

          {/* Body */}
          <main className="doc-body">

            {/* Candidate info block */}
            <div className="candidate-block">
              <div className="candidate-top">
                <div className="candidate-name">{letter.candidateName}</div>
                <div className="candidate-contact">
                  {letter.candidateEmail && <span>{letter.candidateEmail}</span>}
                  {letter.candidateEmail && letter.candidateMobile && <span aria-hidden>·</span>}
                  {letter.candidateMobile && <span>{letter.candidateMobile}</span>}
                </div>
              </div>
              <div className="cand-field">
                <div className="cand-field-label">Designation</div>
                <div className="cand-field-value">{letter.designation}</div>
              </div>
              {letter.department && (
                <div className="cand-field">
                  <div className="cand-field-label">Department</div>
                  <div className="cand-field-value">{letter.department}</div>
                </div>
              )}
              {letter.joiningDate && (
                <div className="cand-field">
                  <div className="cand-field-label">Date of Joining</div>
                  <div className="cand-field-value">{joinStr}</div>
                </div>
              )}
              {letter.workLocation && (
                <div className="cand-field">
                  <div className="cand-field-label">Work Location</div>
                  <div className="cand-field-value">{letter.workLocation}</div>
                </div>
              )}
              {letter.reportingManager && (
                <div className="cand-field">
                  <div className="cand-field-label">Reporting Manager</div>
                  <div className="cand-field-value">{letter.reportingManager}</div>
                </div>
              )}
              {empType && (
                <div className="cand-field">
                  <div className="cand-field-label">Employment Type</div>
                  <div className="cand-field-value">{empType}</div>
                </div>
              )}
            </div>

            {/* Rendered letter body */}
            {bodyHtml
              ? <div className="content-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              : (
                <div className="content-body">
                  <p className="body-p">
                    We are pleased to offer you the position of {letter.designation} at {company}.
                    Your date of joining will be {joinStr}.
                  </p>
                </div>
              )
            }

            {/* Signatory section */}
            <div className="signatory-section">
              <div className="signatory-section-heading">Signatures</div>
              <div className="signatory-grid">

                {/* Company side */}
                <div className="sig-block">
                  <div className="sig-for">For {company}</div>
                  <div className="sig-image-row">
                    {brand.signatorySignUrl && (
                      <img src={brand.signatorySignUrl} alt="Signature" className="sig-image" />
                    )}
                    {brand.signatoryStampUrl && (
                      <img src={brand.signatoryStampUrl} alt="Stamp" className="sig-stamp" />
                    )}
                    {!brand.signatorySignUrl && <div style={{ width: 220, borderBottom: '1.5px solid #374151' }} />}
                  </div>
                  {brand.signatorySignUrl && <div className="sig-line" />}
                  <div className="sig-name">{brand.signatoryName || 'Authorized Signatory'}</div>
                  {brand.signatoryDesignation && (
                    <div className="sig-designation">{brand.signatoryDesignation}</div>
                  )}
                  <div className="sig-company">{company}</div>
                </div>

                {/* Candidate side */}
                <div className="sig-block">
                  <div className="sig-for">Accepted by Candidate</div>
                  <div className="sig-image-row">
                    <div style={{ width: 220, borderBottom: '1.5px solid #374151' }} />
                  </div>
                  <div className="sig-name">{letter.candidateName}</div>
                  <div className="sig-designation">{letter.designation}</div>
                  <div className="acceptance-date-field">Date: ___________________</div>
                </div>

              </div>
            </div>

          </main>

          {/* Footer */}
          <footer className="doc-footer">
            <span className="footer-company">{company}</span>
            <span>CONFIDENTIAL</span>
            <span>Ref: {refNum}</span>
          </footer>

          {/* Bottom accent bar */}
          <div className="accent-bar-bottom" />

        </div>
      </div>
    </>
  )
}
