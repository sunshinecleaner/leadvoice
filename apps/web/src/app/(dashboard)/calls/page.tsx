"use client";

import { useEffect, useState, useCallback } from "react";
import { PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { PaginatedResponse } from "@leadvoice/shared";

interface Call {
  id: string;
  status: string;
  direction: string;
  duration: number | null;
  outcome: string | null;
  summary: string | null;
  createdAt: string;
  lead: { id: string; firstName: string; lastName: string; phone: string };
}

const outcomeColors: Record<string, "success" | "destructive" | "warning" | "default"> = {
  INTERESTED: "success",
  SCHEDULED: "success",
  DEPOSIT_REQUESTED: "warning",
  CALLBACK: "warning",
  NOT_INTERESTED: "destructive",
  VOICEMAIL: "default",
  ERROR: "destructive",
};

export default function CallsPage() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(
    async (page = 1) => {
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        const res = await api<PaginatedResponse<Call> & { success: boolean }>(
          `/api/calls?${params}`,
          { token },
        );
        setCalls(res.data);
        setMeta(res.meta);
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  return (
    <>
      <Header
        title="Calls"
        description={`${meta.total} total calls`}
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Lead</th>
                    <th className="px-4 py-3 text-left font-medium">Direction</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                    <th className="px-4 py-3 text-left font-medium">Outcome</th>
                    <th className="px-4 py-3 text-left font-medium">Summary</th>
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
                        No calls yet. Calls are recorded automatically from VAPI.
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => {
                      const DirIcon = call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
                      return (
                        <tr
                          key={call.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/leads/${call.lead.id}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {call.lead.firstName} {call.lead.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{call.lead.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <DirIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{call.direction}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {call.duration ? formatDuration(call.duration) : "-"}
                            </span>
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
                          <td className="px-4 py-3 max-w-xs">
                            {call.summary ? (
                              <p className="text-muted-foreground text-xs truncate">{call.summary}</p>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
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

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => fetchCalls(meta.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => fetchCalls(meta.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
