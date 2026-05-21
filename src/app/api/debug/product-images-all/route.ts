// GET /api/debug/product-images-all?slug=arbazchicken
// Full image pipeline report for every product in a business.
// Shows DB value → parsed array → resolved URL → disk existence → status.
// Shared image resolver logic mirrors src/lib/image-url.ts exactly.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

function resolveImageUrl(raw: string): string {
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/uploads/')) return '/api/core/files/' + raw.slice('/uploads/'.length)
  if (raw.startsWith('/api/core/files/')) return raw
  return raw
}

function fileExists(storedUrl: string, uploadsRoot: string): { absolutePath: string; exists: boolean } {
  let rel = storedUrl
  if (rel.startsWith('/uploads/')) rel = rel.slice('/uploads/'.length)
  else if (rel.startsWith('/api/core/files/')) rel = rel.slice('/api/core/files/'.length)

  const abs = resolve(join(uploadsRoot, rel))
  const safe = abs.startsWith(uploadsRoot)
  return { absolutePath: safe ? abs : '(blocked)', exists: safe ? existsSync(abs) : false }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug param required' }, { status: 400 })
  }

  try {
    const business = await db.business.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, businessType: true },
    })

    if (!business) {
      return NextResponse.json({ error: `No business with slug="${slug}"` }, { status: 404 })
    }

    const products = await db.product.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        images: true,
      },
    })

    const uploadsRoot = resolve(join(process.cwd(), 'public', 'uploads'))
    const cwd = process.cwd()

    const report = products.map((p) => {
      let parsedImages: string[] = []
      try {
        const parsed = JSON.parse(p.images || '[]')
        parsedImages = Array.isArray(parsed) ? parsed : []
      } catch {
        parsedImages = []
      }

      const imageDetails = parsedImages.map((rawUrl) => {
        const resolvedUrl  = resolveImageUrl(rawUrl)
        const { absolutePath, exists } = fileExists(rawUrl, uploadsRoot)
        let status: string
        if (!rawUrl) {
          status = 'EMPTY_URL'
        } else if (!exists) {
          status = 'FILE_MISSING_ON_DISK'
        } else if (rawUrl.startsWith('/uploads/')) {
          status = 'OK_RESOLVED_TO_API'
        } else {
          status = 'OK'
        }
        return {
          dbImage:       rawUrl,
          resolvedPath:  resolvedUrl,
          absolutePath,
          existsOnDisk:  exists,
          publicUrl:     resolvedUrl,
          storefrontUrl: resolvedUrl,
          status,
        }
      })

      const firstImage = imageDetails[0]
      const overallStatus =
        parsedImages.length === 0 ? 'NO_IMAGES_IN_DB'
        : imageDetails.every((i) => i.existsOnDisk) ? 'ALL_FILES_PRESENT'
        : imageDetails.some((i) => i.existsOnDisk) ? 'SOME_FILES_MISSING'
        : 'ALL_FILES_MISSING'

      return {
        product:      p.name,
        productId:    p.id,
        productSlug:  p.slug,
        status:       p.status,
        imageCount:   parsedImages.length,
        overallStatus,
        // Quick summary for first image (most important)
        dbImage:      firstImage?.dbImage ?? null,
        resolvedPath: firstImage?.resolvedPath ?? null,
        existsOnDisk: firstImage?.existsOnDisk ?? null,
        publicUrl:    firstImage?.publicUrl ?? null,
        storefrontUrl:firstImage?.storefrontUrl ?? null,
        imageStatus:  firstImage?.status ?? 'NO_IMAGES_IN_DB',
        // Full details for all images
        allImages: imageDetails,
      }
    })

    // Summary counts
    const summary = {
      total:              products.length,
      noImages:           report.filter((r) => r.overallStatus === 'NO_IMAGES_IN_DB').length,
      allFilesPresent:    report.filter((r) => r.overallStatus === 'ALL_FILES_PRESENT').length,
      someFilesMissing:   report.filter((r) => r.overallStatus === 'SOME_FILES_MISSING').length,
      allFilesMissing:    report.filter((r) => r.overallStatus === 'ALL_FILES_MISSING').length,
    }

    return NextResponse.json({
      business: {
        id:   business.id,
        name: business.name,
        slug: business.slug,
        type: business.businessType,
      },
      serverPaths: {
        cwd,
        uploadsRoot,
        note: 'Upload saves to: <cwd>/public/uploads/products/<businessId>/<filename>',
        note2: 'Files route reads from: <uploadsRoot>/<path-after-/uploads/>',
      },
      resolver: {
        rule:    '/uploads/X → /api/core/files/X  (bypasses afterFiles rewrite entirely)',
        example: '/uploads/products/abc/img.jpg → /api/core/files/products/abc/img.jpg',
      },
      summary,
      products: report,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
