"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "../shared/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, ExternalLink, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"

interface Workspace {
  id: string
  businessId: string
  productCode: string
  workspaceUrl: string
  currentVersion: string
  status: string
  storageAllocatedMB: number
  storageUsedMB: number
  subscriptionPlan?: string
  websiteStatus: string
  websiteDomain?: string
  featuresEnabled: number
  healthStatus: string
  updatedAt: string
}

interface PaginationData {
  total: number
  page: number
  limit: number
  pages: number
}

export function WorkspacesView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  useEffect(() => {
    loadWorkspaces()
  }, [page, statusFilter])

  async function loadWorkspaces() {
    setLoading(true)
    try {
      let url = `/api/admin/workspaces?page=${page}&limit=50`
      if (statusFilter) url += `&status=${statusFilter}`

      const res = await authFetch(url)
      const json = await res.json()
      if (json.success) {
        setWorkspaces(json.data)
        setPagination(json.pagination)
      } else {
        toast.error('Failed to load workspaces')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading workspaces')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PROVISIONING: 'bg-blue-100 text-blue-800',
      RUNNING: 'bg-green-100 text-green-800',
      MAINTENANCE: 'bg-yellow-100 text-yellow-800',
      SUSPENDED: 'bg-orange-100 text-orange-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'WARNING':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'OFFLINE':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const formatStorage = (usedMB: number, allocatedMB: number) => {
    const usedGB = (usedMB / 1024).toFixed(1)
    const allocatedGB = (allocatedMB / 1024).toFixed(0)
    const percent = ((usedMB / allocatedMB) * 100).toFixed(0)
    return `${usedGB}/${allocatedGB} GB (${percent}%)`
  }

  const getWebsiteStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-blue-100 text-blue-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Workspace Registry"
        description="Super Admin view of all customer workspaces"
      />

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">Filter by Status:</label>
        <Select value={statusFilter || ''} onValueChange={(v) => {
          setStatusFilter(v || null)
          setPage(1)
        }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            <SelectItem value="PROVISIONING">Provisioning</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Workspaces Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No workspaces found.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Storage Used</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell className="font-semibold">{workspace.businessId}</TableCell>
                    <TableCell className="font-mono text-sm">{workspace.productCode}</TableCell>
                    <TableCell className="text-sm">{workspace.currentVersion}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(workspace.status)}
                      >
                        {workspace.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatStorage(workspace.storageUsedMB, workspace.storageAllocatedMB)}
                    </TableCell>
                    <TableCell className="text-sm">{workspace.subscriptionPlan || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getHealthIcon(workspace.healthStatus)}
                        <span className="text-xs">{workspace.healthStatus}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="secondary"
                          className={getWebsiteStatusColor(workspace.websiteStatus)}
                        >
                          {workspace.websiteStatus}
                        </Badge>
                        {workspace.websiteDomain && (
                          <span className="text-xs text-muted-foreground">{workspace.websiteDomain}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{workspace.featuresEnabled}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(workspace.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`https://${workspace.workspaceUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="gap-2 flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-2 text-sm">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
