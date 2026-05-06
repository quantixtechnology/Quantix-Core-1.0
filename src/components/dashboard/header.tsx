'use client';

import { Bell, Search, ChevronDown, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  currentView: string;
}

const businesses = [
  'All Businesses',
  'FreshMart Groceries',
  'QuickBite Foods',
  'SparkleClean Laundry',
  'AquaShine Car Wash',
  'HomeFix Services',
  'TasteHub Kitchen',
];

export function Header({ onMobileMenuToggle, currentView }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden sm:flex items-center relative">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search orders, products, customers..."
            className="pl-9 w-[300px] lg:w-[400px] h-9 bg-slate-50 border-slate-200 text-sm"
          />
        </div>
      </div>

      {/* Right: Business selector, Notifications, User */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Business Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden md:flex items-center gap-2 border-slate-200">
              <span className="text-xs font-medium">All Businesses</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            {businesses.map((b) => (
              <DropdownMenuItem key={b} className="text-sm">
                {b}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-[18px] w-[18px] text-slate-500" />
          <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] p-0 flex items-center justify-center bg-emerald-600 text-[10px] text-white border-0">
            3
          </Badge>
        </Button>

        {/* User */}
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-medium text-slate-900">Admin User</span>
            <span className="text-[10px] text-slate-500">Super Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
