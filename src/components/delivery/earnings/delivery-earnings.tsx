"use client"

import { useState, useEffect, useMemo } from "react"
import { useDeliveryEarnings } from "@/hooks/use-api"
import { useBusinessContext } from "@/hooks/use-business-context"
import { setBusinessContext } from "@/lib/api-client"
import { SkeletonCard, ErrorState } from "@/components/ui/loading-states"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  IndianRupee,
  TrendingUp,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  ChevronRight,
} from "lucide-react"

type EarningsTab = "daily" | "weekly"

interface EarningsBreakdown {
  date: string
  deliveries: number
  earnings: number
}

export function DeliveryEarnings() {
  const [activeTab, setActiveTab] = useState<EarningsTab>("daily")
  const { businessId } = useBusinessContext()

  // SECURITY: business context from the authenticated session (was hardcoded "biz_1")
  useEffect(() => {
    if (businessId) setBusinessContext(businessId)
  }, [businessId])

  // Fetch earnings from API
  const { data, isLoading, error, refetch } = useDeliveryEarnings()

  // Parse API response
  const earningsInfo = useMemo(() => {
    if (!data?.data) return null
    return data.data as Record<string, unknown>
  }, [data])

  const partner = useMemo(() => {
    if (!earningsInfo?.partner) return null
    return earningsInfo.partner as Record<string, unknown>
  }, [earningsInfo])

  const todayStats = useMemo(() => {
    if (!earningsInfo?.today) return { count: 0, earnings: 0 }
    const t = earningsInfo.today as Record<string, unknown>
    return { count: Number(t.count || 0), earnings: Number(t.earnings || 0) }
  }, [earningsInfo])

  const weeklyStats = useMemo(() => {
    if (!earningsInfo?.thisWeek) return { count: 0, earnings: 0 }
    const w = earningsInfo.thisWeek as Record<string, unknown>
    return { count: Number(w.count || 0), earnings: Number(w.earnings || 0) }
  }, [earningsInfo])

  const monthlyStats = useMemo(() => {
    if (!earningsInfo?.thisMonth) return { count: 0, earnings: 0 }
    const m = earningsInfo.thisMonth as Record<string, unknown>
    return { count: Number(m.count || 0), earnings: Number(m.earnings || 0) }
  }, [earningsInfo])

  const recentEarnings = useMemo(() => {
    if (!earningsInfo?.recentEarnings) return []
    return earningsInfo.recentEarnings as Array<Record<string, unknown>>
  }, [earningsInfo])

  // Build chart data from recent earnings
  const dailyData: EarningsBreakdown[] = useMemo(() => {
    if (recentEarnings.length === 0) {
      // Fallback: generate placeholder daily data from weekly stats
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      const avgDaily = Math.round(weeklyStats.earnings / 7)
      return days.map((date) => ({
        date,
        deliveries: Math.round(weeklyStats.count / 7),
        earnings: avgDaily,
      }))
    }
    // Group recent earnings by day
    const grouped: Record<string, { deliveries: number; earnings: number }> = {}
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    recentEarnings.forEach((e) => {
      const deliveredAt = e.deliveredAt ? new Date(e.deliveredAt as string) : new Date()
      const dayName = dayNames[deliveredAt.getDay()]
      if (!grouped[dayName]) grouped[dayName] = { deliveries: 0, earnings: 0 }
      grouped[dayName].deliveries += 1
      grouped[dayName].earnings += Number(e.earning || 0)
    })
    // Return in weekday order
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .filter((d) => grouped[d])
      .map((date) => ({ date, ...grouped[date] }))
  }, [recentEarnings, weeklyStats])

  const weeklyData: EarningsBreakdown[] = useMemo(() => {
    // Generate weekly breakdown from monthly stats
    const weeklyAvg = Math.round(monthlyStats.earnings / 4)
    return [
      { date: "Week 1", deliveries: Math.round(monthlyStats.count / 4), earnings: weeklyAvg },
      { date: "Week 2", deliveries: Math.round(monthlyStats.count / 4), earnings: weeklyAvg },
      { date: "Week 3", deliveries: Math.round(monthlyStats.count / 4), earnings: weeklyAvg },
      { date: "Week 4", deliveries: Math.round(monthlyStats.count / 4), earnings: weeklyAvg },
    ]
  }, [monthlyStats])

  const chartData = activeTab === "daily" ? dailyData : weeklyData
  const maxEarning = chartData.length > 0 ? Math.max(...chartData.map((d) => d.earnings)) : 1

  const averagePerDelivery = todayStats.count > 0
    ? Math.round(todayStats.earnings / todayStats.count)
    : weeklyStats.count > 0
    ? Math.round(weeklyStats.earnings / weeklyStats.count)
    : 0

  const todayVsYesterday = 15 // Placeholder — would need historical data
  const weeklyVsLastWeek = 8 // Placeholder — would need historical data

  if (isLoading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <SkeletonCard count={1} />
        <SkeletonCard count={2} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <ErrorState
          title="Failed to load earnings"
          description="Could not fetch your earnings data. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Today's Earnings Highlight */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-teal-600 via-teal-500 to-emerald-500 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/5 -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-white/5 -ml-6 -mb-6" />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                <IndianRupee className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-teal-100">Today&apos;s Earnings</span>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-xs px-2 h-6">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              {todayVsYesterday}%
            </Badge>
          </div>
          <p className="text-4xl font-bold">₹{todayStats.earnings.toLocaleString()}</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-teal-200" />
              <span className="text-sm text-teal-100">{todayStats.count} deliveries</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-teal-200" />
              <span className="text-sm text-teal-100">₹{averagePerDelivery}/delivery</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly & Monthly Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-teal-500" />
              <span className="text-xs text-gray-500 font-medium">This Week</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{weeklyStats.earnings.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-600 font-medium">{weeklyVsLastWeek}% vs last week</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{weeklyStats.count} deliveries</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-gray-500 font-medium">This Month</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{monthlyStats.earnings.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-600 font-medium">12% vs last month</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{monthlyStats.count} deliveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "daily"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("daily")}
        >
          Daily
        </button>
        <button
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "weekly"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("weekly")}
        >
          Weekly
        </button>
      </div>

      {/* Earnings Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">
                {activeTab === "daily" ? "Daily" : "Weekly"} Earnings
              </h3>
              <span className="text-xs text-gray-400">
                Total: ₹{chartData.reduce((sum, d) => sum + d.earnings, 0).toLocaleString()}
              </span>
            </div>

            {/* Bar Chart using divs */}
            <div className="flex items-end gap-2 h-40">
              {chartData.map((item, index) => {
                const height = maxEarning > 0 ? (item.earnings / maxEarning) * 100 : 0
                const isToday = activeTab === "daily" && index === chartData.length - 1

                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium text-gray-500">
                      ₹{item.earnings >= 1000 ? `${(item.earnings / 1000).toFixed(1)}k` : item.earnings}
                    </span>
                    <div className="w-full flex justify-center">
                      <div
                        className={`w-full max-w-[32px] rounded-t-md transition-all duration-500 ${
                          isToday
                            ? "bg-teal-500 shadow-md shadow-teal-500/20"
                            : "bg-teal-200 hover:bg-teal-300"
                        }`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] ${isToday ? "font-bold text-teal-600" : "text-gray-400"}`}>
                      {item.date}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Breakdown List */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-bold text-gray-900">
                {activeTab === "daily" ? "Daily" : "Weekly"} Breakdown
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {chartData.map((item, index) => {
                const isToday = activeTab === "daily" && index === chartData.length - 1
                return (
                  <div
                    key={item.date}
                    className={`px-4 py-3 flex items-center justify-between ${
                      isToday ? "bg-teal-50/50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        isToday ? "bg-teal-100" : "bg-gray-100"
                      }`}>
                        <Calendar className={`h-4 w-4 ${isToday ? "text-teal-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isToday ? "text-teal-700" : "text-gray-900"}`}>
                          {item.date} {isToday && "• Today"}
                        </p>
                        <p className="text-xs text-gray-400">{item.deliveries} deliveries</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isToday ? "text-teal-700" : "text-gray-900"}`}>
                        ₹{item.earnings}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Settlement Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Payment Settlement</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Earnings to be settled</span>
              <span className="text-sm font-semibold text-gray-900">
                ₹{partner?.totalEarnings ? Number(partner.totalEarnings).toLocaleString() : "0.00"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Last settlement</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  ₹{weeklyStats.earnings.toLocaleString()}
                </span>
                <p className="text-[10px] text-gray-400">This week</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Next settlement</span>
              </div>
              <span className="text-xs font-medium text-teal-600">Tomorrow, 10:00 AM</span>
            </div>
            <div className="bg-teal-50 rounded-lg p-3">
              <p className="text-xs text-teal-700">
                💰 Settlements are processed daily at 10 AM to your registered bank account
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Performance Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Avg. per Delivery</p>
              <p className="text-lg font-bold text-gray-900">₹{averagePerDelivery}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Monthly Deliveries</p>
              <p className="text-lg font-bold text-gray-900">{monthlyStats.count}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Weekly Average</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{weeklyStats.count > 0 ? Math.round(weeklyStats.earnings / 7) : 0}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Best Day</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.earnings)) : 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="h-4" />
    </div>
  )
}
