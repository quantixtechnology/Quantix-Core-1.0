export function generateGarmentBarcode(orderNumber: string, itemName: string, sequence: number): string {
  const safeName = itemName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .slice(0, 8)
  const seq = String(sequence).padStart(3, "0")
  return `${orderNumber}-${safeName}-${seq}`
}

export function parseGarmentBarcode(barcode: string): {
  orderNumber: string
  itemName: string
  sequence: number
} | null {
  const parts = barcode.split("-")
  if (parts.length < 3) return null
  const sequence = parseInt(parts[parts.length - 1], 10)
  const itemName = parts[parts.length - 2]
  const orderNumber = parts.slice(0, -2).join("-")
  if (isNaN(sequence)) return null
  return { orderNumber, itemName, sequence }
}
