"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Wallet } from "lucide-react"

export function HrmsPayslipView() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payslip</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate and manage monthly payslips for all employees.</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Wallet className="h-8 w-8 text-muted-foreground opacity-60" />
          </div>
          <div className="text-center space-y-1.5">
            <CardTitle className="text-lg">Payslip Module — Coming Soon</CardTitle>
            <CardDescription className="max-w-sm">
              This module will support structured earnings and deductions (Basic, HRA, Allowances, PF, PT, TDS),
              CTC-based salary breakdowns, and exportable payslips in PDF format.
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2 text-sm text-muted-foreground w-full max-w-sm">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Earnings</p>
              <p className="text-xs">Basic Salary</p>
              <p className="text-xs">HRA</p>
              <p className="text-xs">Conveyance Allowance</p>
              <p className="text-xs">Special Allowance</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Deductions</p>
              <p className="text-xs">Provident Fund</p>
              <p className="text-xs">Professional Tax</p>
              <p className="text-xs">TDS / Income Tax</p>
              <p className="text-xs">Other Deductions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
