"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { TrendingUp, Users2, DollarSign } from "lucide-react";

interface BillingClient {
  leadName: string;
  phone: string;
  value: number;
  monthlyRevenue: number;
  teamCost: number;
  otherExpenses: number;
  netResult: number;
  teamMember?: string | null;
  paymentStatus?: string;
}

interface BillingGroup {
  frequency: string;
  clientCount: number;
  totalRevenue: number;
  totalCost: number;
  netResult: number;
  clients: BillingClient[];
}

interface BillingData {
  groups: BillingGroup[];
  grandTotal: { revenue: number; cost: number; net: number };
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly (4×/month)",
  BI_WEEKLY: "Bi-Weekly (2×/month)",
  MONTHLY: "Monthly (1×/month)",
};

const FREQ_COLORS: Record<string, string> = {
  WEEKLY: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  BI_WEEKLY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  MONTHLY: "bg-green-500/10 text-green-500 border-green-500/20",
};

export default function BillingPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<{ success: boolean; data: BillingData }>("/api/clients/billing", { token })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Billing" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : !data || data.groups.every(g => g.clientCount === 0) ? (
            <div className="text-center text-muted-foreground py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No recurring clients to report.</p>
              <p className="text-xs mt-1">Add recurring service requests to leads to see billing data here.</p>
            </div>
          ) : (
            <>
              {/* Grand total */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Monthly Revenue", value: data.grandTotal.revenue, color: "text-green-500" },
                  { label: "Total Cost", value: data.grandTotal.cost, color: "text-red-500" },
                  { label: "Net Result", value: data.grandTotal.net, color: data.grandTotal.net >= 0 ? "text-green-500" : "text-red-500" },
                ].map(({ label, value, color }) => (
                  <Card key={label}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <DollarSign className={`h-5 w-5 ${color}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>${value.toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Groups */}
              {data.groups.filter(g => g.clientCount > 0).map((group) => (
                <Card key={group.frequency}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={FREQ_COLORS[group.frequency] ?? ""}>
                          {FREQ_LABELS[group.frequency] ?? group.frequency}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Users2 className="h-3.5 w-3.5" />{group.clientCount} clients
                        </span>
                      </div>
                      <div className="text-right text-sm">
                        <span className="text-green-500 font-medium">${group.totalRevenue.toFixed(2)}</span>
                        <span className="text-muted-foreground mx-2">−</span>
                        <span className="text-red-500">${group.totalCost.toFixed(2)}</span>
                        <span className="text-muted-foreground mx-2">=</span>
                        <span className={`font-bold ${group.netResult >= 0 ? "text-green-500" : "text-red-500"}`}>${group.netResult.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="grid grid-cols-5 text-xs text-muted-foreground font-medium px-2 py-1">
                        <span className="col-span-2">Client</span>
                        <span className="text-right">Value</span>
                        <span className="text-right">Cost</span>
                        <span className="text-right">Net/mo</span>
                      </div>
                      {group.clients.map((c, i) => (
                        <div key={i} className="grid grid-cols-5 text-sm px-2 py-1.5 rounded hover:bg-muted/50">
                          <div className="col-span-2">
                            <p className="font-medium">{c.leadName}</p>
                            {c.teamMember && <p className="text-xs text-muted-foreground">👤 {c.teamMember}</p>}
                          </div>
                          <p className="text-right">${c.value.toFixed(2)}</p>
                          <p className="text-right text-red-500">-${(c.teamCost + c.otherExpenses).toFixed(2)}</p>
                          <p className={`text-right font-medium ${c.netResult >= 0 ? "text-green-500" : "text-red-500"}`}>
                            ${c.netResult.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
