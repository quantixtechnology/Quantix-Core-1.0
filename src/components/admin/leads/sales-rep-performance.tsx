"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Phone,
  CalendarCheck,
  MonitorPlay,
  TrendingUp,
  IndianRupee,
  Trophy,
  BarChart3,
} from "lucide-react"
import { salesRepMetrics } from "./crm-data"

type Period = "week" | "month" | "quarter"

export function SalesRepPerformance() {
  const [period, setPeriod] = useState<Period>("month")

  const maxRevenue = Math.max(...salesRepMetrics.map((r) => r.revenueGenerated))
  const maxCalls = Math.max(...salesRepMetrics.map((r) => r.callsMade))

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Sales Rep Performance
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rep Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {salesRepMetrics.map((rep) => (
          <Card key={rep.repId}>
            <CardContent className="p-4 space-y-3">
              {/* Rep Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-bold">
                  {rep.repName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{rep.repName}</p>
                  <p className="text-[11px] text-muted-foreground">{rep.leadsAssigned} leads assigned</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">₹{(rep.revenueGenerated / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-muted-foreground">revenue</p>
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Conversion Rate</span>
                  <span className="font-semibold">{rep.conversionRate}%</span>
                </div>
                <Progress value={rep.conversionRate} className="h-2" />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetricItem
                  icon={Phone}
                  label="Calls"
                  value={rep.callsMade}
                  color="text-emerald-600"
                />
                <MetricItem
                  icon={CalendarCheck}
                  label="Follow-ups"
                  value={rep.followUpsCompleted}
                  color="text-amber-600"
                />
                <MetricItem
                  icon={MonitorPlay}
                  label="Demos"
                  value={rep.demosShared}
                  color="text-blue-600"
                />
              </div>

              {/* Revenue Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Revenue
                  </span>
                  <span className="font-medium">₹{rep.revenueGenerated.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                    style={{ width: `${(rep.revenueGenerated / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>

              {/* Conversions & Renewals */}
              <div className="flex items-center justify-between pt-1 border-t">
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-muted-foreground">Conversions:</span>
                  <span className="font-medium">{rep.conversions}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {rep.renewalsClosed} renewals
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Rep Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Rep</TableHead>
                  <TableHead className="text-xs text-center">Leads</TableHead>
                  <TableHead className="text-xs text-center">Calls</TableHead>
                  <TableHead className="text-xs text-center">Follow-ups</TableHead>
                  <TableHead className="text-xs text-center">Demos</TableHead>
                  <TableHead className="text-xs text-center">Conv.</TableHead>
                  <TableHead className="text-xs text-center">Rate</TableHead>
                  <TableHead className="text-xs text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesRepMetrics.map((rep) => (
                  <TableRow key={rep.repId}>
                    <TableCell className="text-sm font-medium">{rep.repName}</TableCell>
                    <TableCell className="text-xs text-center">{rep.leadsAssigned}</TableCell>
                    <TableCell className="text-xs text-center">{rep.callsMade}</TableCell>
                    <TableCell className="text-xs text-center">{rep.followUpsCompleted}</TableCell>
                    <TableCell className="text-xs text-center">{rep.demosShared}</TableCell>
                    <TableCell className="text-xs text-center">{rep.conversions}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge
                        variant={rep.conversionRate >= 43 ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {rep.conversionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      ₹{rep.revenueGenerated.toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <Icon className={`h-3.5 w-3.5 mx-auto ${color}`} />
      <p className="text-sm font-semibold mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
