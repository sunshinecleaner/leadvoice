"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Phone,
  Megaphone,
  TrendingUp,
  Clock,
  PhoneCall,
  ArrowUpRight,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { DashboardStats } from "@leadvoice/shared";

export default function OverviewPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (token) {
      api<{ data: DashboardStats }>("/api/dashboard/stats", { token })
        .then((res) => setStats(res.data))
        .catch(() => {});
    }
  }, [token]);

  const cards = [
    {
      title: "Total Leads",
      value: stats?.totalLeads ?? 0,
      icon: Users,
      highlight: true,
      subtitle: "All time leads",
    },
    {
      title: "Total Calls",
      value: stats?.totalCalls ?? 0,
      icon: Phone,
      highlight: false,
      subtitle: "Calls completed",
    },
    {
      title: "Active Campaigns",
      value: stats?.activeCampaigns ?? 0,
      icon: Megaphone,
      highlight: false,
      subtitle: "Running campaigns",
    },
    {
      title: "Conversion Rate",
      value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      highlight: false,
      subtitle: "Lead to customer",
    },
    {
      title: "Avg Duration",
      value: `${Math.round(stats?.avgCallDuration ?? 0)}s`,
      icon: Clock,
      highlight: false,
      subtitle: "Per call average",
    },
    {
      title: "Calls Today",
      value: stats?.callsToday ?? 0,
      icon: PhoneCall,
      highlight: false,
      subtitle: "Today's activity",
    },
  ];

  return (
    <>
      <Header
        title="Dashboard"
        description="Plan, track and manage your leads with ease."
      />
      <div className="p-8">
        {/* Welcome message */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-muted-foreground">
            Welcome back, <span className="font-semibold text-foreground">{user?.name || "Admin"}</span>
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`group relative overflow-hidden rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                card.highlight
                  ? "bg-primary text-primary-foreground"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <p
                  className={`text-sm font-medium ${
                    card.highlight ? "text-white/80" : "text-muted-foreground"
                  }`}
                >
                  {card.title}
                </p>
                <div
                  className={`rounded-full p-1.5 ${
                    card.highlight
                      ? "bg-white/20"
                      : "bg-muted"
                  }`}
                >
                  <ArrowUpRight
                    className={`h-3.5 w-3.5 ${
                      card.highlight ? "text-white" : "text-muted-foreground"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold tracking-tight">
                  {card.value}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    card.highlight ? "text-white/60" : "text-muted-foreground"
                  }`}
                >
                  {card.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Calls */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recent Calls</h3>
              <a
                href="/calls"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </a>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Make calls to see activity here.
              </p>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Active Campaigns</h3>
              <a
                href="/campaigns"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </a>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Create campaigns to start outreach.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
            <h3 className="font-semibold text-white">SunnyBee AI</h3>
            <p className="mt-2 text-sm text-white/70">
              Your AI assistant is ready to make calls and engage with leads
              automatically.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-white/80">Online & Ready</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
