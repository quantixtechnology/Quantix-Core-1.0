// Indian address helpers — states/UTs list, PIN validation and a canonical
// full-address formatter used across all customer pages.

export const INDIAN_STATES: string[] = [
  // States
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
]

export const isValidPincode = (pin: string | null | undefined): boolean =>
  !!pin && /^[1-9][0-9]{5}$/.test(pin.trim())

export interface AddressParts {
  addressLine1?: string | null
  addressLine2?: string | null
  area?: string | null
  landmark?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
}

// Canonical display lines:
//   Address Line 1 / Line 2 / Area / City / State - PIN / Country
export function formatAddressLines(a: AddressParts): string[] {
  const lines: string[] = []
  if (a.addressLine1?.trim()) lines.push(a.addressLine1.trim())
  if (a.addressLine2?.trim()) lines.push(a.addressLine2.trim())
  if (a.area?.trim()) lines.push(a.area.trim())
  if (a.city?.trim()) lines.push(a.city.trim())
  const statePin = [a.state?.trim(), a.pincode?.trim()].filter(Boolean).join(" - ")
  if (statePin) lines.push(statePin)
  if (a.country?.trim()) lines.push(a.country.trim())
  return lines
}

export const formatFullAddress = (a: AddressParts): string => formatAddressLines(a).join(", ")
