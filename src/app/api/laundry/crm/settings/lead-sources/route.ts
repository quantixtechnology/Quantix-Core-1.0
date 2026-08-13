import { makeSimpleConfigCollection } from "@/lib/laundry-crm-settings"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"
const h = makeSimpleConfigCollection("laundryCrmLeadSource", true)
export const GET = h.GET
export const POST = h.POST
