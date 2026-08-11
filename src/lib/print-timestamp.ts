// "Printed On" — the one print/export timestamp for every Quantix invoice.
//
// A printed invoice has to answer two different questions: when it was ISSUED
// (the invoice date, which never moves) and when THIS COPY came off the printer.
// The second must live inside the document — browser print headers, OS print
// metadata and PDF properties are all stripped, ignored or lost the moment the
// page is photocopied, emailed or filed.
//
// Laundry and Commerce both import this, so a receipt from either product reads
// identically. It is a formatter and nothing else: no storage, no print history,
// no database write. The timestamp is produced at render time, which for the
// server-rendered Commerce invoices IS the export moment, and for the Laundry
// client is stamped at the click.

import { PLATFORM } from "@/lib/constants"

/** Reuses the platform timezone rather than introducing a second one. */
export const PRINT_TIMEZONE = PLATFORM.DEFAULT_TIMEZONE // "Asia/Kolkata"
export const PRINT_LOCALE = PLATFORM.DEFAULT_LOCALE     // "en-IN"

export const PRINTED_ON_LABEL = "Printed On"

/**
 * "11 Aug 2026, 07:15 PM" — business-local, never UTC and never the viewer's
 * own timezone, so a copy printed by a store in one place and read in another
 * still shows the business's clock.
 */
export function formatPrintedAt(at: Date | number | string = new Date()): string {
  const d = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(d.getTime())) return formatPrintedAt(new Date())
  const date = d.toLocaleDateString(PRINT_LOCALE, {
    day: "2-digit", month: "short", year: "numeric", timeZone: PRINT_TIMEZONE,
  })
  const time = d.toLocaleTimeString(PRINT_LOCALE, {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: PRINT_TIMEZONE,
  })
  // en-IN renders "am/pm" lowercase; the spec asks for AM/PM.
  return `${date}, ${time.toUpperCase()}`
}

/** The complete line, label included: "Printed On: 11 Aug 2026, 07:15 PM". */
export function printedOnLine(at: Date | number | string = new Date()): string {
  return `${PRINTED_ON_LABEL}: ${formatPrintedAt(at)}`
}
