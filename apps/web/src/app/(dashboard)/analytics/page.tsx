"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";

interface CallData {
  createdAt: string;
  status: string;
  outcome: string | null;
  duration: number | null;
}

interface ChartData {
  calls: CallData[];
  leadsByStatus: { status: string; count: number }[];
  leadsBySource: { source: string; count: number }[];
}

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const outcomeLabels: Record<string, string> = {
  INTERESTED: "Interested",
  SCHEDULED: "Scheduled",
  DEPOSIT_REQUESTED: "Deposit Req.",
  CALLBACK: "Callback",
  NOT_INTERESTED: "Not Interested",
  VOICEMAIL: "Voicemail",
  TRANSFERRED: "Transferred",
  ERROR: "Error",
};

const statusLabels: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  LOST: "Lost",
};

const sourceLabels: Record<string, string> = {
  INBOUND_CALL: "Inbound Call",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  GOOGLE: "Google",
  FACEBOOK: "Facebook",
  MANUAL: "Manual",
};

export default function AnalyticsPage() {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: ChartData }>("/api/dashboard/charts", { token });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Call volume by day ──
  const callVolumeByDay = useMemo(() => {
    if (!data?.calls) return [];
    const byDay: Record<string, { date: string; calls: number; completed: number }> = {};
    for (const call of data.calls) {
      const day = call.createdAt.slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, calls: 0, completed: 0 };
      byDay[day].calls++;
      if (call.status === "COMPLETED") byDay[day].completed++;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // ── Call outcomes distribution ──
  const outcomeDistribution = useMemo(() => {
    if (!data?.calls) return [];
    const counts: Record<string, number> = {};
    for (const call of data.calls) {
      const outcome = call.outcome || "Unknown";
      counts[outcome] = (counts[outcome] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name: outcomeLabels[name] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // ── Conversion funnel: calls → interested → scheduled → converted ──
  const funnelData = useMemo(() => {
    if (!data) return [];
    const totalCalls = data.calls.length;
    const interested = data.calls.filter((c) =>
      c.outcome === "INTERESTED" || c.outcome === "SCHEDULED" || c.outcome === "DEPOSIT_REQUESTED"
    ).length;
    const scheduled = data.calls.filter((c) =>
      c.outcome === "SCHEDULED" || c.outcome === "DEPOSIT_REQUESTED"
    ).length;
    const converted = data.leadsByStatus.find((l) => l.status === "CONVERTED")?.count || 0;

    return [
      { stage: "Total Calls", value: totalCalls },
      { stage: "Interested", value: interested },
      { stage: "Scheduled", value: scheduled },
      { stage: "Converted", value: converted },
    ];
  }, [data]);

  if (loading) {
    return (
      <>
        <Header title="Analytics" description="Performance metrics and insights" />
        <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header title="Analytics" description="Performance metrics and insights" />
        <div className="flex items-center justify-center p-12 text-muted-foreground">Failed to load analytics data.</div>
      </>
    );
  }

  return (
    <>
      <Header title="Analytics" description="Performance metrics and insights" />
      <div className="p-6 space-y-6">
        {/* Row 1: Call Volume + Conversion Funnel */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Volume (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {callVolumeByDay.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No call data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={callVolumeByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v + "T00:00:00");
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(v) => {
                        const d = new Date(v + "T00:00:00");
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                    />
                    <Area type="monotone" dataKey="calls" name="Total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelData.every((d) => d.value === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={funnelData} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                      {funnelData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Call Outcomes + Leads by Source */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              {outcomeDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No call data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={outcomeDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {outcomeDistribution.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads by Source</CardTitle>
            </CardHeader>
            <CardContent>
              {data.leadsBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No lead data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.leadsBySource.map((l) => ({ ...l, source: sourceLabels[l.source] || l.source.replace(/_/g, " ") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Leads by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.leadsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No lead data yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {data.leadsByStatus.map((item) => (
                  <div key={item.status} className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{item.count}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {statusLabels[item.status] || item.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
