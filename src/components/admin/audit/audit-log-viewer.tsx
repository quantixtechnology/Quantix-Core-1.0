"use client";

// ============================================================================
// Quantix Core — Audit Log Viewer
// Admin component to view activity logs with filters, pagination, export
// Color-coded action types, expandable detail rows, real-time polling
// ============================================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatCard } from "@/components/admin/shared/stat-card";
import {
  actionTypes,
  entityTypes,
  type AuditLogEntry,
} from "./audit-data";
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Globe,
  Activity,
  Eye,
  X,
  Clock,
  AlertCircle,
  FileText,
  CheckCircle2,
  Trash2,
  LogIn,
  Settings,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { formatIndianDateTime, getRelativeTime } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/admin-fetch";
import { useAuthStore } from "@/stores/auth-store";

// ============================================================================
// Types
// ============================================================================

type SortField = "createdAt" | "userName" | "action" | "entityType";
type SortOrder = "asc" | "desc";

// API audit log shape
interface ApiAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function mapApiAuditLog(api: ApiAuditLog): AuditLogEntry {
  // Parse details if it's a JSON string
  let parsedDetails = api.details || "";
  let parsedMetadata: Record<string, unknown> = {};
  try {
    if (api.details && api.details.startsWith("{")) {
      const parsed = JSON.parse(api.details);
      parsedDetails = parsed.details || parsed.content || api.details;
      parsedMetadata = parsed;
    }
  } catch {
    // Keep original details string
  }

  return {
    id: api.id,
    userId: api.userId,
    userName: api.userName,
    action: api.action,
    entityType: api.entity,
    entityId: api.entityId,
    details: typeof parsedDetails === "string" ? parsedDetails : JSON.stringify(parsedDetails),
    ipAddress: api.ipAddress || "-",
    metadata: parsedMetadata,
    createdAt: api.createdAt,
  };
}

// ============================================================================
// Action icon mapping
// ============================================================================

const actionIconMap: Record<string, typeof Activity> = {
  CREATE: CheckCircle2,
  UPDATE: ArrowRight,
  DELETE: Trash2,
  LOGIN: LogIn,
  LOGOUT: LogIn,
  EXPORT: Download,
  PAYMENT: CreditCard,
  REFUND: AlertCircle,
  STATUS_CHANGE: ArrowRight,
  CONFIG: Settings,
};

// ============================================================================
// Component
// ============================================================================

export function AuditLogViewer() {
  // ---- State ----
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pageSize = 10;
  const { currentBusinessId } = useAuthStore();

  // ---- Fetch audit logs from API ----
  const fetchAuditLogs = useCallback(async () => {
    const businessId = currentBusinessId || (typeof window !== 'undefined' ? localStorage.getItem('quantix_business_id') : null);
    if (!businessId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/core/audit?businessId=${businessId}&limit=50`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped = (json.data as ApiAuditLog[]).map(mapApiAuditLog);
        setAuditLogs(mapped);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setFetchError("Failed to load audit logs");
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // ---- Unique users ----
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    auditLogs.forEach((log) => users.set(log.userId, log.userName));
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [auditLogs]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = auditLogs.length;
    const create = auditLogs.filter((l) => l.action === "CREATE").length;
    const update = auditLogs.filter((l) => l.action === "UPDATE").length;
    const del = auditLogs.filter((l) => l.action === "DELETE").length;
    const login = auditLogs.filter((l) => l.action === "LOGIN").length;
    return { total, create, update, delete: del, login };
  }, [auditLogs]);

  // ---- Filtered & sorted logs ----
  const filteredLogs = useMemo(() => {
    let result = [...auditLogs];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.userName.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.entityType.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.ipAddress.includes(q)
      );
    }

    // Action filter
    if (actionFilter !== "all") {
      result = result.filter((log) => log.action === actionFilter);
    }

    // Entity filter
    if (entityFilter !== "all") {
      result = result.filter((log) => log.entityType === entityFilter);
    }

    // User filter
    if (userFilter !== "all") {
      result = result.filter((log) => log.userId === userFilter);
    }

    // Date range
    if (dateFrom) {
      result = result.filter((log) => new Date(log.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((log) => new Date(log.createdAt) <= to);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "userName":
          cmp = a.userName.localeCompare(b.userName);
          break;
        case "action":
          cmp = a.action.localeCompare(b.action);
          break;
        case "entityType":
          cmp = a.entityType.localeCompare(b.entityType);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [auditLogs, searchQuery, actionFilter, entityFilter, userFilter, dateFrom, dateTo, sortField, sortOrder]);

  // ---- Paginated logs ----
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // ---- Toggle expanded row ----
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---- Get action config ----
  const getActionConfig = useCallback((action: string) => {
    return actionTypes.find((a) => a.value === action) || {
      value: action,
      label: action,
      color: "text-slate-600",
      bgColor: "bg-slate-100",
    };
  }, []);

  // ---- Export to CSV ----
  const handleExportCSV = useCallback(() => {
    const headers = ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Details", "IP Address"];
    const rows = filteredLogs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.userName,
      log.action,
      log.entityType,
      log.entityId,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ipAddress,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  // ---- Refresh ----
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAuditLogs().finally(() => {
      setTimeout(() => setIsRefreshing(false), 500);
    });
  }, [fetchAuditLogs]);

  // ---- Clear filters ----
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setActionFilter("all");
    setEntityFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = actionFilter !== "all" || entityFilter !== "all" || userFilter !== "all" || dateFrom || dateTo || searchQuery;

  // ============================================================================
  // Render
  // ============================================================================

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Audit Log"
          description="Track all platform activities — security, compliance, debugging"
          icon={Shield}
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Audit Log"
          description="Track all platform activities — security, compliance, debugging"
          icon={Shield}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="mt-3 text-sm font-medium">{fetchError}</h3>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Track all platform activities — security, compliance, debugging"
        icon={Shield}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total Events" value={stats.total} icon={Activity} iconColor="text-slate-600" iconBg="bg-slate-50" />
        <StatCard title="Created" value={stats.create} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Updated" value={stats.update} icon={ArrowRight} iconColor="text-sky-600" iconBg="bg-sky-50" />
        <StatCard title="Deleted" value={stats.delete} icon={Trash2} iconColor="text-red-600" iconBg="bg-red-50" />
        <StatCard title="Logins" value={stats.login} icon={LogIn} iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Activity Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {filteredLogs.length} entries
              </Badge>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={clearFilters}>
                  <X className="w-3 h-3" />
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, details..."
                className="pl-8 h-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityTypes.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-[140px] h-9"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              placeholder="From"
            />
            <Input
              type="date"
              className="w-[140px] h-9"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              placeholder="To"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort by:</span>
            {(["createdAt", "userName", "action", "entityType"] as SortField[]).map((field) => (
              <Button
                key={field}
                variant={sortField === field ? "default" : "ghost"}
                size="sm"
                className={`h-7 text-xs px-2 ${sortField === field ? "" : "text-muted-foreground"}`}
                onClick={() => {
                  if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else { setSortField(field); setSortOrder("desc"); }
                }}
              >
                {field === "createdAt" ? "Time" : field === "userName" ? "User" : field === "action" ? "Action" : "Entity"}
                {sortField === field && (sortOrder === "desc" ? " ↓" : " ↑")}
              </Button>
            ))}
          </div>

          <Separator />

          {/* Table */}
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-sm font-medium">No audit logs found</h3>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">User</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead className="w-[100px]">Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => {
                    const actionConfig = getActionConfig(log.action);
                    const ActionIcon = actionIconMap[log.action] || Activity;
                    const isExpanded = expandedRows.has(log.id);

                    return (
                      <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpand(log.id)}>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="w-8">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>
                                <p className="font-medium">{new Date(log.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                                <p className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs font-medium truncate max-w-[80px]">{log.userName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] border-0 font-medium ${actionConfig.bgColor} ${actionConfig.color}`}
                              >
                                <ActionIcon className="w-3 h-3 mr-1" />
                                {actionConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{log.entityType}</span>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs truncate max-w-[300px]">{log.details}</p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Globe className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{log.ipAddress}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={7} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-2">
                                  <p className="font-semibold text-sm">Entry Details</p>
                                  <div className="grid grid-cols-[100px_1fr] gap-y-1">
                                    <span className="text-muted-foreground">Log ID:</span>
                                    <span className="font-mono">{log.id}</span>
                                    <span className="text-muted-foreground">Entity ID:</span>
                                    <span className="font-mono">{log.entityId}</span>
                                    <span className="text-muted-foreground">User ID:</span>
                                    <span className="font-mono">{log.userId}</span>
                                    <span className="text-muted-foreground">Full Time:</span>
                                    <span>{formatIndianDateTime(log.createdAt)}</span>
                                    <span className="text-muted-foreground">Relative:</span>
                                    <span>{getRelativeTime(log.createdAt)}</span>
                                  </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <p className="font-semibold text-sm">Metadata</p>
                                  <div className="rounded-md bg-muted/50 p-3">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} entries
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 ${currentPage === page ? "bg-primary text-primary-foreground" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
