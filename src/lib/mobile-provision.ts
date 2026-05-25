// ============================================================================
// QUANTIX CORE — Mobile Provisioning Client
// Calls the mobile-provision microservice and persists state via Deployment
// records in the Core database.
//
// DeploymentType:  CUSTOMER_APP | DELIVERY_APP | ADMIN_APP
// DeploymentStatus mapping:
//   PENDING      → provision service received request
//   BUILDING     → CI running on GitHub
//   LIVE         → APK + AAB built and available
//   FAILED       → any stage errored
// ============================================================================

import { db } from '@/lib/db';

// ── Config ───────────────────────────────────────────────────────────────────
const PROVISION_URL = process.env.MOBILE_PROVISION_URL ?? 'http://localhost:3400';
const PROVISION_API_KEY = process.env.MOBILE_PROVISION_API_KEY ?? '';

// Maps Core BusinessType to the slug-friendly type expected by create_business.sh
const BUSINESS_TYPE_SLUG: Record<string, string> = {
  GROCERY: 'grocery',
  FOOD_DELIVERY: 'restaurant',
  MEAT_DELIVERY: 'meat',
  LAUNDRY: 'generic',
  CAR_WASH: 'generic',
  PHARMACY: 'grocery',
  HOME_SERVICES: 'generic',
  ECOMMERCE: 'generic',
  COSMETICS: 'salon',
  FURNITURE: 'generic',
  DIRECTORY: 'generic',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MobileProvisionInput {
  businessId: string;
  slug: string;
  name: string;
  logo?: string | null;
  primaryColor?: string;
  accentColor?: string;
  businessType: string;
  packageBase?: string;
  featureFlags?: string[];
}

export interface MobileProvisionStatus {
  slug: string;
  status: string;
  brandingStatus: string;
  firebaseStatus: string;
  repoUrl: string | null;
  apkUrl: string | null;
  aabUrl: string | null;
  error: string | null;
  updatedAt: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function headers() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROVISION_API_KEY) h['X-Api-Key'] = PROVISION_API_KEY;
  return h;
}

/**
 * Map a provision-service status string to a Prisma DeploymentStatus value.
 */
function toDeploymentStatus(
  provisionStatus: string,
): 'PENDING' | 'BUILDING' | 'LIVE' | 'FAILED' {
  switch (provisionStatus.toUpperCase()) {
    case 'PENDING':
    case 'PROVISIONING':
      return 'PENDING';
    case 'BUILDING':
      return 'BUILDING';
    case 'READY':
      return 'LIVE';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

// ── Core public API ───────────────────────────────────────────────────────────

/**
 * Trigger mobile provisioning for a newly-created business.
 * Creates Deployment records (CUSTOMER_APP, DELIVERY_APP, ADMIN_APP) in PENDING
 * state, then fires the provision service request asynchronously.
 *
 * Safe to call fire-and-forget — errors are logged but never thrown so that
 * business creation is never blocked.
 */
export async function triggerMobileProvisioning(
  input: MobileProvisionInput,
): Promise<void> {
  const { businessId, slug, name, logo, primaryColor, accentColor, businessType, packageBase, featureFlags } = input;

  const packageId = packageBase ?? `com.${slug.replace(/-/g, '')}`;
  const provisionType = BUSINESS_TYPE_SLUG[businessType] ?? 'generic';

  // 1. Upsert Deployment records for all three app types
  const appTypes: Array<'CUSTOMER_APP' | 'DELIVERY_APP' | 'ADMIN_APP'> = [
    'CUSTOMER_APP',
    'DELIVERY_APP',
    'ADMIN_APP',
  ];

  try {
    await Promise.all(
      appTypes.map((type) =>
        db.deployment.upsert({
          where: {
            // composite unique doesn't exist — use findFirst + create/update pattern
            id: `mobile-${slug}-${type.toLowerCase()}`,
          },
          update: {
            status: 'PENDING',
            hostingProvider: 'github-actions',
            hostingConfig: JSON.stringify({ packageId, provisionType }),
            notes: `Mobile provisioning triggered for ${name}`,
          },
          create: {
            id: `mobile-${slug}-${type.toLowerCase()}`,
            businessId,
            type,
            status: 'PENDING',
            environment: 'production',
            hostingProvider: 'github-actions',
            hostingConfig: JSON.stringify({ packageId, provisionType }),
            deployedBy: 'system',
            notes: `Mobile provisioning triggered for ${name}`,
          },
        }),
      ),
    );
  } catch (err) {
    console.error(`[mobile-provision] Failed to create Deployment records for ${slug}:`, err);
    // Don't re-throw — business creation should not fail because of this
    return;
  }

  // 2. Call the provision service (fire and forget — we track state via webhook)
  void callProvisionService({
    businessId,
    slug,
    name,
    logo,
    primaryColor: primaryColor ?? '#00B14F',
    accentColor: accentColor ?? '#FF6B00',
    provisionType,
    packageId,
    featureFlags,
  }).catch((err) => {
    console.error(`[mobile-provision] Provision service call failed for ${slug}:`, err);
    // Mark all deployments as FAILED since we couldn't even start
    void db.deployment
      .updateMany({
        where: { businessId, type: { in: appTypes } },
        data: {
          status: 'FAILED',
          notes: `Provision service unreachable: ${err instanceof Error ? err.message : String(err)}`,
        },
      })
      .catch(() => {/* swallow secondary error */});
  });
}

async function callProvisionService(params: {
  businessId: string;
  slug: string;
  name: string;
  logo?: string | null;
  primaryColor: string;
  accentColor: string;
  provisionType: string;
  packageId: string;
  featureFlags?: string[];
}) {
  const res = await fetch(`${PROVISION_URL}/mobile/provision-tenant`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      businessId: params.businessId,
      slug: params.slug,
      name: params.name,
      logo: params.logo,
      theme: {
        primaryColor: params.primaryColor,
        accentColor: params.accentColor,
      },
      businessType: params.provisionType,
      packageId: params.packageId,
      features: params.featureFlags,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

/**
 * Fetch current mobile provisioning status from the provision service and
 * sync it into the Deployment records.
 */
export async function getMobileProvisionStatus(
  businessId: string,
  slug: string,
): Promise<MobileProvisionStatus | null> {
  try {
    const res = await fetch(`${PROVISION_URL}/mobile/tenants/${slug}`, {
      headers: headers(),
      signal: AbortSignal.timeout(8_000),
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as MobileProvisionStatus;

    // Sync status into Core Deployment records
    const dbStatus = toDeploymentStatus(data.status);
    const config = JSON.stringify({
      repoUrl: data.repoUrl,
      apkUrl: data.apkUrl,
      aabUrl: data.aabUrl,
      brandingStatus: data.brandingStatus,
      firebaseStatus: data.firebaseStatus,
      error: data.error,
    });

    await db.deployment.updateMany({
      where: {
        businessId,
        type: { in: ['CUSTOMER_APP', 'DELIVERY_APP', 'ADMIN_APP'] },
      },
      data: {
        status: dbStatus,
        liveUrl: data.apkUrl ?? data.aabUrl ?? null,
        buildUrl: data.repoUrl ?? null,
        hostingConfig: config,
        lastCheckedAt: new Date(),
      },
    });

    return data;
  } catch (err) {
    console.error(`[mobile-provision] Status fetch failed for ${slug}:`, err);
    return null;
  }
}

/**
 * Re-trigger provisioning for a business that is in FAILED state.
 * Resets Deployment status to PENDING then fires the service again.
 */
export async function retryMobileProvisioning(
  businessId: string,
  slug: string,
): Promise<void> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true, logo: true, primaryColor: true, businessType: true },
  });
  if (!business) throw new Error('Business not found');

  // Reset status so the UI reflects a fresh attempt
  await db.deployment.updateMany({
    where: {
      businessId,
      type: { in: ['CUSTOMER_APP', 'DELIVERY_APP', 'ADMIN_APP'] },
    },
    data: { status: 'PENDING', notes: 'Retry triggered' },
  });

  await triggerMobileProvisioning({
    businessId,
    slug,
    name: business.name,
    logo: business.logo,
    primaryColor: business.primaryColor,
    businessType: business.businessType,
  });
}

/**
 * Handle an inbound CI webhook — update Deployment records and persist
 * artifact URLs in hostingConfig.
 */
export async function handleMobileWebhook(payload: {
  slug: string;
  status: string; // "success" | "failure" | "cancelled" | "READY" | "FAILED"
  apkUrl?: string;
  aabUrl?: string;
}) {
  const { slug, status, apkUrl, aabUrl } = payload;

  // Resolve businessId from slug
  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!business) {
    throw new Error(`No business found with slug "${slug}"`);
  }

  const isSuccess =
    status.toLowerCase() === 'success' || status.toUpperCase() === 'READY';
  const dbStatus: 'LIVE' | 'FAILED' = isSuccess ? 'LIVE' : 'FAILED';

  const existing = await db.deployment.findFirst({
    where: { businessId: business.id, type: 'CUSTOMER_APP' },
    select: { hostingConfig: true },
  });
  const prevConfig = existing?.hostingConfig
    ? (JSON.parse(existing.hostingConfig) as Record<string, unknown>)
    : {};

  const updatedConfig = JSON.stringify({
    ...prevConfig,
    apkUrl: apkUrl ?? prevConfig.apkUrl ?? null,
    aabUrl: aabUrl ?? prevConfig.aabUrl ?? null,
    error: isSuccess ? null : `CI build ${status}`,
  });

  await db.deployment.updateMany({
    where: {
      businessId: business.id,
      type: { in: ['CUSTOMER_APP', 'DELIVERY_APP', 'ADMIN_APP'] },
    },
    data: {
      status: dbStatus,
      liveUrl: apkUrl ?? aabUrl ?? null,
      hostingConfig: updatedConfig,
      deployedAt: isSuccess ? new Date() : null,
      lastCheckedAt: new Date(),
    },
  });

  await db.activityLog.create({
    data: {
      businessId: business.id,
      action: isSuccess ? 'mobile.build_ready' : 'mobile.build_failed',
      entity: 'Deployment',
      entityId: business.id,
      details: JSON.stringify({ slug, status, apkUrl, aabUrl }),
    },
  });
}
