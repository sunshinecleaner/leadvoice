"use client";

import { useEffect, useState, useCallback } from "react";
import { Phone, PhoneOff, PhoneForwarded, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";

interface Call {
  id: string;
  status: string;
  direction: string;
  duration: number | null;
  outcome: string | null;
  createdAt: string;
  lead: { id: string; firstName: string; lastName: string; phone: string };
}

const statusIcons: Record<string, typeof Phone> = {
  COMPLETED: Phone,
  FAILED: PhoneOff,
  TRANSFERRED: PhoneForwarded,
  IN_PROGRESS: Clock,
};

const outcomeColors: Record<string, "success" | "destructive" | "warning" | "default"> = {
  INTERESTED: "success",
  NOT_INTERESTED: "destructive",
  CALLBACK: "warning",
  TRANSFERRED: "default",
  VOICEMAIL: "default",
  ERROR: "destructive",
};

export default function CallsPage() {
  const token = useAuthStore((s) => s.token);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: Call[] }>("/api/calls", { token });
      setCalls(res.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return (
    <>
      <Header
        title="Calls"
        description="Call history and monitoring"
        action={
          <Button variant="outline" size="sm" onClick={() => {}}>
            <Phone className="mr-2 h-4 w-4" /> Live Monitor
          </Button>
        }
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Lead</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Direction</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                    <th className="px-4 py-3 text-left font-medium">Outcome</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : calls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No calls yet. Start a campaign to begin making calls.
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => {
                      const Icon = statusIcons[call.status] || Phone;
                      return (
                        <tr key={call.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {call.lead.firstName} {call.lead.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{call.lead.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Icon className="h-3 w-3" />
                              <span>{call.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{call.direction}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {call.duration ? formatDuration(call.duration) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {call.outcome ? (
                              <Badge variant={outcomeColors[call.outcome] || "default"}>
                                {call.outcome}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(call.createdAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
