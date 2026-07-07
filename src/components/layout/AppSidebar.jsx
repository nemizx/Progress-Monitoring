import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CalendarClock, Network,
  ClipboardList, BarChart3, MessageSquare, Bell,
  IndianRupee, Shield, ChevronLeft, ChevronRight, HardHat, LogOut, Users, Building2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import { useQuery } from '@tanstack/react-query';

const navStructure = [
  { type: 'link', path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'link', path: '/progress', label: 'Progress', icon: ClipboardList },
  { type: 'link', path: '/technical-staff', label: 'Technical Staff', icon: Users },
  { type: 'link', path: '/contractors', label: 'Contractors', icon: Building2 },
  { type: 'group', label: 'Schedule', icon: CalendarClock, children: [
    { path: '/scheduler', label: 'Schedule Builder' },
    { path: '/schedule-monitor', label: 'Schedule Monitor' },
  ]},
  { type: 'group', label: 'Analytics', icon: BarChart3, children: [
    { path: '/reports', label: 'Reports' },
    { path: '/analytics', label: 'Analytics' },
  ]},
  { type: 'group', label: 'WBS', icon: Network, children: [
    { path: '/wbs', label: 'WBS' },
    { path: '/budget', label: 'Budget' },
    { path: '/cost', label: 'Cost Controls' },
  ]},
  { type: 'group', label: 'Admin', icon: Shield, children: [
    { path: '/admin', label: 'Administration' },
    { path: '/projects', label: 'Projects' },
  ]},
  { type: 'link', path: '/collaboration', label: 'Collaboration', icon: MessageSquare },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState(() => navStructure.reduce((acc, n) => { if (n.type === 'group') acc[n.label] = true; return acc; }, {}));

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col border-r border-sidebar-border",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <HardHat className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 flex items-center justify-between">
            <div className="overflow-hidden">
              <h1 className="font-heading font-bold text-sm tracking-tight text-sidebar-foreground">Planedge_Monitors</h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Construction OS</p>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 cursor-pointer" onClick={() => navigate('/notifications')} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navStructure.map((node) => {
          if (node.type === 'link') {
            const isActive = location.pathname === node.path || (node.path !== '/' && location.pathname.startsWith(node.path));
            const Icon = node.icon;
            return (
              <Link key={node.path} to={node.path} title={collapsed ? node.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
                {!collapsed && <span className="truncate">{node.label}</span>}
              </Link>
            );
          }

          const open = openGroups[node.label];
          return (
            <div key={node.label}>
              <button onClick={() => setOpenGroups(prev => ({ ...prev, [node.label]: !prev[node.label] }))} className={cn("flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent")}> 
                <div className="flex items-center gap-3">
                  {node.icon && <node.icon className="w-[18px] h-[18px]" />}
                  {!collapsed && <span>{node.label}</span>}
                </div>
                {!collapsed && <span className="text-xs">{open ? '-' : '+'}</span>}
              </button>
              {open && !collapsed && (
                <div className="mt-1 ml-6 space-y-1">
                  {node.children.map(child => (
                    <Link key={child.path} to={child.path} className={cn("flex items-center gap-2 px-2 py-1 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent")}> 
                      <span className="text-[13px]">{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <div className="flex items-center gap-2">
          <ThemeToggle className="ml-1" />
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}