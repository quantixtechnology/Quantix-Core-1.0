import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const taxConfigs = await db.taxConfig.findMany({
      where: { businessId },
      orderBy: { gstRate: 'asc' },
    });

    return NextResponse.json({ success: true, data: taxConfigs });
  } catch (error) {
    console.error('Get tax configs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tax configs' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { name, taxType, gstRate, cgstRate, sgstRate, igstRate, cessRate, hsnCode, isActive, isDefault } = body;

    if (!name || !taxType || gstRate === undefined) {
      return NextResponse.json(
        { success: false, error: 'name, taxType, and gstRate are required' },
        { status: 400 }
      );
    }

    const taxConfig = await db.taxConfig.create({
      data: {
        businessId,
        name,
        taxType,
        gstRate: parseFloat(String(gstRate)),
        cgstRate: cgstRate ? parseFloat(String(cgstRate)) : 0,
        sgstRate: sgstRate ? parseFloat(String(sgstRate)) : 0,
        igstRate: igstRate ? parseFloat(String(igstRate)) : 0,
        cessRate: cessRate ? parseFloat(String(cessRate)) : 0,
        hsnCode,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
      },
    });

    return NextResponse.json({ success: true, data: taxConfig }, { status: 201 });
  } catch (error) {
    console.error('Create tax config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tax config' },
      { status: 500 }
    );
  }
}
