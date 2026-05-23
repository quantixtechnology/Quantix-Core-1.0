// Shared utility for order stage labels across all UI surfaces.
// Single source of truth: stages come from Business.settings.orderStageConfig
// or fall back to DEFAULT_STAGES per businessType.

export interface OrderStage {
  status: string
  label: string
  order: number
}

export const DEFAULT_STAGES: Record<string, OrderStage[]> = {
  GROCERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Packing',          order: 3 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 4 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 5 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 6 },
  ],
  FOOD_DELIVERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Preparing',        order: 3 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 4 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 5 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 6 },
  ],
  MEAT_DELIVERY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Cleaning',         order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Packing',          order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  CAR_WASH: [
    { status: 'PENDING',   label: 'Booked',      order: 1 },
    { status: 'CONFIRMED', label: 'Assigned',    order: 2 },
    { status: 'PREPARING', label: 'In Progress', order: 3 },
    { status: 'DELIVERED', label: 'Completed',   order: 4 },
    { status: 'CANCELLED', label: 'Cancelled',   order: 5 },
  ],
  LAUNDRY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Received',         order: 2 },
    { status: 'PREPARING',        label: 'Washing',          order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Ready',            order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  PHARMACY: [
    { status: 'PENDING',          label: 'Pending',          order: 1 },
    { status: 'CONFIRMED',        label: 'Accepted',         order: 2 },
    { status: 'PREPARING',        label: 'Dispensing',       order: 3 },
    { status: 'READY_FOR_PICKUP', label: 'Ready',            order: 4 },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', order: 5 },
    { status: 'DELIVERED',        label: 'Delivered',        order: 6 },
    { status: 'CANCELLED',        label: 'Cancelled',        order: 7 },
  ],
  HOME_SERVICES: [
    { status: 'PENDING',   label: 'Booked',      order: 1 },
    { status: 'CONFIRMED', label: 'Assigned',    order: 2 },
    { status: 'PREPARING', label: 'In Progress', order: 3 },
    { status: 'DELIVERED', label: 'Completed',   order: 4 },
    { status: 'CANCELLED', label: 'Cancelled',   order: 5 },
  ],
}

export const ECOMMERCE_DEFAULT: OrderStage[] = [
  { status: 'PENDING',          label: 'Pending',    order: 1 },
  { status: 'CONFIRMED',        label: 'Confirmed',  order: 2 },
  { status: 'PREPARING',        label: 'Processing', order: 3 },
  { status: 'OUT_FOR_DELIVERY', label: 'Shipped',    order: 4 },
  { status: 'DELIVERED',        label: 'Delivered',  order: 5 },
  { status: 'CANCELLED',        label: 'Cancelled',  order: 6 },
]

export function getDefaultStages(businessType: string): OrderStage[] {
  return DEFAULT_STAGES[businessType] ?? ECOMMERCE_DEFAULT
}

export function buildLabelMap(stages: OrderStage[]): Record<string, string> {
  return Object.fromEntries(stages.map((s) => [s.status, s.label]))
}

export function getLabel(status: string, labelMap: Record<string, string>): string {
  return labelMap[status] ?? status.replace(/_/g, ' ')
}
