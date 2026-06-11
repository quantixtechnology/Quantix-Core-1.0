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
  registeredAddress?: string
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
  companyPhone?: string
  companyEmail?: string
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

function processPageBreaks(html: string): string {
  return html
    .replace(/<p[^>]*>\s*\{\{PAGE_BREAK\}\}\s*<\/p>/gi, '<div class="page-break"></div>')
    .replace(/\{\{PAGE_BREAK\}\}/g, '<div class="page-break"></div>')
}

interface ContentSplit {
  main: string
  annexure: string | null
  annexureId: string
  annexureSubtitle: string
}

function splitAtAnnexure(content: string): ContentSplit {
  const isHtml = content.trimStart().startsWith('<')

  if (isHtml) {
    const match = /<h[1-6][^>]*>(.*?ANNEXURE.*?)<\/h[1-6]>/i.exec(content)
    if (!match) return { main: content, annexure: null, annexureId: 'A', annexureSubtitle: '' }

    const headingText = match[1].replace(/<[^>]+>/g, '').trim()
    const lm = headingText.match(/ANNEXURE\s+([A-Z])/i)
    const annexureId = lm?.[1]?.toUpperCase() || 'A'
    const main = content.slice(0, match.index)
    let rest = content.slice(match.index + match[0].length).trim()

    let annexureSubtitle = ''
    const subtitleMatch = /^<h[1-6][^>]*>(.*?)<\/h[1-6]>/i.exec(rest)
    if (subtitleMatch) {
      annexureSubtitle = subtitleMatch[1].replace(/<[^>]+>/g, '').trim()
      rest = rest.slice(subtitleMatch[0].length).trim()
    }

    return { main, annexure: rest || null, annexureId, annexureSubtitle }
  }

  // Plain text
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const u = lines[i].trim().toUpperCase()
    if (/^ANNEXURE\s*[A-Z]?$/.test(u)) {
      const lm = lines[i].trim().match(/ANNEXURE\s+([A-Z])/i)
      const annexureId = lm?.[1]?.toUpperCase() || 'A'
      const main = lines.slice(0, i).join('\n')
      const rest = lines.slice(i + 1)
      let annexureSubtitle = ''
      let bodyStart = 0
      for (let j = 0; j < Math.min(3, rest.length); j++) {
        const l = rest[j].trim()
        if (l && l !== '---' && l.length < 80) {
          annexureSubtitle = l
          bodyStart = j + 1
          break
        }
      }
      return {
        main,
        annexure: rest.slice(bodyStart).join('\n').trim() || null,
        annexureId,
        annexureSubtitle,
      }
    }
  }

  return { main: content, annexure: null, annexureId: 'A', annexureSubtitle: '' }
}

function parseContentToHtml(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('<')) return processPageBreaks(groupHtmlSections(content))

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

    if (line === '{{PAGE_BREAK}}') { flushSection(); segments.push('<div class="page-break"></div>'); continue }

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
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return

    // silentFailure: true — on hard 401 this page returns the failed Response
    // instead of calling clearAuthAndRedirect(). That function wipes localStorage
    // and fires a StorageEvent in the parent window, which triggers logout() in
    // auth-provider.tsx and kills the main app session across all open tabs.
    const opts = { silentFailure: true } as const

    const safeJson = (res: Response) =>
      res.ok
        ? res.json().catch(() => ({ success: false }))
        : Promise.resolve({ success: false, status: res.status })

    Promise.all([
      authFetch(`/api/admin/hrms/offer-letters/${id}`, opts),
      authFetch('/api/admin/hrms/settings', opts),
      authFetch('/api/admin/branding', opts),
    ])
      .then(([lr, hr, pr]) => {
        if (lr.status === 401 || lr.status === 403) {
          throw new Error('Session expired or access denied. Please sign in and try again.')
        }
        return Promise.all([lr.json(), safeJson(hr), safeJson(pr)])
      })
      .then(([lj, hj, pj]) => {
        if (!lj.success) throw new Error(lj.error || 'Offer letter not found')
        setLetter(lj.data)
        if (hj.success && hj.data) setHrms(hj.data as HrmsSettings)
        if (pj.success && pj.data) setPlatform(pj.data as PlatformSettings)
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

  const handleDownloadPdf = async () => {
    if (!letter) return
    try {
      setDownloading(true)
      const res = await authFetch(`/api/admin/hrms/offer-letters/${id}/pdf`, { silentFailure: true } as Parameters<typeof authFetch>[1])
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `offer-letter-${letter.candidateName.replace(/\s+/g, '-').toLowerCase()}.pdf`
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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial,sans-serif', color:'#6b7280', fontSize:14 }}>
      Loading document…
    </div>
  )

  if (error || !letter) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Arial,sans-serif', color:'#dc2626', fontSize:14 }}>
      {error || 'Document not found. Please sign in and try again.'}
    </div>
  )

  // Branding: HRMS Settings → Brand Studio HRMS zone → Brand Studio global
  const accent    = hrms.primaryColor   || platform.hrmsAccentColor || platform.primaryColor  || '#1E3A8A'
  const secondary = hrms.secondaryColor || platform.secondaryColor  || '#475569'

  const logoUrl      = platform.logoUrl || platform.compactLogoUrl || hrms.logo || null
  const watermarkUrl = platform.watermarkUrl || null

  const company = hrms.companyName || platform.companyName || 'Quantix Technology'

  const footerAddress = (hrms.registeredAddress || '').replace(/\n+/g, ', ').trim()
  const footerContact = [hrms.companyPhone, hrms.companyEmail, hrms.website || platform.companyWebsite]
    .filter(Boolean).join(' | ')

  const refNum  = letter.offerRef || `QT/HR/${new Date(letter.createdAt).getFullYear()}/${letter.id.slice(-6).toUpperCase()}`
  const dateStr = new Date(letter.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const joinStr = letter.joiningDate
    ? new Date(letter.joiningDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
    : '—'
  const empType     = (letter.employmentType || '').replace(/_/g, ' ')
  const split       = splitAtAnnexure(letter.content)
  const bodyHtml    = parseContentToHtml(split.main)
  const annexureHtml = split.annexure ? parseContentToHtml(split.annexure) : null

  const sigImageUrl = platform.signatoryStampUrl || platform.signatorySignUrl || hrms.stampImage || hrms.signatureImage || null
  const sigName     = platform.signatoryName        || hrms.authorizedSignatory            || 'Authorized Signatory'
  const sigDesig    = platform.signatoryDesignation || hrms.authorizedSignatoryDesignation || ''

  const Footer = () => (
    <>
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
    </>
  )

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

/* ─── Document: flex column so doc-body (flex:1) pushes footer to bottom ─ */
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
.title-band { background: ${accent}; padding: 8px 40px; }
.doc-title  {
  font-size: 11pt; font-weight: 700; color: #fff;
  letter-spacing: 0.18em; text-transform: uppercase;
}

/* ─── Body: flex:1 absorbs extra space, pushing footer to the bottom ─── */
.doc-body { flex: 1; padding: 16px 40px 20px; }

/* ─── Candidate card ─────────────────────────────────────── */
.cand-card {
  border-left: 4px solid ${accent}; background: #f8fafc;
  padding: 9px 14px; margin-bottom: 14px;
  break-inside: avoid; page-break-inside: avoid;
}
.cand-identity {
  display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap;
  padding-bottom: 7px; margin-bottom: 7px; border-bottom: 1px solid #e2e8f0;
}
.cand-name    { font-size: 11pt; font-weight: 700; color: #0f172a; }
.cand-dot     { color: #cbd5e1; font-size: 9pt; }
.cand-contact { font-size: 8pt; color: #475569; }
.cand-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  column-gap: 20px; row-gap: 4px;
}
.cand-field { display: flex; gap: 5px; align-items: baseline; }
.cfl {
  font-size: 6pt; text-transform: uppercase; letter-spacing: 0.09em;
  color: #94a3b8; font-weight: 700; white-space: nowrap; flex-shrink: 0; min-width: 72px;
}
.cfv { font-size: 8pt; color: #0f172a; font-weight: 600; }

/* ─── Content body ───────────────────────────────────────── */
.content-body { font-size: 9.5pt; line-height: 1.4; color: #1e293b; }
.content-body .doc-section { break-inside: avoid; page-break-inside: avoid; }
.content-body .sec-heading {
  font-size: 8.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: ${accent}; margin: 12px 0 5px; padding-bottom: 4px; border-bottom: 1.5px solid #e2e8f0;
  break-after: avoid; page-break-after: avoid;
}
.content-body h1 {
  font-size: 12pt; font-weight: 700; color: #0f172a; margin: 14px 0 6px;
  break-after: avoid; page-break-after: avoid;
}
.content-body h2 {
  font-size: 10pt; font-weight: 600; color: ${accent}; margin: 11px 0 5px;
  padding-bottom: 3px; border-bottom: 1px solid #e2e8f0;
  break-after: avoid; page-break-after: avoid;
}
.content-body h3 {
  font-size: 9pt; font-weight: 600; color: ${secondary}; letter-spacing: 0.06em;
  text-transform: uppercase; margin: 9px 0 4px;
  break-after: avoid; page-break-after: avoid;
}
.content-body p, .content-body .body-p { margin-bottom: 5px; orphans: 3; widows: 3; }
.content-body strong { font-weight: 700; color: #0f172a; }
.content-body em     { font-style: italic; }
.content-body u      { text-decoration: underline; }
.content-body .ol, .content-body ul, .content-body ol {
  padding-left: 18px; margin: 4px 0 8px;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body .ol     { list-style-type: disc; }
.content-body ul      { list-style-type: disc; }
.content-body ol      { list-style-type: decimal; }
.content-body .ol li, .content-body ul li, .content-body ol li {
  margin-bottom: 2px; font-size: 9.5pt; break-inside: avoid; page-break-inside: avoid;
}
.content-body .sec-rule, .content-body hr {
  border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;
}
.content-body table {
  border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.5pt;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body table th {
  background: ${accent}18; color: #0f172a; font-weight: 700;
  padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;
}
.content-body table td { padding: 4px 8px; border: 1px solid #e5e7eb; }
.content-body table tr:nth-child(even) td { background: #f8fafc; }
.content-body .conf-badge {
  display: inline-block; font-size: 7pt; font-weight: 700; letter-spacing: 0.1em;
  color: #92400e; background: #fef3c7; border: 1px solid #fde68a;
  padding: 3px 10px; border-radius: 3px; margin-bottom: 10px; text-transform: uppercase;
}
.content-body .subject-line { font-size: 9.5pt; margin: 6px 0 10px; }
.content-body .to-label     { font-size: 9pt; color: #374151; margin-bottom: 2px; }
.content-body .kv-row {
  display: flex; gap: 6px; margin-bottom: 4px; align-items: baseline;
  break-inside: avoid; page-break-inside: avoid;
}
.content-body .kv-label { font-weight: 700; font-size: 9pt; color: #374151; white-space: nowrap; }
.content-body .kv-value { font-size: 9pt; color: #0f172a; }
.content-body .sig-blank { width: 180px; border-bottom: 1.5px solid #374151; margin: 6px 0 3px; }

/* ─── Signatory ──────────────────────────────────────────── */
.signatory-section {
  margin-top: 18px; padding-top: 14px; border-top: 1.5px solid #e2e8f0;
  break-inside: avoid; page-break-inside: avoid;
}
.signatory-label {
  font-size: 6pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 16px;
}
.signatory-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.sig-block      { display: flex; flex-direction: column; }
.sig-for {
  font-size: 6pt; text-transform: uppercase; letter-spacing: 0.12em;
  color: #9ca3af; font-weight: 700; margin-bottom: 12px;
}
.sig-img-wrap  { display: flex; align-items: flex-end; min-height: 90px; padding-bottom: 6px; }
.sig-img-wrap img {
  max-height: 120px; width: auto; max-width: 260px; object-fit: contain; display: block;
  image-rendering: high-quality; -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sig-line       { width: 240px; border: none; border-top: 1.5px solid #374151; margin: 0 0 8px; }
.sig-line-blank { width: 240px; border: none; border-top: 1.5px solid #374151; margin: 80px 0 8px; }
.sig-name  { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.sig-desig { font-size: 8.5pt; color: #374151; margin-bottom: 3px; }
.sig-auth  {
  font-size: 7pt; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.1em; color: #64748b; margin-top: 2px;
}
.sig-date  { margin-top: 12px; font-size: 8pt; color: #374151; }

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

/* ─── Annexure section (screen gap) ──────────────────────── */
.annexure-shell { margin-top: 28px; }
.annexure-subtitle {
  font-size: 8.5pt; color: rgba(255,255,255,0.82);
  letter-spacing: 0.06em; margin-top: 3px;
}
.annexure-ref {
  font-size: 6.5pt; color: rgba(255,255,255,0.58);
  font-style: italic; margin-top: 2px; letter-spacing: 0.02em;
}

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
   * so it repeats automatically across all pages including those created
   * by {{PAGE_BREAK}}. doc-body padding-bottom reserves clearance.
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

  /* Hide floating buttons */
  .fab-group { display: none !important; }

  /* min-height: 297mm fills an A4 page for single-page documents */
  .doc { min-height: 297mm; }

  /* Tighter padding for A4 */
  .doc-header { padding: 11px 36px 10px; }
  .title-band { padding: 7px 36px; }

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

  /* Logo sharp in PDF */
  .brand-logo { max-width: 210px; min-width: 140px; height: auto; image-rendering: auto; }

  .cand-card   { break-inside: avoid; page-break-inside: avoid; }
  .doc-section { break-inside: avoid; page-break-inside: avoid; }
  .signatory-section { break-inside: avoid; page-break-inside: avoid; }

  .sig-img-wrap img {
    max-height: 120px; width: auto; max-width: 260px; object-fit: contain;
    image-rendering: high-quality; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .sec-heading,
  .content-body h1,
  .content-body h2,
  .content-body h3 { break-after: avoid !important; page-break-after: avoid !important; }

  .kv-row { break-inside: avoid; page-break-inside: avoid; }
  .content-body .ol,
  .content-body ul,
  .content-body ol { break-inside: avoid; page-break-inside: avoid; }
  .content-body table { break-inside: avoid; page-break-inside: avoid; }

  .body-p, .content-body p { orphans: 3; widows: 3; }

  .doc-watermark { position: absolute; }

  /* Annexure: new page, no screen gap */
  .annexure-shell { break-before: page; page-break-before: always; margin-top: 0; }
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

      {/* ── Offer Letter ──────────────────────────────────────────── */}
      <div className="page-shell">
        <div className="doc">

          {watermarkUrl && (
            <div className="doc-watermark">
              <img src={watermarkUrl} alt="" aria-hidden />
            </div>
          )}

          <div className="accent-bar-top" />

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

          <div className="title-band">
            <span className="doc-title">Offer Letter</span>
          </div>

          <main className="doc-body">

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

            <div className="signatory-section">
              <div className="signatory-label">Signatures</div>
              <div className="signatory-grid">

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

          {/* Footer in flex flow — stays at the bottom via doc-body flex:1 */}
          <Footer />

        </div>
      </div>

      {/* ── Annexure section — new page in print ─────────────────── */}
      {annexureHtml && (
        <div className="page-shell annexure-shell">
          <div className="doc">

            {watermarkUrl && (
              <div className="doc-watermark">
                <img src={watermarkUrl} alt="" aria-hidden />
              </div>
            )}

            <div className="accent-bar-top" />

            <header className="doc-header">
              <div>
                {logoUrl
                  ? <img src={logoUrl} alt={company} className="brand-logo" />
                  : <div className="brand-name-text">{company}</div>
                }
              </div>
              <div className="doc-meta">
                <div className="doc-ref">{refNum} — Annexure {split.annexureId}</div>
                <div>Date: {dateStr}</div>
              </div>
            </header>

            <div className="title-band">
              <div className="doc-title">Annexure {split.annexureId}</div>
              {split.annexureSubtitle && (
                <div className="annexure-subtitle">{split.annexureSubtitle}</div>
              )}
              <div className="annexure-ref">Ref: {refNum}</div>
            </div>

            <main className="doc-body">
              <div className="content-body" dangerouslySetInnerHTML={{ __html: annexureHtml }} />
            </main>

            {/* Footer in flex flow */}
            <Footer />

          </div>
        </div>
      )}
    </>
  )
}
