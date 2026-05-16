// ============================================================================
// Route: GET/PUT /api/admin/import/api-integrations
// Manages CRM API integration configs stored in PlatformConfig.
// GET  — returns current integrations list
// PUT  — saves full integrations list
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

const CONFIG_KEY = 'import.crm_integrations';

export type CrmIntegration = {
  id: string;
  name: string;
  description?: string;
  apiUrl: string;
  authType: 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth2';
  authValue: string;           // API key, token, "user:pass", or client_id
  authSecret?: string;         // OAuth client_secret
  fieldMapping: Record<string, string>;  // their_field -> our_field
  syncDirection: 'inbound' | 'outbound' | 'both';
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'never';
  createdAt: string;
};

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'import:leads',
})(async () => {
  try {
    const config = await db.platformConfig.findUnique({ where: { key: CONFIG_KEY } });
    const integrations: CrmIntegration[] = config ? JSON.parse(config.value) : [];
    return NextResponse.json({ success: true, data: integrations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
});

export const PUT = withMiddleware({
  requireAuth: true,
  requiredPermission: 'import:leads',
})(async (req) => {
  try {
    const body = await req.json();
    const integrations: CrmIntegration[] = body.integrations;

    if (!Array.isArray(integrations)) {
      return NextResponse.json({ success: false, error: 'integrations must be an array' }, { status: 400 });
    }

    await db.platformConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(integrations) },
      create: { key: CONFIG_KEY, value: JSON.stringify(integrations), description: 'CRM API integration configurations for data import' },
    });

    return NextResponse.json({ success: true, data: integrations });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save integrations' },
      { status: 500 }
    );
  }
});
