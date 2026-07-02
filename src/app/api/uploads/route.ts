// ============================================================================
// POST /api/uploads
// File upload handler with validation and storage
// Supports: images, documents
// ============================================================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import crypto from 'crypto'
import { limitBytesForPlan } from '@/lib/laundry-storage'

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || './public/uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/**
 * Upload a file
 */
export async function POST(request: Request) {
  const requestId = crypto.randomBytes(8).toString('hex')
  logger.setContext({ requestId })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const businessId = formData.get('businessId') as string
    const fileType = formData.get('type') as string
    // Optional tenant storage category (customers|garments|audit|invoice|…).
    const category = (formData.get('category') as string) || null

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Business ID required' },
        { status: 400 }
      )
    }

    if (!fileType || !['logo', 'product', 'document'].includes(fileType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type' },
        { status: 400 }
      )
    }

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      )
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Tenant storage limit — block new uploads once the plan quota is reached.
    const limit = limitBytesForPlan((business as { plan?: string | null }).plan)
    if (limit !== null) {
      const agg = await db.fileUpload.aggregate({ where: { businessId, status: 'COMPLETED' }, _sum: { size: true } })
      const used = agg._sum.size || 0
      if (used + file.size > limit) {
        return NextResponse.json(
          { success: false, error: 'Storage limit reached. Upgrade your plan to upload more files.', code: 'STORAGE_LIMIT' },
          { status: 413 }
        )
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex')
    const extension = file.name.split('.').pop() || 'bin'
    const filename = `${businessId}-${fileType}-${timestamp}-${random}.${extension}`

    // Create directory structure
    const uploadDir = join(UPLOAD_ROOT, businessId, fileType)
    await mkdir(uploadDir, { recursive: true })

    // Write file
    const filePath = join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Create upload record
    const uploadRecord = await db.fileUpload.create({
      data: {
        businessId,
        originalName: file.name,
        filename,
        size: file.size,
        mimeType: file.type,
        uploadPath: `/uploads/${businessId}/${fileType}/${filename}`,
        category,
        status: 'COMPLETED',
      },
    })

    logger.info('FILES', `File uploaded: ${filename}`, {
      businessId,
      fileType,
      size: file.size,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: uploadRecord.id,
        filename,
        url: `/uploads/${businessId}/${fileType}/${filename}`,
        size: file.size,
      },
    })
  } catch (error) {
    logger.error('FILES', 'File upload failed', error instanceof Error ? error : new Error(String(error)))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    )
  }
}
