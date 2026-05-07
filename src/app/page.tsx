'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroceryStore } from '@/components/grocery/grocery-store';
import { PosTerminal } from '@/components/grocery/pos-terminal';
import { AdminDashboard } from '@/components/grocery/admin-dashboard';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Main Tabs */}
      <Tabs defaultValue="grocery" className="flex flex-col flex-1">
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <TabsList className="w-full sm:w-auto h-12 bg-transparent p-0 gap-0">
              <TabsTrigger
                value="grocery"
                className="flex-1 sm:flex-none px-4 sm:px-6 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium data-[state=active]:text-emerald-700"
              >
                🏪 Grocery Store
              </TabsTrigger>
              <TabsTrigger
                value="pos"
                className="flex-1 sm:flex-none px-4 sm:px-6 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium data-[state=active]:text-emerald-700"
              >
                💳 POS Terminal
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                className="flex-1 sm:flex-none px-4 sm:px-6 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm font-medium data-[state=active]:text-emerald-700"
              >
                📊 Admin
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="grocery" className="flex-1 m-0 overflow-hidden">
          <GroceryStore />
        </TabsContent>
        <TabsContent value="pos" className="flex-1 m-0 overflow-hidden">
          <PosTerminal />
        </TabsContent>
        <TabsContent value="admin" className="flex-1 m-0 overflow-auto">
          <AdminDashboard />
        </TabsContent>
      </Tabs>

      {/* Sticky Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex-shrink-0 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-[8px]">FM</span>
            </div>
            <span className="text-xs text-slate-500">
              © 2025 FreshMart Grocery · Fresh to Your Doorstep
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span>freshmart.in</span>
            <span>·</span>
            <span>Mumbai, Maharashtra</span>
            <span>·</span>
            <span>GSTIN: 27AABCF1234A1Z5</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
