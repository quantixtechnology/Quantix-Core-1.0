/**
 * Server-side PDF generation for HRMS documents.
 *
 * Uses Puppeteer with displayHeaderFooter: true + a custom footerTemplate
 * so the company footer appears on EVERY page (not just the last).
 * The headerTemplate is empty, which suppresses the browser-generated
 * URL / title / date that would otherwise appear.
 *
 * The HTML page itself does NOT include a footer element — Puppeteer
 * injects it via the footer margin area on every page.
 */

import type { Browser } from 'puppeteer'
import { db } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HrmsForPdf {
  companyName?: string | null
  registeredAddress?: string | null
  logo?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  authorizedSignatory?: string | null
  authorizedSignatoryDesignation?: string | null
  signatureImage?: string | null
  stampImage?: string | null
  website?: string | null
  companyPhone?: string | null
  companyEmail?: string | null
}

export interface PlatformForPdf {
  companyName?: string | null
  companyWebsite?: string | null
  logoUrl?: string | null
  compactLogoUrl?: string | null
  watermarkUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  hrmsAccentColor?: string | null
  signatoryName?: string | null
  signatoryDesignation?: string | null
  signatorySignUrl?: string | null
  signatoryStampUrl?: string | null
}

interface BrandVars {
  accent: string
  secondary: string
  company: string
  logoUrl: string | null
  watermarkUrl: string | null
  footerAddress: string
  footerContact: string
  sigImageUrl: string | null
  sigName: string
  sigDesig: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function processPageBreaks(html: string): string {
  return html
    .replace(/<p[^>]*>\s*\{\{PAGE_BREAK\}\}\s*<\/p>/gi, '<div class="page-break"></div>')
    .replace(/\{\{PAGE_BREAK\}\}/g, '<div class="page-break"></div>')
}

function brand(hrms: HrmsForPdf, platform: PlatformForPdf): BrandVars {
  const footerAddress = (hrms.registeredAddress || '').replace(/\n+/g, ', ').trim()
  const footerContact = [hrms.companyPhone, hrms.companyEmail, hrms.website || platform.companyWebsite]
    .filter(Boolean).join(' | ')
  return {
    accent:       hrms.primaryColor   || platform.hrmsAccentColor || platform.primaryColor  || '#1E3A8A',
    secondary:    hrms.secondaryColor || platform.secondaryColor  || '#475569',
    company:      hrms.companyName    || platform.companyName     || 'Quantix Technology',
    logoUrl:      platform.logoUrl    || platform.compactLogoUrl  || hrms.logo || null,
    watermarkUrl: platform.watermarkUrl || null,
    footerAddress,
    footerContact,
    sigImageUrl:  platform.signatoryStampUrl || platform.signatorySignUrl || hrms.stampImage || hrms.signatureImage || null,
    sigName:      platform.signatoryName        || hrms.authorizedSignatory            || 'Authorized Signatory',
    sigDesig:     platform.signatoryDesignation || hrms.authorizedSignatoryDesignation || '',
  }
}

function parseContent(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('<')) return processPageBreaks(content)

  const lines = content.split('\n')
  const segments: string[] = []
  let buf: string[] = []
  let listItems: string[] = []
  let inSection = false
  let inList = false

  const flushList = () => {
    if (!inList) return
    buf.push(`<ul style="padding-left:18px;margin:4px 0 8px;">${listItems.map(i => `<li>${i}</li>`).join('')}</ul>`)
    listItems = []; inList = false
  }
  const flushSection = () => {
    flushList()
    if (!buf.length) return
    segments.push(inSection ? `<div style="break-inside:avoid;">${buf.join('\n')}</div>` : buf.join('\n'))
    buf = []; inSection = false
  }

  let startAt = 0
  while (startAt < Math.min(12, lines.length)) {
    const u = lines[startAt].trim().toUpperCase()
    if (!lines[startAt].trim() || u === 'QUANTIX TECHNOLOGY' || u === 'OFFER LETTER' || lines[startAt].trim().startsWith('Date:') || lines[startAt].trim() === '---') { startAt++ } else break
  }
  let stopAt = lines.length
  for (let j = lines.length - 1; j >= Math.max(0, lines.length - 40); j--) {
    if (lines[j].trim().toUpperCase().startsWith('FOR QUANTIX')) {
      let k = j - 1; while (k >= 0 && !lines[k].trim()) k--
      stopAt = lines[k]?.trim() === '---' ? k : j; break
    }
  }

  for (let i = startAt; i < stopAt; i++) {
    const line = lines[i].trim()
    if (!line) { flushList(); continue }
    if (line === '{{PAGE_BREAK}}') { flushSection(); segments.push('<div class="page-break"></div>'); continue }
    if (line === '---') { flushSection(); segments.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;">'); continue }
    if (line.startsWith('•')) { inList = true; listItems.push(esc(line.slice(1).trim())); continue }
    flushList()
    const isHeading = line.length >= 4 && line === line.toUpperCase() && /[A-Z]{3}/.test(line) && !/\d/.test(line) && !line.includes(':') && line !== 'TO,'
    if (isHeading) {
      flushSection(); inSection = true
      buf.push(`<h3 style="font-size:8.5pt;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:12px 0 5px;padding-bottom:4px;border-bottom:1.5px solid #e2e8f0;break-after:avoid;">${esc(line)}</h3>`)
      continue
    }
    if (line.startsWith('Subject:')) { buf.push(`<p style="margin:6px 0 10px;"><strong>Subject:</strong> ${esc(line.slice(8).trim())}</p>`); continue }
    if (/^_{3,}$/.test(line)) { buf.push('<div style="width:180px;border-bottom:1.5px solid #374151;margin:6px 0 3px;"></div>'); continue }
    if (line.endsWith(':') && i + 1 < stopAt) {
      const next = lines[i+1].trim()
      if (next && next !== '---' && !next.startsWith('•') && next.length <= 120) {
        buf.push(`<div style="display:flex;gap:6px;margin-bottom:4px;break-inside:avoid;"><span style="font-weight:700;font-size:9pt;color:#374151;white-space:nowrap;">${esc(line)}</span><span style="font-size:9pt;">${esc(next)}</span></div>`)
        i++; continue
      }
    }
    buf.push(`<p style="margin-bottom:5px;orphans:3;widows:3;">${esc(line)}</p>`)
  }
  flushSection()
  return segments.join('\n')
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

function css(b: BrandVars): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 10pt; line-height: 1.35; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .accent-top    { height: 5px; background: ${b.accent}; }
    .doc-header    { padding: 11px 36px 10px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid ${b.accent}; background: #fff; }
    .brand-logo    { max-width: 200px; max-height: 54px; object-fit: contain; display: block; }
    .brand-text    { font-size: 13pt; font-weight: 800; color: #0f172a; letter-spacing: 0.04em; text-transform: uppercase; }
    .doc-meta      { text-align: right; font-size: 8pt; color: #374151; line-height: 1.7; }
    .doc-ref       { font-family: 'Courier New', monospace; font-size: 7.5pt; background: #f3f4f6; border: 1px solid #e5e7eb; padding: 2px 7px; border-radius: 3px; display: inline-block; margin-bottom: 3px; letter-spacing: 0.06em; }
    .title-band    { background: ${b.accent}; padding: 7px 36px 9px; }
    .doc-title     { font-size: 11pt; font-weight: 700; color: #fff; letter-spacing: 0.18em; text-transform: uppercase; }
    .doc-subtitle  { font-size: 8.5pt; color: rgba(255,255,255,0.82); margin-top: 3px; letter-spacing: 0.06em; }
    .doc-annex-ref { font-size: 6.5pt; color: rgba(255,255,255,0.58); font-style: italic; margin-top: 2px; }
    .body          { padding: 12px 36px 16px; font-size: 9.5pt; color: #1e293b; }
    .cand-card     { border-left: 4px solid ${b.accent}; background: #f8fafc; padding: 9px 14px; margin-bottom: 14px; }
    .cand-top      { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; padding-bottom: 7px; margin-bottom: 7px; border-bottom: 1px solid #e2e8f0; }
    .cand-name     { font-size: 11pt; font-weight: 700; color: #0f172a; }
    .cand-contact  { font-size: 8pt; color: #475569; }
    .cand-grid     { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 4px; }
    .cfl           { font-size: 6pt; text-transform: uppercase; letter-spacing: 0.09em; color: #94a3b8; font-weight: 700; white-space: nowrap; min-width: 72px; }
    .cfv           { font-size: 8pt; color: #0f172a; font-weight: 600; }
    .content h1    { font-size: 12pt; font-weight: 700; color: #0f172a; margin: 14px 0 6px; }
    .content h2    { font-size: 10pt; font-weight: 600; color: ${b.accent}; margin: 11px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; }
    .content h3    { font-size: 9pt; font-weight: 600; color: ${b.secondary}; letter-spacing: 0.06em; text-transform: uppercase; margin: 9px 0 4px; }
    .content p     { margin-bottom: 5px; orphans: 3; widows: 3; }
    .content ul, .content ol { padding-left: 18px; margin: 4px 0 8px; }
    .content li    { margin-bottom: 2px; }
    .content table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 8.5pt; }
    .content table th { background: ${b.accent}18; font-weight: 700; padding: 5px 8px; border: 1px solid #d1d5db; text-align: left; }
    .content table td { padding: 4px 8px; border: 1px solid #e5e7eb; }
    .content table tr:nth-child(even) td { background: #f8fafc; }
    .sig-section   { margin-top: 18px; padding-top: 14px; border-top: 1.5px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid; }
    .sig-label     { font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #94a3b8; margin-bottom: 16px; }
    .sig-grid      { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sig-block     { display: flex; flex-direction: column; }
    .sig-for       { font-size: 6pt; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; font-weight: 700; margin-bottom: 12px; }
    .sig-img       { max-height: 100px; width: auto; max-width: 240px; display: block; margin-bottom: 4px; }
    .sig-line      { width: 240px; border: none; border-top: 1.5px solid #374151; margin: 80px 0 8px; }
    .sig-line-img  { width: 240px; border: none; border-top: 1.5px solid #374151; margin: 4px 0 8px; }
    .sig-name      { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .sig-desig     { font-size: 8.5pt; color: #374151; margin-bottom: 3px; }
    .sig-auth      { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
    .sig-date      { margin-top: 12px; font-size: 8pt; color: #374151; }
    .watermark     { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 0; pointer-events: none; opacity: 0.05; max-width: 55%; }
    .above-wm      { position: relative; z-index: 1; }
    .page-break    { page-break-before: always; break-before: page; display: block; height: 0; margin: 0; padding: 0; }
  `
}

// ─── Footer template injected by Puppeteer on every page ──────────────────────

function footerTpl(b: BrandVars): string {
  // Puppeteer injects this HTML into the bottom margin area of every page.
  // font-size must be set inline as Puppeteer footerTemplate ignores body styles.
  // <span class="pageNumber"> and <span class="totalPages"> are Puppeteer magic spans.
  const lines = [
    `<span style="font-weight:700;color:#64748b;font-size:7.5pt;">${esc(b.company)}</span>`,
    b.footerAddress ? `<span style="color:#6b7280;font-size:7pt;">${esc(b.footerAddress)}</span>` : '',
    b.footerContact ? `<span style="color:#9ca3af;font-size:7pt;">${esc(b.footerContact)}</span>` : '',
  ].filter(Boolean).join('<br>')

  return `
    <div style="width:100%;font-family:Arial,sans-serif;line-height:1.5;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 36px 2px;">
        <div>${lines}</div>
        <div style="font-size:7.5pt;font-weight:600;color:#64748b;white-space:nowrap;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      </div>
    </div>
    <div style="height:4px;background:${b.accent};width:100%;"></div>
  `
}

// ─── Offer Letter HTML ────────────────────────────────────────────────────────

export function buildOfferLetterHtml(
  letter: {
    id: string; offerRef?: string | null; candidateName: string; candidateEmail?: string | null
    candidateMobile?: string | null; designation: string; department?: string | null
    reportingManager?: string | null; workLocation?: string | null; joiningDate?: Date | null
    employmentType: string; content: string; createdAt: Date
  },
  hrms: HrmsForPdf,
  platform: PlatformForPdf,
): string {
  const b = brand(hrms, platform)
  const refNum  = letter.offerRef || `QT/HR/${letter.createdAt.getFullYear()}/${letter.id.slice(-6).toUpperCase()}`
  const dateStr = letter.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const joinStr = letter.joiningDate?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) || '—'
  const empType = (letter.employmentType || '').replace(/_/g, ' ')
  const body    = parseContent(letter.content)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${css(b)}</style></head>
<body>
${b.watermarkUrl ? `<img class="watermark" src="${esc(b.watermarkUrl)}" alt="" aria-hidden="true">` : ''}
<div class="above-wm">
  <div class="accent-top"></div>
  <div class="doc-header">
    <div>${b.logoUrl ? `<img src="${esc(b.logoUrl)}" class="brand-logo" alt="${esc(b.company)}">` : `<div class="brand-text">${esc(b.company)}</div>`}</div>
    <div class="doc-meta">
      <div class="doc-ref">${esc(refNum)}</div>
      <div>Date: ${esc(dateStr)}</div>
    </div>
  </div>
  <div class="title-band"><div class="doc-title">Offer Letter</div></div>
  <div class="body">
    <div class="cand-card">
      <div class="cand-top">
        <span class="cand-name">${esc(letter.candidateName)}</span>
        ${letter.candidateEmail  ? `<span style="color:#cbd5e1;">·</span><span class="cand-contact">${esc(letter.candidateEmail)}</span>` : ''}
        ${letter.candidateMobile ? `<span style="color:#cbd5e1;">·</span><span class="cand-contact">${esc(letter.candidateMobile)}</span>` : ''}
      </div>
      <div class="cand-grid">
        <div style="display:flex;gap:5px;"><span class="cfl">Designation</span><span class="cfv">${esc(letter.designation)}</span></div>
        ${letter.department       ? `<div style="display:flex;gap:5px;"><span class="cfl">Department</span><span class="cfv">${esc(letter.department)}</span></div>` : ''}
        ${letter.joiningDate      ? `<div style="display:flex;gap:5px;"><span class="cfl">Date of Joining</span><span class="cfv">${esc(joinStr)}</span></div>` : ''}
        ${letter.workLocation     ? `<div style="display:flex;gap:5px;"><span class="cfl">Work Location</span><span class="cfv">${esc(letter.workLocation)}</span></div>` : ''}
        ${letter.reportingManager ? `<div style="display:flex;gap:5px;"><span class="cfl">Reporting Manager</span><span class="cfv">${esc(letter.reportingManager)}</span></div>` : ''}
        ${empType ? `<div style="display:flex;gap:5px;"><span class="cfl">Employment Type</span><span class="cfv">${esc(empType)}</span></div>` : ''}
      </div>
    </div>
    <div class="content">${body || `<p>We are pleased to offer you the position of ${esc(letter.designation)} at ${esc(b.company)}. Your date of joining will be ${esc(joinStr)}.</p>`}</div>
    <div class="sig-section">
      <div class="sig-label">Signatures</div>
      <div class="sig-grid">
        <div class="sig-block">
          <div class="sig-for">For ${esc(b.company)}</div>
          ${b.sigImageUrl ? `<img src="${esc(b.sigImageUrl)}" class="sig-img" crossorigin="anonymous"><div class="sig-line-img"></div>` : '<div class="sig-line"></div>'}
          <div class="sig-name">${esc(b.sigName)}</div>
          ${b.sigDesig ? `<div class="sig-desig">${esc(b.sigDesig)}</div>` : ''}
          <div class="sig-auth">Authorized Signatory</div>
        </div>
        <div class="sig-block">
          <div class="sig-for">Accepted by Candidate</div>
          <div class="sig-line"></div>
          <div class="sig-name">${esc(letter.candidateName)}</div>
          <div class="sig-desig">${esc(letter.designation)}</div>
          <div class="sig-date">Date: ___________________</div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Annexure HTML ────────────────────────────────────────────────────────────

export function buildAnnexureHtml(
  annexure: {
    id: string; label: string; annexureRef?: string | null; title: string; content: string; createdAt: Date
    offerLetter: { offerRef?: string | null; candidateName: string; designation: string }
  },
  hrms: HrmsForPdf,
  platform: PlatformForPdf,
): string {
  const b = brand(hrms, platform)
  const annexureRef = annexure.annexureRef || `Annexure ${annexure.label}`
  const offerRef    = annexure.offerLetter.offerRef || ''
  const dateStr     = annexure.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const body        = renderContent(annexure.content)

  function renderContent(content: string): string {
    if (!content) return ''
    if (content.trimStart().startsWith('<')) return processPageBreaks(content)
    return content.split('\n').filter(l => l.trim())
      .map(l => l.trim() === '{{PAGE_BREAK}}'
        ? '<div class="page-break"></div>'
        : `<p style="margin-bottom:5px;">${esc(l)}</p>`,
      ).join('\n')
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${css(b)}</style></head>
<body>
${b.watermarkUrl ? `<img class="watermark" src="${esc(b.watermarkUrl)}" alt="" aria-hidden="true">` : ''}
<div class="above-wm">
  <div class="accent-top"></div>
  <div class="doc-header">
    <div>${b.logoUrl ? `<img src="${esc(b.logoUrl)}" class="brand-logo" alt="${esc(b.company)}">` : `<div class="brand-text">${esc(b.company)}</div>`}</div>
    <div class="doc-meta">
      <div class="doc-ref">${esc(annexureRef)}</div>
      ${offerRef ? `<div style="font-size:7pt;color:#94a3b8;">Offer: ${esc(offerRef)}</div>` : ''}
      <div>Date: ${esc(dateStr)}</div>
    </div>
  </div>
  <div class="title-band">
    <div class="doc-title">Annexure ${esc(annexure.label)}</div>
    <div class="doc-subtitle">${esc(annexure.title)}</div>
    ${offerRef ? `<div class="doc-annex-ref">Ref: ${esc(offerRef)} — Annexure ${esc(annexure.label)}</div>` : ''}
  </div>
  <div class="body">
    <div class="content">${body || '<p style="color:#9ca3af;font-style:italic;">No content has been entered for this annexure.</p>'}</div>
    <div class="sig-section">
      <div class="sig-label">Authorized Signatory</div>
      <div class="sig-block">
        <div class="sig-for">For ${esc(b.company)}</div>
        ${b.sigImageUrl ? `<img src="${esc(b.sigImageUrl)}" class="sig-img" crossorigin="anonymous"><div class="sig-line-img"></div>` : '<div class="sig-line"></div>'}
        <div class="sig-name">${esc(b.sigName)}</div>
        ${b.sigDesig ? `<div class="sig-desig">${esc(b.sigDesig)}</div>` : ''}
        <div class="sig-auth">Authorized Signatory</div>
      </div>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Puppeteer renderer ───────────────────────────────────────────────────────

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance
  const puppeteer = (await import('puppeteer')).default
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
  return browserInstance
}

export async function renderToPdf(
  html: string,
  footer: string,
): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format:  'A4',
      printBackground: true,
      // displayHeaderFooter: true injects our footer template on every page.
      // headerTemplate is an empty span — suppresses Chromium's built-in
      // URL, title, and date without disabling the footer template.
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      margin: { top: '0', bottom: '22mm', left: '0', right: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

// ─── High-level render helpers (used by API routes) ──────────────────────────

export async function renderOfferLetterPdf(
  letter: Parameters<typeof buildOfferLetterHtml>[0],
  hrms: HrmsForPdf,
  platform: PlatformForPdf,
): Promise<Buffer> {
  const b = brand(hrms, platform)
  return renderToPdf(buildOfferLetterHtml(letter, hrms, platform), footerTpl(b))
}

export async function renderAnnexurePdf(
  annexure: Parameters<typeof buildAnnexureHtml>[0],
  hrms: HrmsForPdf,
  platform: PlatformForPdf,
): Promise<Buffer> {
  const b = brand(hrms, platform)
  return renderToPdf(buildAnnexureHtml(annexure, hrms, platform), footerTpl(b))
}

// ─── DB fetch helpers (used by API routes) ────────────────────────────────────

export async function fetchHrmsBranding() {
  const [hrms, platform] = await Promise.all([
    db.hrmsSettings.findFirst(),
    db.platformSettings.findFirst(),
  ])
  return { hrms: hrms ?? {}, platform: platform ?? {} }
}
