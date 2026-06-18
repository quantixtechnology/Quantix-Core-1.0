export const LAUNDRY_STATUS_FLOW: string[] = [
  "PICKUP_REQUESTED",
  "PICKUP_ASSIGNED",
  "PICKED_UP",
  "RECEIVED_AT_STORE",
  "IN_TRANSIT_TO_PROCESSING",
  "RECEIVED_AT_PROCESSING",
  "WASHING",
  "DRYING",
  "IRONING",
  "QUALITY_CHECK",
  "PACKED",
  "RETURNED_TO_STORE",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
]

export const LAUNDRY_CANCELLABLE_FROM = [
  "PICKUP_REQUESTED",
  "PICKUP_ASSIGNED",
]

export function canTransitionToLaundryStatus(
  currentStatus: string,
  nextStatus: string,
): boolean {
  const currentIndex = LAUNDRY_STATUS_FLOW.indexOf(currentStatus)
  const nextIndex = LAUNDRY_STATUS_FLOW.indexOf(nextStatus)
  if (currentIndex === -1 || nextIndex === -1) return false
  return nextIndex === currentIndex + 1
}

export function getNextLaundryStatus(currentStatus: string): string | null {
  const currentIndex = LAUNDRY_STATUS_FLOW.indexOf(currentStatus)
  if (currentIndex === -1 || currentIndex >= LAUNDRY_STATUS_FLOW.length - 1) return null
  return LAUNDRY_STATUS_FLOW[currentIndex + 1]
}

export function getLaundryStatusPercent(status: string): number {
  const index = LAUNDRY_STATUS_FLOW.indexOf(status)
  if (index === -1) return 0
  return Math.round((index / (LAUNDRY_STATUS_FLOW.length - 1)) * 100)
}
