import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      </div>
      
      {/* Mobile nav */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Main content */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'}`}>
        <div className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}