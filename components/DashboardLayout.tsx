"use client";

import { DashboardNavbar } from "./DashboardNavbar";
import { DashboardSidebar } from "./DashboardSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "super-admin" | "admin" | "kurir";
  userName?: string;
}

export function DashboardLayout({ children, role, userName }: DashboardLayoutProps) {
  // User requested sidebar for admin and super-admin on desktop
  const showSidebar = role === "admin" || role === "super-admin";

  return (
    <div className="min-h-screen relative overflow-hidden bg-background font-sans antialiased">
      {/* Global Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-100 to-purple-50 dark:from-blue-900 dark:to-gray-950 -z-20" />

      {showSidebar ? (
        <>
          {/* Desktop: Sidebar */}
          <DashboardSidebar role={role} userName={userName} />

          {/* Mobile: Top Navbar */}
          <div className="md:hidden sticky top-0 z-40">
            <DashboardNavbar hideDesktopNav={true} role={role} userName={userName} />
          </div>

          {/* Content Area */}
          <main className="md:ml-64 p-4 md:p-8 transition-all duration-300 ease-in-out">
            {children}
          </main>
        </>
      ) : (
        <>
          {/* Standard Layout (e.g. Kurir) - Top Navbar always */}
          <DashboardNavbar role={role} userName={userName} />

          <main className="max-w-6xl mx-auto p-6">{children}</main>
        </>
      )}
    </div>
  );
}
