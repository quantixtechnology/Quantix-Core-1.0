"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { authFetch } from "@/lib/admin-fetch"

interface OfferLetterData {
  id: string
  offerRef?: string
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
}

interface HrmsSettings {
  companyName?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
  authorizedSignatory?: string
  authorizedSignatoryDesignation?: string
  signatureImage?: string
  stampImage?: string
  hrContactName?: string
  hrContactEmail?: string
  hrContactMobile?: string
  website?: string
}

interface PlatformSettings {
  companyName?: string
  companyWebsite?: string
  tagline?: string
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

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function groupHtmlSections(html: string): string {
  const parts = html.split(/(?=<h[1-3][^>]*>)/i)
  return parts.map((part) => {
    const isSection = /^<h[1-3][^>]*>/i.test(part.trimStart())
    return isSection ? `<div class="doc-section">${part}</div>` : part
  }).join('\n')
}

function parseContentToHtml(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('<')) return groupHtmlSections(content)

  const lines = content.split('\n')

  let stopAt = lines.length
  for (let j = lines.length - 1; j >= Math.max(0, lines.length - 40); j--) {
    if (lines[j].trim().toUpperCase().startsWith('FOR QUANTIX')) {
      let k = j - 1
      while (k >= 0 && lines[k].trim() === '') k--
      stopAt = (lines[k]?.trim() === '---') ? k : j
      break
    }
  }

  let startAt = 0
  while (startAt < Math.min(12, lines.length)) {
    const l = lines[startAt].trim()
    const u = l.toUpperCase()
    if (l === '' || u === 'QUANTIX TECHNOLOGY' || u === 'OFFER LETTER' || l.startsWith('Date:') || l === '---') {
      startAt++
    } else { break }
  }

  const segments: string[] = []
  let sectionBuf: string[] = []
  let listItems: string[] = []
  let inList = false
  let inSection = false

  const flushList = () => {
    if (!inList) return
    sectionBuf.push(`<ul class="ol">${listItems.map(it => `<li>${it}</li>`).join('')}</ul>`)
    listItems = []
    inList = false
  }

  const flushSection = () => {
    flushList()
    if (sectionBuf.length === 0) return
    segments.push(inSection
      ? `<div class="doc-section">${sectionBuf.join('\n')}</div>`
      : sectionBuf.join('\n'))
    sectionBuf = []
    inSection = false
  }

  for (let i = startAt; i < stopAt; i++) {
    const line = lines[i].trim()
    if (line === '') { flushList(); continue }

    if (line === '---') { flushSection(); segments.push('<hr class="sec-rule" />'); continue }

    if (line.startsWith('•')) { inList = true; listItems.push(escHtml(line.slice(1).trim())); continue }

    flushList()

    const isAllCaps = line.length >= 4 && line === line.toUpperCase() &&
      /[A-Z]{3}/.test(line) && !/\d/.test(line) && !line.includes(':') && line !== 'TO,'

    if (isAllCaps) {
      flushSection(); inSection = true
      sectionBuf.push(`<h3 class="sec-heading">${escHtml(line)}</h3>`)
      continue
    }

    const upper = line.toUpperCase()
    if (upper === 'PRIVATE & CONFIDENTIAL' || upper === 'PRIVATE AND CONFIDENTIAL') {
      sectionBuf.push(`<div class="conf-badge">PRIVATE &amp; CONFIDENTIAL</div>`)
      continue
    }
    if (line.startsWith('Subject:')) {
      sectionBuf.push(`<p class="subject-line"><strong>Subject:</strong> ${escHtml(line.slice(8).trim())}</p>`)
      continue
    }
    if (/^_{3,}$/.test(line)) { sectionBuf.push(`<div class="sig-blank"></div>`); continue }
    if (line === 'To,') { sectionBuf.push(`<p class="to-label">To,</p>`); continue }

    if (line.endsWith(':') && i + 1 < stopAt) {
      const next = lines[i + 1].trim()
      if (next && next !== '---' && !next.startsWith('•') && next.length <= 120) {
        sectionBuf.push(
          `<div class="kv-row"><span class="kv-label">${escHtml(line)}</span><span class="kv-value">${escHtml(next)}</span></div>`
        )
        i++; continue
      }
    }

    sectionBuf.push(`<p class="body-p">${escHtml(line)}</p>`)
  }

  flushSection()
  return segments.join('\n')
}

export default function OfferLetterPrintPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [letter, setLetter] = useState<OfferLetterData | null>(null)
  const [hrms, setHrms] = useState<HrmsSettings>({})
  const [platform, setPlatform] = useState<PlatformSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      authFetch(`/api/admin/hrms/offer-letters/${id}`),
      authFetch('/api/admin/hrms/settings'),
      authFetch('/api/admin/platform-settings'),
    ])
      .then(([lr, hr, pr]) => Promise.all([lr.json(), hr.json(), pr.json()]))
      .then(([lj, hj, pj]) => {
        if (!lj.success) throw new Error(lj.error || 'Offer letter not found')
        setLetter(lj.data)
        if (hj.success && hj.data) setHrms(hj.data)
        if (pj.success && pj.data) setPlatform(pj.data)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!loading && letter && typeof window !== 'undefined') {
      if (new URLSearchParams(window.location.search).get('print') === '1') {
        setTimeout(() => window.print(), 800)
      }
    }
  }, [loading, letter])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial,sans-serif', color:'#6b7280', fontSize:14 }}>
      Loading document…
    </div>
  )

  if (error || !letter) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial,sans-serif', color:'#dc2626', fontSize:14 }}>
      {error || 'Document not found. Please sign in and try again.'}
    </div>
  )

  // Branding — HRMS Settings → Brand Studio HRMS zone → Brand Studio global
  const accent    = hrms.primaryColor   || platform.hrmsAccentColor || platform.primaryColor  || '#1E3A8A'
  const secondary = hrms.secondaryColor || platform.secondaryColor  || '#475569'

  // Logo: Primary → Compact → HRMS → text fallback
  const logoUrl      = platform.logoUrl || platform.compactLogoUrl || hrms.logo || null
  const watermarkUrl = platform.watermarkUrl || null

  // Identity
  const company = hrms.companyName || platform.companyName || 'Quantix Technology'

  // Footer
  const footerWebsite = hrms.website       || platform.companyWebsite || ''
  const footerEmail   = hrms.hrContactEmail  || ''
  const footerPhone   = hrms.hrContactMobile || ''

  // Document fields
  const refNum  = letter.offerRef || `QT/HR/${new Date(letter.createdAt).getFullYear()}/${letter.id.slice(-6).toUpperCase()}`
  const dateStr = new Date(letter.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const joinStr = letter.joiningDate
    ? new Date(letter.joiningDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
    : '—'
  const empType  = (letter.employmentType || '').replace(/_/g, ' ')
  const bodyHtml = parseContentToHtml(letter.content)

  // Signature: Digital Signature → Signature with Stamp → HRMS fallback
  const sigImageUrl = platform.signatorySignUrl || platform.signatoryStampUrl || hrms.signatureImage || null
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

/* ─── Document ───────────────────────────────────────────── */
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
.accent-bar-top, .doc-header, .title-band,
.doc-body, .doc-footer, .accent-bar-bottom { position: relative; z-index: 1; }

/* ─── Accent bars ────────────────────────────────────────── */
.accent-bar-top    { height: 5px; background: ${accent}; }
.accent-bar-bottom { height: 4px; background: ${accent}; }

/* ─── Header ─────────────────────────────────────────────── */
.doc-header {
  padding: 14px 40px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 2px solid ${accent};
}

/* Logo: never upscaled, maintains ratio, sharp in PDF */
.brand-logo {
  width: auto;
  max-width: 210px;
  min-width: 140px;
  height: auto;
  max-height: 54px;
  object-fit: contain;
  display: block;
  image-rendering: auto;
}

/* Text fallback when no logo */
.brand-name-text {
  font-size: 13pt;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.doc-meta {
  text-align: right;
  font-size: 8pt;
  color: #374151;
  line-height: 1.7;
  flex-shrink: 0;
}
.doc-ref {
  font-family: 'Courier New', monospace;
  font-size: 7.5pt;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 2px 7px;
  border-radius: 3px;
  display: inline-block;
  margin-bottom: 3px;
  letter-spacing: 0.06em;
}

/* ─── Title band ─────────────────────────────────────────── */
.title-band { background: ${accent}; padding: 8px 40px; }
.doc-title  {
  font-size: 11pt;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

/* ─── Body ───────────────────────────────────────────────── */
.doc-body { flex: 1; padding: 16px 40px 20px; }

/* ─── Candidate card (compact) ───────────────────────────── */
.cand-card {
  border-left: 4px solid ${accent};
  background: #f8fafc;
  padding: 9px 14px;
  margin-bottom: 14px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.cand-identity {
  display: flex;
  align-items: baseline;
  gap: 7px;
  flex-wrap: wrap;
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid #e2e8f0;
}
.cand-name    { font-size: 11pt; font-weight: 700; color: #0f172a; }
.cand-dot     { color: #cbd5e1; font-size: 9pt; }
.cand-contact { font-size: 8pt; color: #475569; }

.cand-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 20px;
  row-gap: 4px;
}
.cand-field { display: flex; gap: 5px; align-items: baseline; }
.cfl {
  font-size: 6pt;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #94a3b8;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 72px;
}
.cfv { font-size: 8pt; color: #0f172a; font-weight: 600; }

/* ─── Content body ───────────────────────────────────────── */
.content-body {
  font-size: 9.5pt;
  line-height: 1.4;
  color: #1e293b;
}

/* Section containers — keep heading + content together */
.content-body .doc-section {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Plain-text ALL-CAPS section headings */
.content-body .sec-heading {
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${accent};
  margin: 12px 0 5px;
  padding-bottom: 4px;
  border-bottom: 1.5px solid #e2e8f0;
  break-after: avoid;
  page-break-after: avoid;
}

/* Tiptap headings */
.content-body h1 {
  font-size: 12pt; font-weight: 700; color: #0f172a;
  margin: 14px 0 6px;
  break-after: avoid; page-break-after: avoid;
}
.content-body h2 {
  font-size: 10pt; font-weight: 600; color: ${accent};
  margin: 11px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0;
  break-after: avoid; page-break-after: avoid;
}
.content-body h3 {
  font-size: 9pt; font-weight: 600; color: ${secondary};
  letter-spacing: 0.06em; text-transform: uppercase;
  margin: 9px 0 4px;
  break-after: avoid; page-break-after: avoid;
}

/* Paragraphs */
.content-body p, .content-body .body-p {
  margin-bottom: 5px;
  orphans: 3; widows: 3;
}

/* Inline */
.content-body strong { font-weight: 700; color: #0f172a; }
.content-body em     { font-style: italic; }
.content-body u      { text-decoration: underline; }

/* Lists */
.content-body .ol,
.content-body ul,
.content-body ol {
  padding-left: 18px;
  margin: 4px 0 8px;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body .ol      { list-style-type: disc; }
.content-body ul       { list-style-type: disc; }
.content-body ol       { list-style-type: decimal; }
.content-body .ol li,
.content-body ul li,
.content-body ol li {
  margin-bottom: 2px;
  font-size: 9.5pt;
  break-inside: avoid; page-break-inside: avoid;
}

/* Dividers */
.content-body .sec-rule,
.content-body hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 8px 0;
}

/* Tables */
.content-body table {
  border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.5pt;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body table th {
  background: ${accent}18; color: #0f172a; font-weight: 700;
  padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;
}
.content-body table td {
  padding: 4px 8px; border: 1px solid #e5e7eb;
}
.content-body table tr:nth-child(even) td { background: #f8fafc; }

/* Misc inline */
.content-body .conf-badge {
  display: inline-block;
  font-size: 7pt; font-weight: 700; letter-spacing: 0.1em;
  color: #92400e; background: #fef3c7; border: 1px solid #fde68a;
  padding: 3px 10px; border-radius: 3px; margin-bottom: 10px;
  text-transform: uppercase;
}
.content-body .subject-line { font-size: 9.5pt; margin: 6px 0 10px; }
.content-body .to-label     { font-size: 9pt; color: #374151; margin-bottom: 2px; }
.content-body .kv-row   {
  display: flex; gap: 6px; margin-bottom: 4px; align-items: baseline;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body .kv-label { font-weight: 700; font-size: 9pt; color: #374151; white-space: nowrap; }
.content-body .kv-value { font-size: 9pt; color: #0f172a; }
.content-body .sig-blank { width: 180px; border-bottom: 1.5px solid #374151; margin: 6px 0 3px; }

/* ─── Signatory section ──────────────────────────────────── */
.signatory-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1.5px solid #e2e8f0;
  break-inside: avoid; page-break-inside: avoid;
}
.signatory-label {
  font-size: 6.5pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; color: #94a3b8; margin-bottom: 14px;
}
.signatory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.sig-block { }
.sig-for {
  font-size: 6.5pt; text-transform: uppercase;
  letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 8px;
}
.sig-img-wrap { height: 56px; display: flex; align-items: flex-end; margin-bottom: 5px; }
.sig-img-wrap img { max-height: 52px; max-width: 180px; object-fit: contain; }
.sig-line { width: 200px; border-bottom: 1.5px solid #374151; margin-bottom: 6px; }
.sig-line-blank { width: 200px; border-bottom: 1.5px solid #374151; margin: 48px 0 6px; }
.sig-name  { font-size: 9.5pt; font-weight: 700; color: #0f172a; margin-bottom: 1px; }
.sig-desig { font-size: 8pt; color: #6b7280; }
.sig-co    { font-size: 7.5pt; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
.sig-date  { margin-top: 10px; font-size: 8pt; color: #374151; }

/* ─── Footer ─────────────────────────────────────────────── */
.doc-footer {
  background: #f8fafc; border-top: 1px solid #e2e8f0;
  padding: 7px 40px;
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  font-size: 7pt; color: #9ca3af; letter-spacing: 0.03em;
}
.footer-co  { font-weight: 700; color: #64748b; }
.footer-sep { color: #d1d5db; }

/* ─── Print FAB (screen only) ────────────────────────────── */
.print-fab {
  position: fixed; bottom: 24px; right: 24px;
  background: ${accent}; color: #fff; border: none;
  padding: 10px 22px; border-radius: 7px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 18px rgba(0,0,0,0.22); z-index: 9999;
  letter-spacing: 0.03em; display: flex; align-items: center; gap: 7px;
}
.print-fab:hover { opacity: 0.88; }

/* ─── Print / Chrome Save as PDF ────────────────────────── */
@media print {
  @page { size: A4; margin: 0; }

  html, body { background: #fff; font-size: 9.5pt; }

  .page-shell { max-width: 100%; margin: 0; box-shadow: none; }

  /* Hide all screen-only UI */
  .print-fab { display: none !important; }

  /* Tighter padding for A4 */
  .doc-header { padding: 11px 36px 10px; }
  .title-band { padding: 7px 36px; }
  .doc-body   { padding: 12px 36px 16px; }
  .doc-footer { padding: 6px 36px; position: static !important; }
  .accent-bar-bottom { position: static !important; }

  /* Logo sharp in PDF */
  .brand-logo { max-width: 210px; min-width: 140px; height: auto; image-rendering: auto; }

  /* Candidate card */
  .cand-card { break-inside: avoid; page-break-inside: avoid; }

  /* Section containers — never break inside */
  .doc-section { break-inside: avoid; page-break-inside: avoid; }

  /* Signatory — always on the same page */
  .signatory-section { break-inside: avoid; page-break-inside: avoid; }

  /* Headings must never be orphaned */
  .sec-heading,
  .content-body h1,
  .content-body h2,
  .content-body h3 { break-after: avoid !important; page-break-after: avoid !important; }

  /* Fine elements */
  .kv-row { break-inside: avoid; page-break-inside: avoid; }
  .content-body .ol,
  .content-body ul,
  .content-body ol { break-inside: avoid; page-break-inside: avoid; }
  .content-body table { break-inside: avoid; page-break-inside: avoid; }

  /* Orphan / widow control */
  .body-p, .content-body p { orphans: 3; widows: 3; }

  /* Watermark in PDF */
  .doc-watermark { position: absolute; }
}
`}</style>

      {/* Print / Save as PDF button — hidden in print */}
      <button className="print-fab" onClick={() => window.print()}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print / Save as PDF
      </button>

      <div className="page-shell">
        <div className="doc">

          {/* Watermark — 6% opacity, does not affect readability */}
          {watermarkUrl && (
            <div className="doc-watermark">
              <img src={watermarkUrl} alt="" aria-hidden />
            </div>
          )}

          <div className="accent-bar-top" />

          {/* Header: Logo left | Ref + Date right */}
          <header className="doc-header">
            <div>
              {logoUrl
                ? <img src={logoUrl} alt={company} className="brand-logo" />
                : <div className="brand-name-text">{company}</div>
              }
            </div>
            <div className="doc-meta">
              <div className="doc-ref">{refNum}</div>
              <div>Date: {dateStr}</div>
            </div>
          </header>

          {/* Title band — no badge */}
          <div className="title-band">
            <span className="doc-title">Offer Letter</span>
          </div>

          <main className="doc-body">

            {/* Candidate information — compact 2-col grid */}
            <div className="cand-card">
              <div className="cand-identity">
                <span className="cand-name">{letter.candidateName}</span>
                {letter.candidateEmail && (
                  <><span className="cand-dot">·</span><span className="cand-contact">{letter.candidateEmail}</span></>
                )}
                {letter.candidateMobile && (
                  <><span className="cand-dot">·</span><span className="cand-contact">{letter.candidateMobile}</span></>
                )}
              </div>
              <div className="cand-grid">
                <div className="cand-field">
                  <span className="cfl">Designation</span>
                  <span className="cfv">{letter.designation}</span>
                </div>
                {letter.department && (
                  <div className="cand-field">
                    <span className="cfl">Department</span>
                    <span className="cfv">{letter.department}</span>
                  </div>
                )}
                {letter.joiningDate && (
                  <div className="cand-field">
                    <span className="cfl">Date of Joining</span>
                    <span className="cfv">{joinStr}</span>
                  </div>
                )}
                {letter.workLocation && (
                  <div className="cand-field">
                    <span className="cfl">Work Location</span>
                    <span className="cfv">{letter.workLocation}</span>
                  </div>
                )}
                {letter.reportingManager && (
                  <div className="cand-field">
                    <span className="cfl">Reporting Manager</span>
                    <span className="cfv">{letter.reportingManager}</span>
                  </div>
                )}
                {empType && (
                  <div className="cand-field">
                    <span className="cfl">Employment Type</span>
                    <span className="cfv">{empType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Letter body */}
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

            {/* Signature block */}
            <div className="signatory-section">
              <div className="signatory-label">Signatures</div>
              <div className="signatory-grid">

                <div className="sig-block">
                  <div className="sig-for">For {company}</div>
                  {sigImageUrl
                    ? (
                      <>
                        <div className="sig-img-wrap">
                          <img src={sigImageUrl} alt="Authorized Signatory" />
                        </div>
                        <div className="sig-line" />
                      </>
                    )
                    : <div className="sig-line-blank" />
                  }
                  <div className="sig-name">{sigName}</div>
                  {sigDesig && <div className="sig-desig">{sigDesig}</div>}
                  <div className="sig-co">{company}</div>
                </div>

                <div className="sig-block">
                  <div className="sig-for">Accepted by Candidate</div>
                  <div className="sig-line-blank" />
                  <div className="sig-name">{letter.candidateName}</div>
                  <div className="sig-desig">{letter.designation}</div>
                  <div className="sig-date">Date: ___________________</div>
                </div>

              </div>
            </div>

          </main>

          {/* Footer: Company · Website · HR Email · HR Mobile */}
          <footer className="doc-footer">
            <span className="footer-co">{company}</span>
            {footerWebsite && <><span className="footer-sep">·</span><span>{footerWebsite}</span></>}
            {footerEmail   && <><span className="footer-sep">·</span><span>{footerEmail}</span></>}
            {footerPhone   && <><span className="footer-sep">·</span><span>{footerPhone}</span></>}
          </footer>

          <div className="accent-bar-bottom" />
        </div>
      </div>
    </>
  )
}
