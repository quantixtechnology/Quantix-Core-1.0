// Laundry Product Health Check
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'HEALTHY',
    product: 'LAUNDRY',
    version: '1.0.0',
    features: [
      'ORDERS',
      'PROCESSING',
      'DELIVERY',
      'PAYMENTS',
      'REPORTS',
      'STAFF',
    ],
    timestamp: new Date().toISOString(),
  })
}
