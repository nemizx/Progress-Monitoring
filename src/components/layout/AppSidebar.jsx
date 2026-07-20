import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/lib/AuthContext';
import planedgeLogo from '@/assets/logo-planedge.png';
import { navigationItems } from '@/lib/navigation';

export default function AppSidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      // Synchronize navigation structure with modules table on backend
      const flatModules = [];
      navigationItems.forEach((item, index) => {
        flatModules.push({
          id: item.id,
          parent_module_id: null,
          module_name: item.label,
          route: item.path || null,
          display_order: index
        });
        if (item.children) {
          item.children.forEach((child, childIndex) => {
            flatModules.push({
              id: child.id,
              parent_module_id: item.id,
              module_name: child.label,
              route: child.tab ? `${child.path}?tab=${child.tab}` : child.path,
              display_order: childIndex
            });
          });
        }
      });
      base44.modules.sync(flatModules).catch(err => {
        console.error('Failed to sync modules:', err);
      });
    }
  }, [isAdmin]);

  const filteredNavStructure = React.useMemo(() => {
    if (isAdmin) return navigationItems;
    if (!user || !user.permissions) return [];

    return navigationItems.map(item => {
      if (item.type === 'link') {
        const canView = user.permissions[item.id]?.can_view;
        return canView ? item : null;
      }
      if (item.type === 'group') {
        const visibleChildren = item.children.filter(child => {
          return user.permissions[child.id]?.can_view;
        });
        if (visibleChildren.length > 0) {
          return {
            ...item,
            children: visibleChildren
          };
        }
        return null;
      }
      return null;
    }).filter(Boolean);
  }, [user, isAdmin]);

  const [openGroups, setOpenGroups] = useState(() => ({
    'Progress': true,
    'Schedule': true,
    'Analytics': true,
    'WBS': true,
    'Admin': true,
  }));

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col border-r border-sidebar-border",
        !hovered ? "w-[68px]" : "w-[240px] shadow-2xl"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0 overflow-hidden">
          <img src={planedgeLogo} alt="Planedge" className="w-full h-full object-cover" />
        </div>
        {hovered && (
          <div className="flex-1 flex items-center justify-between animate-in fade-in duration-200">
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
        {filteredNavStructure.map((node) => {
          if (node.type === 'link') {
            const isActive = location.pathname === node.path || (node.path !== '/' && location.pathname.startsWith(node.path));
            const isExactActive = location.pathname === node.path;
            const Icon = node.icon;
            return (
              <Link key={node.path} to={node.path} title={!hovered ? node.label : undefined}
                onClick={(e) => {
                  if (isExactActive) {
                    e.preventDefault();
                    window.location.reload();
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
                {hovered && <span className="truncate animate-in fade-in duration-200">{node.label}</span>}
              </Link>
            );
          }

          const open = openGroups[node.label];
          return (
            <div key={node.label}>
              <button onClick={() => setOpenGroups(prev => ({ ...prev, [node.label]: !prev[node.label] }))} className={cn("flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent")}> 
                <div className="flex items-center gap-3">
                  {node.icon && <node.icon className="w-[18px] h-[18px]" />}
                  {hovered && <span className="animate-in fade-in duration-200">{node.label}</span>}
                </div>
                {hovered && <span className="text-xs">{open ? '-' : '+'}</span>}
              </button>
              {open && hovered && (
                <div className="mt-1 ml-6 space-y-1 animate-in slide-in-from-left-2 duration-200">
                  {node.children.map(child => {
                    const childTo = child.tab
                      ? `${child.path}?tab=${child.tab}`
                      : child.path;
                    const progressTab = new URLSearchParams(location.search).get('tab') || 'dpr';
                    const isChildActive = child.tab
                      ? location.pathname === child.path && progressTab === child.tab
                      : location.pathname === child.path || location.pathname.startsWith(`${child.path}/`);
                    const isExactChildActive = child.tab
                      ? location.pathname === child.path && progressTab === child.tab
                      : location.pathname === child.path;
                    return (
                      <Link
                        key={childTo}
                        to={childTo}
                        onClick={(e) => {
                          if (isExactChildActive) {
                            e.preventDefault();
                            window.location.reload();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors",
                          isChildActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <span className="text-[13px]">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <ThemeToggle className="ml-1 shrink-0" />
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
            title={!hovered ? 'Logout' : undefined}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {hovered && <span className="animate-in fade-in duration-200">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}