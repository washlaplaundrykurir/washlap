"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@heroui/button";
import {
  ClipboardList,
  Truck,
  CheckCircle2,
  ScrollText,
  Users,
  User,
  LayoutDashboard,
  LogOut,
  FileSpreadsheet,
} from "lucide-react";
import React from "react";

import { ThemeSwitch } from "@/components/theme-switch";

interface DashboardNavbarProps {
  role: "super-admin" | "admin" | "kurir";
  hideDesktopNav?: boolean;
}

export const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  {
    href: "/admin/orders",
    label: "Belum Ditugaskan",
    icon: <ClipboardList size={20} />,
  },
  { href: "/admin/tugas", label: "Tugas Kurir", icon: <Truck size={20} /> },
  {
    href: "/admin/selesai",
    label: "Selesai",
    icon: <CheckCircle2 size={20} />,
  },
  { href: "/admin/riwayat", label: "Riwayat", icon: <ScrollText size={20} /> },
  {
    href: "/admin/users",
    label: "Users",
    icon: <Users size={20} />,
    superAdminOnly: true,
  },
  { href: "/admin/customers", label: "Pelanggan", icon: <User size={20} /> },
  {
    href: "/admin/reports",
    label: "Laporan",
    icon: <FileSpreadsheet size={20} />,
    superAdminOnly: true,
  },
];

export const kurirLinks = [
  { href: "/kurir", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  {
    href: "/kurir/tasks",
    label: "Tugas Saya",
    icon: <ClipboardList size={20} />,
  },
  { href: "/kurir/history", label: "Riwayat", icon: <ScrollText size={20} /> },
];

export function DashboardNavbar({
  role: initialRole,
  hideDesktopNav = false,
}: DashboardNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<"super-admin" | "admin" | "kurir">(
    initialRole,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Fetch actual user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch("/api/users/me");

        if (response.ok) {
          const data = await response.json();

          if (data.user?.role) {
            setUserRole(data.user.role as "super-admin" | "admin" | "kurir");
          }
        }
      } catch {
        // Use initial role on error
      }
    };

    fetchUserRole();
  }, []);

  // Filter links based on role
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
    <>
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-black/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Hamburger Button */}
            <button
              aria-label="Toggle menu"
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                ) : (
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                )}
              </svg>
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary flex items-center justify-center">
                <span className="bg-primary/20 p-1.5 rounded-lg">
                  <Truck className="w-5 h-5 text-primary" />
                </span>
              </span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                Washlap
              </span>
              <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium uppercase">
                {displayRole}
              </span>
            </div>

            {/* Desktop Navigation Links */}
            {!hideDesktopNav && (
              <div className="hidden md:flex items-center gap-1">
                {links.map((link) => {
                  const isActive = pathname === link.href;

                  return (
                    <Link
                      key={link.href}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                          ? "bg-primary/10 text-primary"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
                        }`}
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Right Side */}
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeSwitch />
              <Button
                className="hidden sm:flex"
                color="danger"
                size="sm"
                variant="flat"
                onClick={handleLogout}
              >
                Logout
              </Button>
              {/* Mobile logout icon */}
              <button
                aria-label="Logout"
                className="sm:hidden p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                onClick={handleLogout}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Slide-out Menu */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          role="button"
          tabIndex={0}
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsMobileMenuOpen(false);
            }
          }}
        />

        {/* Menu Panel */}
        <div
          className={`absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="bg-primary/20 p-1.5 rounded-lg">
                <Truck className="w-5 h-5 text-primary" />
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                Menu
              </span>
            </div>
            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
          </div>

          {/* Role Badge */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium uppercase">
              {displayRole}
            </span>
          </div>

          {/* Menu Links */}
          <div className="py-2">
            {links.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${isActive
                      ? "bg-primary/10 text-primary border-r-4 border-primary"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
                    }`}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Logout Button */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-white/10">
            <Button
              className="w-full"
              color="danger"
              variant="flat"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut className="mr-2" size={18} /> Logout
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
