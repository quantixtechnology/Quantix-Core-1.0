import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformRole, isLaundryRole } from "@/lib/permissions"

export type LaundryAuthContext = {
  userId: string
  userName: string
  userEmail: string
  laundryBusinessId: string
  platformBusinessId: string | null
  role: string
  isSupportMode: boolean
  supportAdminName?: string
}

/**
 * Get the effective Laundry OS auth context from the current session.
 *
 * Two modes:
 *   1. Direct login — user has a BusinessUser with a Laundry role
 *   2. Support mode — platform admin accessing via support session
 *
 * Returns null if the user is not authorized for Laundry OS.
 */
export async function getLaundryAuthContext(laundryBusinessId: string): Promise<LaundryAuthContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const role = session.user.role
  const userId = session.user.id
  const userEmail = session.user.email || ""
  const userName = session.user.name || ""

  // Mode 1: Direct login — user has BusinessUser for this laundry business
  if (isLaundryRole(role)) {
    const laundryBusiness = await prisma.laundryBusiness.findUnique({
      where: { id: laundryBusinessId },
      select: { platformBusinessId: true },
    })
    if (!laundryBusiness) return null

    const businessUser = await prisma.businessUser.findFirst({
      where: {
        userId,
        businessId: laundryBusiness.platformBusinessId || undefined,
        isActive: true,
      },
      select: { role: true },
    })
    if (businessUser) {
      return {
        userId,
        userName,
        userEmail,
        laundryBusinessId,
        platformBusinessId: laundryBusiness.platformBusinessId,
        role: businessUser.role,
        isSupportMode: false,
      }
    }
  }

  // Mode 2: Support mode — platform admin
  if (isPlatformRole(role)) {
    // Verify the laundry business exists
    const laundryBusiness = await prisma.laundryBusiness.findUnique({
      where: { id: laundryBusinessId },
      select: { platformBusinessId: true },
    })
    if (!laundryBusiness) return null

    return {
      userId,
      userName,
      userEmail,
      laundryBusinessId,
      platformBusinessId: laundryBusiness.platformBusinessId,
      role,
      isSupportMode: true,
      supportAdminName: userName,
    }
  }

  return null
}
