'use client';

import { Search, Bell, ChevronDown, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { businesses } from './data';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  currentView: string;
  selectedBusiness: string;
  onBusinessChange: (id: string) => void;
}

export function Header({ onMobileMenuToggle, currentView, selectedBusiness, onBusinessChange }: HeaderProps) {
  const activeBiz = businesses.find(b => b.id === selectedBusiness);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onMobileMenuToggle}>
          <Menu className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-slate-900 hidden sm:block">{currentView}</h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Business Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 max-w-[200px]">
              {activeBiz ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="truncate">{activeBiz.name}</span>
                </>
              ) : (
                'Select Business'
              )}
              <ChevronDown className="h-3 w-3 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px] max-h-[300px] overflow-y-auto">
            {businesses.filter(b => b.status === 'ACTIVE').map(biz => (
              <DropdownMenuItem
                key={biz.id}
                onClick={() => onBusinessChange(biz.id)}
                className="text-xs"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: biz.isOnline ? '#10B981' : '#94A3B8' }} />
                  <span className="truncate flex-1">{biz.name}</span>
                  <Badge variant="outline" className="text-[9px] h-4">{biz.type.replace('_', ' ')}</Badge>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-8 w-[180px] lg:w-[220px] rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">3</span>
        </Button>

        {/* Avatar */}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">QX</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
