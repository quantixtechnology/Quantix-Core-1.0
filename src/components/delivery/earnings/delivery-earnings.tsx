"use client"

import { useState } from "react"
import { earningsData } from "@/components/delivery/data"
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

export function DeliveryEarnings() {
  const [activeTab, setActiveTab] = useState<EarningsTab>("daily")

  const dailyData = earningsData.dailyBreakdown
  const weeklyData = earningsData.weeklyBreakdown
  const chartData = activeTab === "daily" ? dailyData : weeklyData
  const maxEarning = Math.max(...chartData.map((d) => d.earnings))

  const todayVsYesterday = 15 // % increase mock
  const weeklyVsLastWeek = 8 // % increase mock

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
          <p className="text-4xl font-bold">₹{earningsData.todayEarnings}</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-teal-200" />
              <span className="text-sm text-teal-100">{earningsData.todayDeliveries} deliveries</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-teal-200" />
              <span className="text-sm text-teal-100">₹{earningsData.averagePerDelivery}/delivery</span>
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
            <p className="text-xl font-bold text-gray-900">₹{earningsData.weeklyEarnings}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-600 font-medium">{weeklyVsLastWeek}% vs last week</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{earningsData.weeklyDeliveries} deliveries</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-gray-500 font-medium">This Month</span>
            </div>
            <p className="text-xl font-bold text-gray-900">₹{earningsData.monthlyEarnings.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-600 font-medium">12% vs last month</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{earningsData.monthlyDeliveries} deliveries</p>
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
              const isToday = activeTab === "daily" && index === 3 // Thursday as "today"

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

      {/* Daily Breakdown List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold text-gray-900">
              {activeTab === "daily" ? "Daily" : "Weekly"} Breakdown
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {chartData.map((item, index) => {
              const isToday = activeTab === "daily" && index === 3
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
              <span className="text-sm font-semibold text-gray-900">₹1,245.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Last settlement</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">₹2,180.00</span>
                <p className="text-[10px] text-gray-400">Jan 14, 2025</p>
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
              <p className="text-lg font-bold text-gray-900">₹{earningsData.averagePerDelivery}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Monthly Deliveries</p>
              <p className="text-lg font-bold text-gray-900">{earningsData.monthlyDeliveries}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Weekly Average</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{Math.round(earningsData.weeklyEarnings / 7)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Best Day</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{Math.max(...dailyData.map((d) => d.earnings))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="h-4" />
    </div>
  )
}
