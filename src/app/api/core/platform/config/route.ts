// ============================================================================
// Route: GET/PUT /api/core/platform/config
// GET — Get all platform config (platform admin)
// PUT — Set platform config (QUANTIX_SUPER_ADMIN only)
// ============================================================================

import { db } from '@/lib/db';
import {
  withPlatformAccess,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/middleware';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (_req) => {
    try {
      const configs = await db.platformConfig.findMany({ orderBy: { key: 'asc' } });

      const parsedConfigs = configs.map((config) => {
        let parsedValue: unknown = config.value;
        try { parsedValue = JSON.parse(config.value); } catch { /* keep as string */ }
        return {
          id: config.id,
          key: config.key,
          value: parsedValue,
          description: config.description,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };
      });

      const configMap: Record<string, unknown> = {};
      for (const config of parsedConfigs) configMap[config.key] = config.value;

      return createSuccessResponse({ configs: parsedConfigs, map: configMap });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch platform config';
      return createErrorResponse(message, 500);
    }
  })(request);
}

export async function PUT(request: NextRequest) {
  return withPlatformAccess(async (req) => {
    try {
      // Only QUANTIX_SUPER_ADMIN can mutate platform config
      if (req.user?.role !== 'QUANTIX_SUPER_ADMIN') {
        return createErrorResponse('Only QUANTIX_SUPER_ADMIN can update platform config', 403);
      }

      const body = await req.json();
      const { configs } = body as {
        configs: Array<{ key: string; value: unknown; description?: string }>;
      };

      if (!configs || !Array.isArray(configs) || configs.length === 0) {
        return createErrorResponse('configs array is required with at least one entry', 400);
      }

      const results: Array<{ key: string; value: unknown; description: string | null | undefined }> = [];
      for (const config of configs) {
        if (!config.key) continue;
        const serialized = typeof config.value === 'string'
          ? config.value
          : JSON.stringify(config.value);

        const result = await db.platformConfig.upsert({
          where: { key: config.key },
          update: {
            value: serialized,
            ...(config.description !== undefined ? { description: config.description } : {}),
          },
          create: { key: config.key, value: serialized, description: config.description },
        });

        results.push({ key: result.key, value: JSON.parse(result.value), description: result.description });
      }

      return createSuccessResponse(results);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update platform config';
      return createErrorResponse(message, 500);
    }
  })(request);
}
