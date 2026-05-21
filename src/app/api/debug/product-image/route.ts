// GET /api/debug/product-image?slug=arbazchicken&product=curry-cut
// Traces the full image pipeline: DB → parsed array → URL → file existence.
// Remove this file after image loading is confirmed working.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug        = searchParams.get('slug')
  const productSlug = searchParams.get('product')   // product slug or partial name

  if (!slug) {
    return NextResponse.json({ error: 'slug param required' }, { status: 400 })
  }

  try {
    // ── Resolve business ──────────────────────────────────────────────────
    const business = await db.business.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    })

    if (!business) {
      return NextResponse.json({ error: `No business with slug="${slug}"` }, { status: 404 })
    }

    // ── Find product ──────────────────────────────────────────────────────
    // Match by slug exact, then by name contains, then first product
    let product = productSlug
      ? await db.product.findFirst({
          where: { businessId: business.id, slug: productSlug },
          select: { id: true, name: true, slug: true, status: true, images: true },
        })
      : null

    if (!product && productSlug) {
      product = await db.product.findFirst({
        where: { businessId: business.id, name: { contains: productSlug } },
        select: { id: true, name: true, slug: true, status: true, images: true },
      })
    }

    if (!product) {
      // Return all products with their raw images field for comparison
      const allProducts = await db.product.findMany({
        where: { businessId: business.id },
        select: { id: true, name: true, slug: true, status: true, images: true },
        take: 20,
      })
      return NextResponse.json({
        error: productSlug
          ? `No product matching "${productSlug}" in business "${slug}"`
          : 'No products found — pass ?product=<slug-or-name>',
        businessId:    business.id,
        businessName:  business.name,
        allProducts: allProducts.map((p) => ({
          id:           p.id,
          name:         p.name,
          slug:         p.slug,
          status:       p.status,
          rawImagesDB:  p.images,
          parsedImages: (() => { try { return JSON.parse(p.images) } catch { return [] } })(),
        })),
      })
    }

    // ── Parse images field ────────────────────────────────────────────────
    // DB stores images as a JSON string: '["url1", "url2"]' or '[]'
    let parsedImages: string[] = []
    try {
      parsedImages = JSON.parse(product.images)
      if (!Array.isArray(parsedImages)) parsedImages = []
    } catch {
      parsedImages = []
    }

    // ── File system check ─────────────────────────────────────────────────
    const uploadsRoot = resolve(join(process.cwd(), 'public', 'uploads'))
    const fileChecks = parsedImages.map((imageUrl) => {
      // imageUrl is typically "/uploads/products/<businessId>/<filename>"
      // Strip leading /uploads/ to get the relative path inside the uploads root
      const pathInUploads = imageUrl.startsWith('/uploads/')
        ? imageUrl.slice('/uploads/'.length)
        : imageUrl

      const absolutePath = resolve(join(uploadsRoot, pathInUploads))
      const safe         = absolutePath.startsWith(uploadsRoot)  // prevent traversal
      const exists       = safe ? existsSync(absolutePath) : false

      return {
        url:          imageUrl,
        pathInUploads,
        absolutePath: safe ? absolutePath : '(blocked — path traversal)',
        exists,
        isRelative:   imageUrl.startsWith('/'),
        isAbsolute:   imageUrl.startsWith('http'),
      }
    })

    const mainImage    = parsedImages[0] || null
    const thumbnail    = parsedImages[0] || null
    const firstExists  = fileChecks[0]?.exists ?? null

    // ── What the storefront renders ───────────────────────────────────────
    // Simulates: const images = Array.isArray(product.images) ? product.images : []
    // Then: <img src={images[0]} />
    // The storefront API returns images already parsed (so images IS the array).
    // storefront-home/category/product all read: Array.isArray(images) ? images : []
    const storefrontApiReturns = parsedImages  // this is what the storefront API sends
    const componentImages      = Array.isArray(storefrontApiReturns) ? storefrontApiReturns : []
    const renderedSrc          = componentImages[0] || null

    console.log('[debug/product-image]', {
      slug,
      productSlug,
      productId:   product.id,
      rawImagesDB: product.images,
      parsedCount: parsedImages.length,
      fileExists:  firstExists,
      renderedSrc,
      cwd:         process.cwd(),
      uploadsRoot,
    })

    return NextResponse.json({
      businessId:    business.id,
      businessName:  business.name,
      productId:     product.id,
      productName:   product.name,
      productSlug:   product.slug,
      productStatus: product.status,

      // Raw DB value (the JSON string stored in the images column)
      rawImagesDB:   product.images,

      // After JSON.parse()
      parsedImages,
      imageCount:    parsedImages.length,

      // What the component renders
      thumbnail,
      mainImage,
      renderedSrc,

      // File system checks (server-side only — confirms file is on disk)
      fileChecks,
      firstFileExists: firstExists,

      // Paths for manual verification
      serverPaths: {
        cwd:         process.cwd(),
        uploadsRoot,
      },

      // Diagnostic flags
      diagnosis: {
        imagesFieldEmpty:    parsedImages.length === 0,
        imagesFieldInvalid:  product.images === '[]' || product.images === '' || product.images === 'null',
        firstUrlIsRelative:  mainImage ? mainImage.startsWith('/') : null,
        firstUrlIsAbsolute:  mainImage ? mainImage.startsWith('http') : null,
        firstFileOnDisk:     firstExists,
        likelyRenderResult:  parsedImages.length === 0
          ? 'SHOWS_EMOJI_FALLBACK'
          : firstExists
            ? 'IMAGE_SHOULD_LOAD'
            : 'IMAGE_404_OR_WRONG_PATH',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
