// Website Management validation utilities

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// URL validation
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Phone number validation (basic - accepts common formats)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 7
}

// Hex color validation
export const isValidColor = (color: string): boolean => {
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  return colorRegex.test(color)
}

// Rating validation (1-5)
export const isValidRating = (rating: number): boolean => {
  return rating >= 1 && rating <= 5 && Number.isInteger(rating)
}

// Display order validation
export const isValidDisplayOrder = (order: unknown): boolean => {
  return typeof order === "number" && order >= 0 && Number.isInteger(order)
}

// Validate general website settings
export const validateWebsiteGeneral = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (data.websiteUrl && !isValidUrl(data.websiteUrl)) {
    errors.push({ field: "websiteUrl", message: "Invalid URL format" })
  }

  if (data.companyEmail && !isValidEmail(data.companyEmail)) {
    errors.push({ field: "companyEmail", message: "Invalid email format" })
  }

  if (data.supportEmail && !isValidEmail(data.supportEmail)) {
    errors.push({ field: "supportEmail", message: "Invalid email format" })
  }

  if (data.salesPhone && !isValidPhone(data.salesPhone)) {
    errors.push({ field: "salesPhone", message: "Invalid phone format" })
  }

  if (data.supportPhone && !isValidPhone(data.supportPhone)) {
    errors.push({ field: "supportPhone", message: "Invalid phone format" })
  }

  if (data.websiteStatus && !["ACTIVE", "MAINTENANCE"].includes(data.websiteStatus)) {
    errors.push({ field: "websiteStatus", message: "Invalid status value" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate homepage
export const validateWebsiteHomepage = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (data.primaryBtnUrl && !isValidUrl(data.primaryBtnUrl)) {
    errors.push({ field: "primaryBtnUrl", message: "Invalid URL format" })
  }

  if (data.secondaryBtnUrl && !isValidUrl(data.secondaryBtnUrl)) {
    errors.push({ field: "secondaryBtnUrl", message: "Invalid URL format" })
  }

  if (data.displayOrder !== undefined && !isValidDisplayOrder(data.displayOrder)) {
    errors.push({ field: "displayOrder", message: "Display order must be a non-negative integer" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate communication
export const validateWebsiteCommunication = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (data.whatsappNumber && !isValidPhone(data.whatsappNumber)) {
    errors.push({ field: "whatsappNumber", message: "Invalid phone format" })
  }

  if (data.salesPhone && !isValidPhone(data.salesPhone)) {
    errors.push({ field: "salesPhone", message: "Invalid phone format" })
  }

  if (data.supportPhone && !isValidPhone(data.supportPhone)) {
    errors.push({ field: "supportPhone", message: "Invalid phone format" })
  }

  if (data.salesEmail && !isValidEmail(data.salesEmail)) {
    errors.push({ field: "salesEmail", message: "Invalid email format" })
  }

  if (data.supportEmail && !isValidEmail(data.supportEmail)) {
    errors.push({ field: "supportEmail", message: "Invalid email format" })
  }

  if (data.contactFormRecipient && !isValidEmail(data.contactFormRecipient)) {
    errors.push({ field: "contactFormRecipient", message: "Invalid email format" })
  }

  if (data.whatsappBtnPosition && !["bottom-left", "bottom-right"].includes(data.whatsappBtnPosition)) {
    errors.push({ field: "whatsappBtnPosition", message: "Invalid position value" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate SEO
export const validateWebsiteSEO = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (data.canonicalUrl && !isValidUrl(data.canonicalUrl)) {
    errors.push({ field: "canonicalUrl", message: "Invalid URL format" })
  }

  if (data.openGraphImage && !isValidUrl(data.openGraphImage)) {
    errors.push({ field: "openGraphImage", message: "Invalid URL format" })
  }

  if (data.twitterImage && !isValidUrl(data.twitterImage)) {
    errors.push({ field: "twitterImage", message: "Invalid URL format" })
  }

  if (data.robotsTxt && !["index, follow", "noindex, nofollow", "index, nofollow"].includes(data.robotsTxt)) {
    errors.push({ field: "robotsTxt", message: "Invalid robots.txt value" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate theme
export const validateWebsiteTheme = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (data.primaryColor && !isValidColor(data.primaryColor)) {
    errors.push({ field: "primaryColor", message: "Invalid hex color format" })
  }

  if (data.secondaryColor && !isValidColor(data.secondaryColor)) {
    errors.push({ field: "secondaryColor", message: "Invalid hex color format" })
  }

  if (data.accentColor && !isValidColor(data.accentColor)) {
    errors.push({ field: "accentColor", message: "Invalid hex color format" })
  }

  if (data.buttonStyle && !["rounded", "sharp", "pill"].includes(data.buttonStyle)) {
    errors.push({ field: "buttonStyle", message: "Invalid button style" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate feature
export const validateWebsiteFeature = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: "title", message: "Title is required" })
  }

  if (data.title && data.title.length > 200) {
    errors.push({ field: "title", message: "Title must not exceed 200 characters" })
  }

  if (data.displayOrder !== undefined && !isValidDisplayOrder(data.displayOrder)) {
    errors.push({ field: "displayOrder", message: "Display order must be a non-negative integer" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate testimonial
export const validateWebsiteTestimonial = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (!data.customerName || data.customerName.trim().length === 0) {
    errors.push({ field: "customerName", message: "Customer name is required" })
  }

  if (!data.review || data.review.trim().length === 0) {
    errors.push({ field: "review", message: "Review is required" })
  }

  if (data.rating !== undefined && !isValidRating(data.rating)) {
    errors.push({ field: "rating", message: "Rating must be an integer between 1 and 5" })
  }

  if (data.displayOrder !== undefined && !isValidDisplayOrder(data.displayOrder)) {
    errors.push({ field: "displayOrder", message: "Display order must be a non-negative integer" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate FAQ
export const validateWebsiteFAQ = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (!data.question || data.question.trim().length === 0) {
    errors.push({ field: "question", message: "Question is required" })
  }

  if (!data.answer || data.answer.trim().length === 0) {
    errors.push({ field: "answer", message: "Answer is required" })
  }

  if (data.sortOrder !== undefined && !isValidDisplayOrder(data.sortOrder)) {
    errors.push({ field: "sortOrder", message: "Sort order must be a non-negative integer" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Validate navigation
export const validateWebsiteNavigation = (data: any): ValidationResult => {
  const errors: ValidationError[] = []

  if (!data.menuName || data.menuName.trim().length === 0) {
    errors.push({ field: "menuName", message: "Menu name is required" })
  }

  if (!data.url || data.url.trim().length === 0) {
    errors.push({ field: "url", message: "URL is required" })
  }

  if (data.url && !data.url.startsWith("#") && !isValidUrl(data.url)) {
    errors.push({ field: "url", message: "Invalid URL format" })
  }

  if (data.displayOrder !== undefined && !isValidDisplayOrder(data.displayOrder)) {
    errors.push({ field: "displayOrder", message: "Display order must be a non-negative integer" })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
