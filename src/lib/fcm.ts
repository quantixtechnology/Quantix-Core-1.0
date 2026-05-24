// ============================================================================
// QUANTIX — Firebase Cloud Messaging (FCM) Push Notification Driver
//
// Credentials via environment variables:
//   FCM_PROJECT_ID      — Firebase project ID
//   FCM_CLIENT_EMAIL    — Service account client_email
//   FCM_PRIVATE_KEY     — Service account private_key (newlines as \n)
//
// Falls back gracefully when credentials are absent (dev/test mode).
// ============================================================================

import { db } from '@/lib/db';

const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const FCM_PRIVATE_KEY = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_ENDPOINT = (projectId: string) =>
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

// ── OAuth2 token via service account (no SDK dependency) ─────────────────────

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiry - 60) return _cachedToken;

  try {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(
      JSON.stringify({
        iss: FCM_CLIENT_EMAIL,
        scope: FCM_SCOPE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const { createSign } = await import('crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const sig = signer.sign(FCM_PRIVATE_KEY, 'base64url');
    const jwt = `${header}.${claim}.${sig}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      console.error('[FCM] Token exchange failed:', await res.text());
      return null;
    }

    const json = await res.json() as { access_token: string; expires_in: number };
    _cachedToken = json.access_token;
    _tokenExpiry = now + json.expires_in;
    return _cachedToken;
  } catch (e) {
    console.error('[FCM] Failed to get access token:', e);
    return null;
  }
}

// ── Send to a single FCM token ─────────────────────────────────────────────

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface FcmResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isStale?: boolean; // token is invalid, should be removed
}

export async function sendToToken(token: string, payload: FcmPayload): Promise<FcmResult> {
  if (!FCM_PROJECT_ID) {
    console.warn('[FCM] No credentials configured — push skipped (dev mode)');
    return { success: true };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'Could not get FCM access token' };

  try {
    const res = await fetch(FCM_ENDPOINT(FCM_PROJECT_ID), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
          },
          data: Object.fromEntries(
            Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v)]),
          ),
          android: { priority: 'high' },
          apns: { headers: { 'apns-priority': '10' } },
        },
      }),
    });

    const json = await res.json() as { name?: string; error?: { status?: string; message?: string } };

    if (!res.ok) {
      const status = json.error?.status;
      const isStale = status === 'INVALID_ARGUMENT' || status === 'NOT_FOUND';
      return { success: false, error: json.error?.message ?? 'FCM error', isStale };
    }

    return { success: true, messageId: json.name };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'FCM send failed' };
  }
}

// ── Send to all devices of a user ──────────────────────────────────────────

export async function sendToUser(
  userId: string,
  payload: FcmPayload,
): Promise<{ sent: number; failed: number }> {
  const devices = await db.notificationDevice.findMany({
    where: { userId, isActive: true },
    select: { id: true, fcmToken: true },
  });

  // Fallback: check legacy User.fcmToken
  if (devices.length === 0) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) {
      const result = await sendToToken(user.fcmToken, payload);
      return { sent: result.success ? 1 : 0, failed: result.success ? 0 : 1 };
    }
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(
    devices.map(async (d) => {
      const result = await sendToToken(d.fcmToken, payload);
      if (result.success) {
        sent++;
      } else {
        failed++;
        if (result.isStale) staleIds.push(d.id);
      }
    }),
  );

  // Clean up stale tokens
  if (staleIds.length > 0) {
    await db.notificationDevice.updateMany({
      where: { id: { in: staleIds } },
      data: { isActive: false },
    }).catch(() => {});
  }

  return { sent, failed };
}

// ── Send to multiple users ─────────────────────────────────────────────────

export async function sendToUsers(userIds: string[], payload: FcmPayload) {
  const results = await Promise.allSettled(userIds.map((id) => sendToUser(id, payload)));
  const totals = results.reduce(
    (acc, r) => {
      if (r.status === 'fulfilled') {
        acc.sent += r.value.sent;
        acc.failed += r.value.failed;
      }
      return acc;
    },
    { sent: 0, failed: 0 },
  );
  return totals;
}
