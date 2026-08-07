// Quantix CRM — generic Communication (Phase 1) shared server helpers.
//
// Workspace-independent: everything keys on a tenant `businessId` (any
// workspace) and is reused by every CRM. Device-native only (tel: / wa.me /
// mailto:) — no telephony backend. Exotel, WhatsApp Business API, SMTP and SMS
// will later mount on the same records without a redesign.
//
// Recording files are stored under
// UPLOAD_ROOT/crm-recordings/<businessId>/ and the DB metadata lives in the
// generic CrmCallRecording (polymorphic entityType + entityId).
import { join } from "path"
import { writeFile, unlink } from "fs/promises"
import { UPLOAD_ROOT, ensureDir } from "@/lib/upload-root"

// Supported audio upload formats for manual call recordings.
export const RECORDING_MAX_MB = 25
export const RECORDING_MAX_SIZE = RECORDING_MAX_MB * 1024 * 1024
export const RECORDING_TYPES = new Set([
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a
  "audio/x-m4a", // .m4a
  "audio/wav", // .wav
  "audio/x-wav", // .wav
  "audio/aac", // .aac
])
export const RECORDING_EXTS = ["mp3", "m4a", "wav", "aac"]

export function isRecordingMime(mime: string): boolean {
  return RECORDING_TYPES.has(mime)
}

export function isRecordingExt(ext: string): boolean {
  return RECORDING_EXTS.includes(ext.toLowerCase())
}

function recordingDir(businessId: string): string {
  return join(UPLOAD_ROOT, "crm-recordings", businessId)
}

export async function ensureRecordingDir(businessId: string): Promise<string> {
  return ensureDir(join("crm-recordings", businessId))
}

export function recordingStorageName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "mp3"
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

/** Write an uploaded recording to disk and return its storage name. */
export async function persistRecording(
  businessId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  const dir = await ensureRecordingDir(businessId)
  const storageName = recordingStorageName(fileName)
  await writeFile(join(dir, storageName), buffer)
  return storageName
}

export async function deleteRecordingFile(
  businessId: string,
  storageName: string,
): Promise<void> {
  try {
    await unlink(join(recordingDir(businessId), storageName))
  } catch { /* missing file is fine */ }
}

// Absolute path on disk for a stored recording (serving/downloading).
export function recordingFileAbsPath(businessId: string, storageName: string): string {
  return join(recordingDir(businessId), storageName)
}