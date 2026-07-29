export interface RuntimeAuth {
  businessRole: string
  assignedRbacRole: string
  screenLevels: Record<string, number>
  isOwner: boolean
  isLoaded: boolean
  platformRole: string
}

export const UNAUTHORIZED: RuntimeAuth = {
  businessRole: "",
  assignedRbacRole: "",
  screenLevels: {},
  isOwner: false,
  isLoaded: false,
  platformRole: "",
}
