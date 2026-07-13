import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>
      
      {/* Mobile nav */}
      <div className="lg:hidden">
        <MobileNav />
      </div>

      {/* Main content */}
      <main className="lg:ml-[68px] min-h-screen">
        <div className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}