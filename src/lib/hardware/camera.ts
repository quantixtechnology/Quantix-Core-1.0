// Camera manager — the last automatic rung of the scan ladder.
//
// What a browser will tell you about a camera depends entirely on permission:
// before a grant, enumerateDevices() returns entries with EMPTY labels and no
// capabilities, by design, because device labels are a fingerprinting vector.
// Resolution and facing mode only become knowable once a stream is actually
// opened. So "Rear camera: unknown" before the operator clicks Test Camera is
// correct behaviour, not a bug.

import { eventLog } from "./event-log"

export interface CameraInfo {
  permission: "granted" | "denied" | "prompt" | "unknown"
  count: number
  /** Only reliable once permission exists; labels are blank until then. */
  labels: string[]
  rearCameraDetected: boolean | null
  resolution: string | null
  error?: string | null
}

export const EMPTY_CAMERA: CameraInfo = {
  permission: "unknown", count: 0, labels: [], rearCameraDetected: null, resolution: null,
}

/** Non-invasive probe — never opens a stream, never prompts. */
export async function probeCamera(): Promise<CameraInfo> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return { ...EMPTY_CAMERA, error: "This browser exposes no camera API" }
  }
  let permission: CameraInfo["permission"] = "unknown"
  try {
    // Permissions API is not universal (notably absent in Safari for camera).
    const st = await navigator.permissions?.query({ name: "camera" as PermissionName })
    if (st?.state) permission = st.state as CameraInfo["permission"]
  } catch { /* unsupported — stays "unknown", which is the honest answer */ }

  try {
    const list = await navigator.mediaDevices.enumerateDevices()
    const cams = list.filter((d) => d.kind === "videoinput")
    const labels = cams.map((c) => c.label).filter(Boolean)
    return {
      permission,
      count: cams.length,
      labels,
      // Without labels there is nothing to match on, so we say "unknown"
      // rather than guessing from device order.
      rearCameraDetected: labels.length ? labels.some((l) => /back|rear|environment/i.test(l)) : null,
      resolution: null,
    }
  } catch (e) {
    return { ...EMPTY_CAMERA, permission, error: e instanceof Error ? e.message : "Camera enumeration blocked" }
  }
}

/**
 * Opens the rear camera briefly to prove it works and to read the one thing
 * only a live stream reveals — the actual capture resolution. The stream is
 * stopped immediately; nothing is recorded.
 */
export async function testCamera(): Promise<CameraInfo> {
  const base = await probeCamera()
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    eventLog.record("ERROR", "Camera test failed", "No getUserMedia in this browser")
    return { ...base, error: "This browser exposes no camera API" }
  }
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    const track = stream.getVideoTracks()[0]
    const s = track?.getSettings?.() || {}
    const resolution = s.width && s.height ? `${s.width}×${s.height}` : null
    const after = await probeCamera() // labels appear once permission is granted
    eventLog.record("CAMERA_GRANTED", "Camera test passed", resolution ? `Capture ${resolution}` : null)
    return {
      ...after,
      permission: "granted",
      resolution,
      rearCameraDetected: s.facingMode ? s.facingMode === "environment" : after.rearCameraDetected,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Camera access denied"
    eventLog.record("CAMERA_DENIED", "Camera test failed", msg)
    return { ...base, permission: "denied", error: msg }
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
  }
}
