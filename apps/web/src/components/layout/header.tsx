"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

interface HeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Header({ title, description, action }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex h-[72px] items-center justify-between px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 rounded-xl border-none bg-white pl-9 shadow-sm"
          />
        </div>
        <button className="relative rounded-xl bg-white p-2.5 shadow-sm transition-colors hover:bg-muted">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </button>
        {action}
        <div className="flex items-center gap-3 rounded-xl bg-white py-2 pl-3 pr-4 shadow-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
