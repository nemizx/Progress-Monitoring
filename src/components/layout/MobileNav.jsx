import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CalendarClock, ClipboardList, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import planedgeLogo from '@/assets/logo-planedge.png';

const mobileItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/scheduler', label: 'Schedule', icon: CalendarClock },
  { path: '/progress', label: 'Progress', icon: ClipboardList },
  { path: '/collaboration', label: 'Comms', icon: MessageSquare },
];

export default function MobileNav() {
  const location = useLocation();
  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-30">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
          <img src={planedgeLogo} alt="Planedge" className="w-full h-full object-cover" />
        </div>
        <span className="ml-3 font-heading font-bold text-sm">Planedge_Monitors</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
        <div className="flex items-center justify-around py-2">
          {mobileItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors", isActive ? "text-accent" : "text-muted-foreground")}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="h-14" />
    </>
  );
}