import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ensureNavigationConfig, defaultNavigationConfig, screenDisplayName, screenIcon } from "@/lib/laundry-nav-config"
import { SCREEN_MODULES } from "@/lib/laundry-rbac-registry"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawId = searchParams.get("businessId")
  if (!rawId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  const biz = await resolveLaundryBusiness(rawId)
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const ctx = await getLaundryAuthContext(biz.id, request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const action = searchParams.get("action")

  if (action === "available-screens") {
    const screens: { screenKey: string; displayName: string }[] = []
    for (const m of SCREEN_MODULES) {
      if (m.key === "customer_app") continue
      for (const s of m.screens) {
        screens.push({ screenKey: `${m.key}.${s.key}`, displayName: s.label })
      }
    }
    const extras = [
      { screenKey: "new-order", displayName: "New Order" },
      { screenKey: "garment-lookup", displayName: "Garment Lookup" },
      { screenKey: "dispatch-center", displayName: "Dispatch Center" },
      { screenKey: "pickup-scheduler", displayName: "Pickup Scheduler" },
      { screenKey: "delivery-assignments", displayName: "Delivery Assignments" },
      { screenKey: "pickup-bags", displayName: "Assign Bags" },
      { screenKey: "bag-management", displayName: "Bag Management" },
      { screenKey: "delivery-executives", displayName: "Delivery Executives" },
      { screenKey: "mobile-apps", displayName: "Mobile Apps" },
      { screenKey: "roles", displayName: "Roles & Permissions" },
      { screenKey: "order-detail", displayName: "Order Detail" },
      { screenKey: "audit-barcode", displayName: "Barcode Generation" },
    ]
    screens.push(...extras)
    return NextResponse.json({ data: screens })
  }

  await ensureNavigationConfig(biz.id)

  const nav = await db.laundryNavigation.findUnique({
    where: { businessId: biz.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  })

  if (!nav) return NextResponse.json({ error: "Navigation not found" }, { status: 404 })

  return NextResponse.json({ data: nav })
}

export async function PUT(request: Request) {
  const body = await request.json()
  const { businessId: rawId, sections } = body
  if (!rawId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  if (!Array.isArray(sections)) return NextResponse.json({ error: "sections array required" }, { status: 400 })

  const biz = await resolveLaundryBusiness(rawId)
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })
  const businessId = biz.id

  const ctx = await getLaundryAuthContext(businessId, request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const canEdit = ctx.role === "owner" || ctx.role === "super_admin"
  if (!canEdit) {
    return NextResponse.json({ error: "Only Business Owner or Super Admin can modify navigation" }, { status: 403 })
  }

  await ensureNavigationConfig(businessId)

  const existing = await db.laundryNavigation.findUnique({
    where: { businessId },
    include: { sections: { include: { items: true } } },
  })
  if (!existing) return NextResponse.json({ error: "Navigation not found" }, { status: 404 })

  const existingSectionIds = new Set(existing.sections.map((s) => s.id))
  const incomingSectionIds = new Set(sections.filter((s: any) => s.id?.startsWith?.("cl")).map((s: any) => s.id))

  const toDelete = [...existingSectionIds].filter((id) => !incomingSectionIds.has(id))

  await db.$transaction(async (tx) => {
    // Move items from deleted sections to the first remaining section (or keep them)
    if (toDelete.length > 0) {
      const deletedItems = await tx.laundryNavItem.findMany({ where: { sectionId: { in: toDelete } } })
      if (deletedItems.length > 0) {
        const targetId = incomingSectionIds.values().next().value
        if (targetId) {
          await tx.laundryNavItem.updateMany({
            where: { sectionId: { in: toDelete } },
            data: { sectionId: targetId },
          })
        } else {
          await tx.laundryNavItem.deleteMany({ where: { sectionId: { in: toDelete } } })
        }
      }
      await tx.laundryNavSection.deleteMany({ where: { id: { in: toDelete } } })
    }

    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si]
      if (sec.id?.startsWith?.("cl")) {
        await tx.laundryNavSection.update({
          where: { id: sec.id },
          data: {
            name: sec.name,
            icon: sec.icon ?? null,
            description: sec.description ?? null,
            order: si,
            expanded: sec.expanded ?? true,
            collapsible: sec.collapsible ?? true,
            active: sec.active ?? true,
          },
        })
        await tx.laundryNavItem.deleteMany({ where: { sectionId: sec.id } })
      } else {
        const created = await tx.laundryNavSection.create({
          data: {
            navigationId: existing.id,
            name: sec.name,
            icon: sec.icon ?? null,
            description: sec.description ?? null,
            order: si,
            expanded: sec.expanded ?? true,
            collapsible: sec.collapsible ?? true,
            active: sec.active ?? true,
          },
        })
        sec.id = created.id
      }

      if (Array.isArray(sec.items)) {
        for (let ii = 0; ii < sec.items.length; ii++) {
          const item = sec.items[ii]
          await tx.laundryNavItem.create({
            data: {
              navigationId: existing.id,
              sectionId: sec.id,
              screenKey: item.screenKey,
              displayName: item.displayName ?? screenDisplayName(item.screenKey),
              icon: item.icon ?? screenIcon(item.screenKey),
              order: ii,
              active: item.active ?? true,
              hidden: item.hidden ?? false,
              badge: item.badge ?? null,
              comingSoon: item.comingSoon ?? false,
              pinned: item.pinned ?? false,
              description: item.description ?? null,
            },
          })
        }
      }
    }
  })

  const updated = await db.laundryNavigation.findUnique({
    where: { businessId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  })

  return NextResponse.json({ data: updated })
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawId = searchParams.get("businessId")
  if (!rawId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  const biz = await resolveLaundryBusiness(rawId)
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })
  const businessId = biz.id

  const action = searchParams.get("action")

  const ctx = await getLaundryAuthContext(businessId, request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  if (action === "restore-default") {
    if (ctx.role !== "owner" && ctx.role !== "super_admin") {
      return NextResponse.json({ error: "Only Business Owner or Super Admin can restore defaults" }, { status: 403 })
    }

    const existing = await db.laundryNavigation.findUnique({
      where: { businessId },
      include: { sections: { include: { items: true } } },
    })

    await db.$transaction(async (tx) => {
      if (existing) {
        for (const sec of existing.sections) {
          await tx.laundryNavItem.deleteMany({ where: { sectionId: sec.id } })
        }
        await tx.laundryNavSection.deleteMany({ where: { navigationId: existing.id } })
        await tx.laundryNavigation.delete({ where: { id: existing.id } })
      }

      const defaults = defaultNavigationConfig()
      const nav = await tx.laundryNavigation.create({ data: { businessId } })

      for (let si = 0; si < defaults.length; si++) {
        const sec = defaults[si]
        const section = await tx.laundryNavSection.create({
          data: {
            navigationId: nav.id,
            name: sec.name,
            icon: sec.icon,
            description: sec.description ?? null,
            order: si,
            expanded: sec.expanded,
            collapsible: sec.collapsible,
            active: sec.active,
          },
        })

        await tx.laundryNavItem.createMany({
          data: sec.items.map((item, ii) => ({
            navigationId: nav.id,
            sectionId: section.id,
            screenKey: item.screenKey,
            displayName: item.displayName ?? screenDisplayName(item.screenKey),
            icon: item.icon ?? screenIcon(item.screenKey),
            order: ii,
            active: true,
            hidden: item.hidden ?? false,
            badge: item.badge ?? null,
            comingSoon: item.comingSoon ?? false,
          })),
        })
      }
    })

    const restored = await db.laundryNavigation.findUnique({
      where: { businessId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { items: { orderBy: { order: "asc" } } },
        },
      },
    })

    return NextResponse.json({ data: restored })
  }

  await ensureNavigationConfig(businessId)
  const nav = await db.laundryNavigation.findUnique({
    where: { businessId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  })
  return NextResponse.json({ data: nav })
}
