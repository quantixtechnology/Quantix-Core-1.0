import { WORKSPACE_WORKFLOWS, WORKSPACE_UI, WORKFLOW_CONFIGS as WORKFLOW_CONFIG_LIST } from "@/stores/admin-store"

export type { WorkspaceType } from "@/lib/core/types"

export type WorkspaceNavSection = {
  label: string
  items: { key: string; label: string; icon: string; flag?: string }[]
}

const WORKSPACE_EXCLUDED_PAGES: Record<string, string[]> = {
  LAUNDRY: ["products", "inventory", "product-import", "purchase-orders", "categories"],
}

export function resolveWorkspaceWorkflows(workspaceType: string): string[] {
  return WORKSPACE_WORKFLOWS[workspaceType] ?? ["ECOMMERCE"]
}

export function resolveWorkspaceUI(workspaceType: string) {
  return WORKSPACE_UI[workspaceType] ?? WORKSPACE_UI["ECOMMERCE"]
}

export function isWorkspace(workspaceType: string, target: string): boolean {
  return workspaceType === target
}

export function getExcludedPageKeys(workspaceType: string): string[] {
  return WORKSPACE_EXCLUDED_PAGES[workspaceType] ?? []
}

export function getWorkspaceWorkflowConfigs(workspaceType: string) {
  const workflows = resolveWorkspaceWorkflows(workspaceType)
  return WORKFLOW_CONFIG_LIST.filter((wc) => workflows.includes(wc.type))
}

export function getWorkspacePlanTier(workspaceType: string): "STANDARD" | "PRO" {
  if (["LAUNDRY", "CAR_WASH", "BIKE_WASH", "SALON"].includes(workspaceType)) {
    return "PRO"
  }
  return "STANDARD"
}
