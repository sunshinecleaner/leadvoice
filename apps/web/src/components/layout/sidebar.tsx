"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Phone,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  CalendarDays,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";

const menuItems = [
  { href: "/overview", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const generalItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const renderNavItem = (item: { href: string; label: string; icon: any }) => {
    const isActive =
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <item.icon className="h-[18px] w-[18px]" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-[260px] flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <Image
          src="https://sunshinebrazilian.com/wp-content/uploads/2025/05/Logo-horizontal-preto.png"
          alt="Sunshine Brazilian"
          width={180}
          height={40}
          className="brightness-0 invert"
          unoptimized
        />
      </div>

      {/* Menu Section */}
      <nav className="flex-1 space-y-6 px-4 py-2">
        <div>
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-white/40">
            Menu
          </p>
          <div className="space-y-1">
            {menuItems.map(renderNavItem)}
          </div>
        </div>

        <div>
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-white/40">
            General
          </p>
          <div className="space-y-1">
            {generalItems.map(renderNavItem)}
          </div>
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-white">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.name || "User"}</p>
              <p className="text-xs text-white/50">{user?.role || "Admin"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
