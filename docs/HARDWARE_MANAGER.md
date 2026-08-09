# Hardware Manager — Administrator & Support Guide

Quantix Laundry OS · `src/lib/hardware`

The Hardware Manager is the single place to see, prove and configure the
scanners, printers and cameras attached to a terminal. It is **additive
infrastructure**: no laundry workflow, API or business rule depends on it, and
every screen keeps working whether or not anyone opens it.

**Where:** Administration → Hardware Manager (directly above Workspace
Settings). Access is restricted to the Business Owner and the Super Admin.

---

## 1. The one thing to understand first

A web page is not an operating system. It cannot see what is plugged into a
computer, and that is a deliberate security boundary in every browser, not a
gap in Quantix.

Concretely:

- A page **cannot enumerate** USB, HID, serial or Bluetooth devices.
- It can only see a device **after the operator has picked it** in a browser
  permission dialog, and only in **Chromium browsers over HTTPS**.
- It **cannot send bytes to a printer** it has not been explicitly paired with.
- It **cannot read a printer's DPI, paper state, ink level or queue**.

So an empty device list is a normal, healthy state. Scanning and printing work
regardless — the device APIs add *detail*, never *capability*.

---

## 2. What can and cannot be detected

| Information | Detected? | Why |
|---|---|---|
| A barcode scanner is attached | **Yes, automatically** | Recognised from typing rhythm — see §3. No pairing, no permission, works in every browser. |
| Scanner is USB vs Bluetooth | **No** | Both emulate a keyboard. Indistinguishable from keystrokes. Reported as Bluetooth only when a Bluetooth scanner has actually been paired. |
| Scanner manufacturer / model / VID / PID | **Only if paired** via WebUSB or WebHID | Otherwise shown as `Unknown`. Never inferred from a vendor id. |
| A printer exists | **Only if paired**, plus the browser print target which is always present | The system print dialog exposes nothing about the selected printer. |
| Printer manufacturer / model / VID / PID | **Only if paired** via WebUSB or Web Serial | Otherwise `Unknown Printer · Connected · Ready`. It still prints. |
| Printer DPI, label width | **No — these are values you record**, not readings | Shown as "declared, not detected". |
| Printer online / offline | **Inferred**, not read | Derived from whether print jobs succeed, plus the manual toggle. There is no browser API for printer state. |
| Labels printed / last print / print duration | **Yes** | Measured by the app itself. |
| Cameras exist | **Yes** | `enumerateDevices()` lists them. |
| Camera name, resolution, front/rear | **Only after permission is granted** | Labels are an anti-fingerprinting restriction. "Test Camera" opens the stream briefly to read them, then stops it. |
| Network online/offline | **Yes** (coarse) | `navigator.onLine` reports the browser's own connectivity, not whether your printer is reachable. |
| Weight scales, RFID, NFC, cash drawers | **Not yet implemented** | The device model reserves these kinds so a saved profile stays valid when they arrive. |

**Rule the code follows everywhere: report what the device declares, never
guess.** A USB interface class of `7` means the device itself says "printer",
so that is a fact worth showing. A vendor id is not a model, and there is no
lookup table anywhere in this layer.

---

## 3. Automatic scanner detection

Most barcode scanners are "keyboard wedges": they type the barcode and press
Enter. Nothing identifies them — but they type far faster than a person.

- A person typing `ABC123` takes roughly **400–1500 ms**.
- A scanner emits the same string in roughly **20–80 ms**.

The Scan Engine watches the gaps between keystrokes. A burst of 4 or more
characters with a **mean gap of 35 ms or less**, ended by Enter, is classified
as a scanner. Nothing is consumed — the focused field still receives every
keystroke exactly as before, so this cannot change how any screen behaves.

Once a scanner is seen, it is considered present for **5 minutes** of silence
before the engine falls back down the ladder.

### The ladder

```
USB scanner → Bluetooth scanner → camera → manual entry
```

Walked automatically. No screen asks the operator to choose. An administrator
can pin the fallback to manual entry (Preferences → Scanner) for a counter
where pointing a camera at a customer's clothing is unwelcome.

---

## 4. Printing

`PrintEngine.print()` is the single call every workflow makes. It:

1. resolves the store's default printer for the job's role (barcode, QR,
   invoice, A4, receipt), honouring a one-time override;
2. renders through a hidden iframe — never a popup, which is what previously
   froze the Barcode Generation screen and is silently killed by blockers;
3. records diagnostics and an event-log entry;
4. **queues the job instead of dropping it** when the printer is offline, and
   resumes oldest-first on reconnect. A lost label is a garment nobody can
   find later.

### What default-printer selection does and does not do

It **does**: remember the operator's choice, show it, attribute diagnostics to
a named device, and open the dialog against the right target where the OS
honours it.

It **does not** drive the printer. Sending raw **TSPL** (TSC) or **ESC/POS**
(Epson) byte streams over WebUSB is possible in principle but is not
implemented here, because getting it wrong prints garbage on a live counter.
Output today is byte-for-byte identical to what Laundry OS produced before this
layer existed.

---

## 5. Diagnostics, event log and queue

- **Diagnostics** — today's scan and print counts, last barcode, average scan
  speed, average print time, last error, last disconnect.
- **Event log** — the newest 500 events (connect, disconnect, print, failure,
  permission, preference change), searchable, filterable by level, exportable
  to CSV for a support ticket.
- **Print queue** — every job with status `PENDING / PRINTING / COMPLETED /
  FAILED / CANCELLED`, with Retry and Cancel.

All three live in `localStorage` **on the terminal**. They are operational
telemetry for a technician standing at the machine, not business records: they
never reach the server, and nothing in a workflow waits on them.

---

## 6. Device profiles are per terminal, per store

A printer belongs to a counter, not to a company. Two terminals in one store
can have different hardware, and Store 1's TSC is not Store 2's Brother.
Profiles are therefore keyed by store **in browser storage**, which is the only
thing that describes the machine you are standing at.

Consequence worth knowing: **clearing browser data resets a terminal's hardware
preferences.** Nothing breaks — every role falls back to browser printing — but
the defaults must be re-chosen.

---

## 7. Health indicator

The chip in the shell header and the Hardware dashboard both read one function,
`hardwareHealth()`, so they can never disagree.

| State | Meaning |
|---|---|
| 🟢 Hardware Healthy | Scanner present, printer online, nothing queued or failed |
| 🟡 Degraded | Scanner missing (typing still works) or jobs queued |
| 🔴 Critical | Printer offline or a print has failed |

Printer problems outrank scanner problems: a queued label blocks the counter,
whereas a missing scanner still lets the operator type.

---

## 8. Adding new hardware later

Adding a weight scale, RFID reader, NFC reader, signature pad, cash drawer or
payment terminal requires:

1. a new value in `DeviceKind` (`src/lib/hardware/types.ts`) — already reserved
   for all of the above;
2. discovery logic in `src/lib/hardware/registry.ts`;
3. a section in the Hardware Manager if it needs configuring.

**No laundry workflow changes.** Workflows call `ScanEngine` and `PrintEngine`
and never learn the transport, which is the whole point of the layer.

---

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Device list shows only "Browser Print" | Normal. Nothing has been paired, or the browser is not Chromium / not on HTTPS. |
| "Model Unknown" on a working printer | Expected for the system print dialog. Pair via WebUSB to see identifiers. |
| Pair buttons missing | The browser lacks WebUSB / WebHID / Web Serial. Scanning and printing still work. |
| Scanner chip stuck on "Camera Ready" | No fast keystroke burst seen yet. Scan once; it turns green. Check Preferences → Auto detect is on. |
| Camera says "Unknown until permission is granted" | Correct. Click Test Camera. |
| Nothing appears and the page warns about a secure origin | The site is on plain HTTP. Every device API is blocked until HTTPS. |
