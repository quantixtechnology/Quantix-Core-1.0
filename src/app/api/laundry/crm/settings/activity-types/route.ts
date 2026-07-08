import { makeSimpleConfigCollection } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"
const h = makeSimpleConfigCollection("laundryCrmActivityType")
export const GET = h.GET
export const POST = h.POST
