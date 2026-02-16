"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, Truck } from "lucide-react";
import Link from "next/link";
import { Button } from "@heroui/button";

import { adminLinks, kurirLinks } from "./DashboardNavbar";

import { ThemeSwitch } from "@/components/theme-switch";

interface DashboardSidebarProps {
  role: "super-admin" | "admin" | "kurir";
  userName?: string;
}

export function DashboardSidebar({ role, userName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const userRole = role;

  const getLinks = () => {
    if (userRole === "kurir") return kurirLinks;

    return adminLinks.filter((link) => {
      if (link.superAdminOnly && userRole !== "super-admin") {
        return false;
      }

      return true;
    });
  };

  const links = getLinks();
  const displayRole = userRole === "super-admin" ? "super admin" : userRole;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-r border-black/10 dark:border-white/10 z-50">
      {/* Header / Logo */}
      <div className="flex flex-col items-center justify-center h-20 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="bg-primary/20 p-1.5 rounded-lg">
            <Truck className="w-6 h-6 text-primary" />
          </span>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Washlap
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 mt-1 rounded-full bg-primary/10 text-primary font-medium uppercase">
          {displayRole}
        </span>
      </div>

      {/* Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                }`}
              href={link.href}
            >
              <span className="text-lg">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-black/10 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-medium text-gray-500">Theme</span>
          <ThemeSwitch />
        </div>
        <Button
          className="w-full justify-start"
          color="danger"
          startContent={<LogOut size={18} />}
          variant="flat"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </div>
    </aside>
  );
}
