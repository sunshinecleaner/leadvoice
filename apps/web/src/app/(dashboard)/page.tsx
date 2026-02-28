"use client";

import { useEffect, useState } from "react";
import { Phone, Users, Megaphone, TrendingUp, Clock, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import type { DashboardStats } from "@leadvoice/shared";

export default function OverviewPage() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (token) {
      api<{ data: DashboardStats }>("/api/dashboard/stats", { token }).then((res) =>
        setStats(res.data),
      ).catch(() => {});
    }
  }, [token]);

  const cards = [
    { title: "Total Leads", value: stats?.totalLeads ?? 0, icon: Users, color: "text-blue-600" },
    { title: "Total Calls", value: stats?.totalCalls ?? 0, icon: Phone, color: "text-green-600" },
    { title: "Active Campaigns", value: stats?.activeCampaigns ?? 0, icon: Megaphone, color: "text-purple-600" },
    { title: "Conversion Rate", value: `${(stats?.conversionRate ?? 0).toFixed(1)}%`, icon: TrendingUp, color: "text-orange-600" },
    { title: "Avg Call Duration", value: `${Math.round(stats?.avgCallDuration ?? 0)}s`, icon: Clock, color: "text-cyan-600" },
    { title: "Calls Today", value: stats?.callsToday ?? 0, icon: PhoneCall, color: "text-pink-600" },
  ];

  return (
    <>
      <Header title="Overview" description="Dashboard overview and key metrics" />
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
