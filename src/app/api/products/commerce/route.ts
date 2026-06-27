// Commerce Product API Router
// Consolidates all Commerce-specific operations

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    product: 'COMMERCE',
    features: [
      'dashboard',
      'orders',
      'products',
      'categories',
      'inventory',
      'customers',
      'pos',
      'billing',
      'payments',
      'delivery',
      'offers',
      'reports',
      'settings',
      'staff',
      'analytics',
    ],
    status: 'READY',
  })
}
