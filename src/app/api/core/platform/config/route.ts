// ============================================================================
// Route: GET/PUT /api/core/platform/config
// Get all platform config key-value pairs / Set platform config
// PUT is QUANTIX_SUPER_ADMIN only
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Helper: Check if request is from QUANTIX_SUPER_ADMIN
function isSuperAdmin(request: Request): boolean {
  const role = request.headers.get('x-user-role');
  return role === 'QUANTIX_SUPER_ADMIN';
}

export async function GET() {
  try {
    const configs = await db.platformConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Parse values as JSON where possible
    const parsedConfigs = configs.map((config) => {
      let parsedValue: unknown = config.value;
      try {
        parsedValue = JSON.parse(config.value);
      } catch {
        // Keep as string if not valid JSON
      }

      return {
        id: config.id,
        key: config.key,
        value: parsedValue,
        description: config.description,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });

    // Also return as a simple key-value map for convenience
    const configMap: Record<string, unknown> = {};
    for (const config of parsedConfigs) {
      configMap[config.key] = config.value;
    }

    return NextResponse.json({
      success: true,
      data: {
        configs: parsedConfigs,
        map: configMap,
      },
    });
  } catch (error) {
    console.error('[config-get] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // Check admin access
    if (!isSuperAdmin(request)) {
      return NextResponse.json(
        { success: false, error: 'Only QUANTIX_SUPER_ADMIN can update platform config' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { configs } = body as {
      configs: Array<{ key: string; value: unknown; description?: string }>;
    };

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'configs array is required with at least one entry' },
        { status: 400 }
      );
    }

    // Upsert each config entry
    const results = [];
    for (const config of configs) {
      if (!config.key) {
        continue;
      }

      const serialized = typeof config.value === 'string'
        ? config.value
        : JSON.stringify(config.value);

      const result = await db.platformConfig.upsert({
        where: { key: config.key },
        update: {
          value: serialized,
          ...(config.description !== undefined ? { description: config.description } : {}),
        },
        create: {
          key: config.key,
          value: serialized,
          description: config.description,
        },
      });

      results.push({
        key: result.key,
        value: JSON.parse(result.value),
        description: result.description,
      });
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `${results.length} config(s) updated`,
    });
  } catch (error) {
    console.error('[config-put] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update platform config' },
      { status: 500 }
    );
  }
}
