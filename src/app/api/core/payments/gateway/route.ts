// ============================================================================
// QUANTIX CORE — Payment Gateway Configuration API
// GET    /api/core/payments/gateway — Get gateway config (masked keys)
// POST   /api/core/payments/gateway — Set up Razorpay gateway for a business
// PUT    /api/core/payments/gateway — Update gateway config
// DELETE /api/core/payments/gateway — Disable gateway
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

// ============================================================================
// GET — Get current gateway config for a business (masked keys)
// ============================================================================

export const GET = withMiddleware({ requireAuth: true, requireBusinessContext: true })(
  async (req) => {
    try {
      const businessId = req.user!.businessId;
      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
      }

      const gateways = await db.paymentGateway.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      });

      // Mask sensitive keys in config
      const maskedGateways = gateways.map((gateway) => {
        const config = JSON.parse(gateway.config || '{}') as Record<string, string>;
        const maskedConfig: Record<string, string> = {};

        for (const [key, value] of Object.entries(config)) {
          if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key_secret')) {
            // Mask the secret — show only last 4 chars
            maskedConfig[key] = value.length > 4
              ? '••••' + value.slice(-4)
              : '••••';
          } else {
            maskedConfig[key] = value;
          }
        }

        return {
          id: gateway.id,
          name: gateway.name,
          gateway: gateway.gateway,
          isActive: gateway.isActive,
          isTestMode: gateway.isTestMode,
          config: maskedConfig,
          createdAt: gateway.createdAt,
          updatedAt: gateway.updatedAt,
        };
      });

      return NextResponse.json({
        success: true,
        data: maskedGateways,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get gateway config';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);

// ============================================================================
// POST — Set up Razorpay gateway for a business
// ============================================================================

export const POST = withMiddleware({ requireAuth: true, requireBusinessContext: true })(
  async (req) => {
    try {
      const body = await req.json();
      const businessId = req.user!.businessId;
      const userId = req.user!.id;

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
      }

      const { name, keyId, keySecret, webhookSecret, isTestMode } = body;

      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Gateway name is required' },
          { status: 400 }
        );
      }

      if (!keyId) {
        return NextResponse.json(
          { success: false, error: 'Razorpay Key ID is required' },
          { status: 400 }
        );
      }

      if (!keySecret) {
        return NextResponse.json(
          { success: false, error: 'Razorpay Key Secret is required' },
          { status: 400 }
        );
      }

      // Check if a gateway with the same name already exists for this business
      const existing = await db.paymentGateway.findUnique({
        where: {
          businessId_name: { businessId, name },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: `A gateway named "${name}" already exists for this business. Use PUT to update it.` },
          { status: 409 }
        );
      }

      // Create the PaymentGateway record
      const gateway = await db.paymentGateway.create({
        data: {
          businessId,
          name,
          gateway: 'razorpay',
          isActive: true,
          isTestMode: isTestMode !== undefined ? Boolean(isTestMode) : true,
          config: JSON.stringify({
            keyId,
            keySecret,
            webhookSecret: webhookSecret || '',
          }),
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId,
          action: 'payment_gateway.created',
          entity: 'PaymentGateway',
          entityId: gateway.id,
          details: JSON.stringify({
            name,
            gateway: 'razorpay',
            isTestMode: gateway.isTestMode,
          }),
        },
      });

      // Return with masked secret
      const config = JSON.parse(gateway.config || '{}') as Record<string, string>;
      const maskedConfig: Record<string, string> = {};
      for (const [key, value] of Object.entries(config)) {
        if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key_secret')) {
          maskedConfig[key] = value.length > 4 ? '••••' + value.slice(-4) : '••••';
        } else {
          maskedConfig[key] = value;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          id: gateway.id,
          name: gateway.name,
          gateway: gateway.gateway,
          isActive: gateway.isActive,
          isTestMode: gateway.isTestMode,
          config: maskedConfig,
          createdAt: gateway.createdAt,
        },
        message: 'Payment gateway configured successfully',
      }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set up gateway';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);

// ============================================================================
// PUT — Update gateway config
// ============================================================================

export const PUT = withMiddleware({ requireAuth: true, requireBusinessContext: true })(
  async (req) => {
    try {
      const body = await req.json();
      const businessId = req.user!.businessId;
      const userId = req.user!.id;

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
      }

      const { gatewayId, name, keyId, keySecret, webhookSecret, isActive, isTestMode } = body;

      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: 'gatewayId is required' },
          { status: 400 }
        );
      }

      // Find the gateway and verify it belongs to the business
      const existing = await db.paymentGateway.findFirst({
        where: { id: gatewayId, businessId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Payment gateway not found' },
          { status: 404 }
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (isTestMode !== undefined) updateData.isTestMode = Boolean(isTestMode);

      // Update config if any key fields provided
      if (keyId || keySecret || webhookSecret !== undefined) {
        const currentConfig = JSON.parse(existing.config || '{}') as Record<string, string>;
        if (keyId) currentConfig.keyId = keyId;
        if (keySecret) currentConfig.keySecret = keySecret;
        if (webhookSecret !== undefined) currentConfig.webhookSecret = webhookSecret;
        updateData.config = JSON.stringify(currentConfig);
      }

      const gateway = await db.paymentGateway.update({
        where: { id: gatewayId },
        data: updateData,
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId,
          action: 'payment_gateway.updated',
          entity: 'PaymentGateway',
          entityId: gateway.id,
          details: JSON.stringify({
            name: gateway.name,
            updatedFields: Object.keys(updateData),
          }),
        },
      });

      // Return with masked secret
      const config = JSON.parse(gateway.config || '{}') as Record<string, string>;
      const maskedConfig: Record<string, string> = {};
      for (const [key, value] of Object.entries(config)) {
        if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key_secret')) {
          maskedConfig[key] = value.length > 4 ? '••••' + value.slice(-4) : '••••';
        } else {
          maskedConfig[key] = value;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          id: gateway.id,
          name: gateway.name,
          gateway: gateway.gateway,
          isActive: gateway.isActive,
          isTestMode: gateway.isTestMode,
          config: maskedConfig,
          updatedAt: gateway.updatedAt,
        },
        message: 'Payment gateway updated successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update gateway';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);

// ============================================================================
// DELETE — Disable gateway
// ============================================================================

export const DELETE = withMiddleware({ requireAuth: true, requireBusinessContext: true })(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const gatewayId = searchParams.get('gatewayId');
      const businessId = req.user!.businessId;
      const userId = req.user!.id;

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
      }

      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: 'gatewayId query parameter is required' },
          { status: 400 }
        );
      }

      // Find the gateway and verify it belongs to the business
      const existing = await db.paymentGateway.findFirst({
        where: { id: gatewayId, businessId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Payment gateway not found' },
          { status: 404 }
        );
      }

      // Soft-disable by setting isActive = false rather than deleting
      await db.paymentGateway.update({
        where: { id: gatewayId },
        data: { isActive: false },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId,
          action: 'payment_gateway.disabled',
          entity: 'PaymentGateway',
          entityId: gatewayId,
          details: JSON.stringify({
            name: existing.name,
            gateway: existing.gateway,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment gateway disabled successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable gateway';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
