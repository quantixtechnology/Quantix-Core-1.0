"use client"

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  if (ctx.state === "suspended") ctx.resume()
  return ctx
}

export function playScanOk(enabled = true): void {
  if (!enabled) return
  try {
    const c = getCtx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = "sine"
    o.frequency.setValueAtTime(1200, c.currentTime)
    o.frequency.setValueAtTime(1600, c.currentTime + 0.08)
    o.frequency.setValueAtTime(2000, c.currentTime + 0.16)
    g.gain.setValueAtTime(0.25, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35)
    o.start(c.currentTime); o.stop(c.currentTime + 0.35)
  } catch { /* noop */ }
}

export function playScanError(enabled = true): void {
  if (!enabled) return
  try {
    const c = getCtx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = "square"
    o.frequency.setValueAtTime(300, c.currentTime)
    o.frequency.setValueAtTime(220, c.currentTime + 0.12)
    g.gain.setValueAtTime(0.15, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    o.start(c.currentTime); o.stop(c.currentTime + 0.4)
  } catch { /* noop */ }
}
