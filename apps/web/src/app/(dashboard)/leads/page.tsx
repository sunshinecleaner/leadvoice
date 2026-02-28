"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Upload, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import type { PaginatedResponse } from "@leadvoice/shared";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  company: string | null;
  source: string;
  status: string;
  score: number;
  createdAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "warning",
  CONVERTED: "success",
  LOST: "destructive",
};

export default function LeadsPage() {
  const token = useAuthStore((s) => s.token);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(
    async (page = 1) => {
      if (!token) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        const res = await api<PaginatedResponse<Lead> & { success: boolean }>(
          `/api/leads?${params}`,
          { token },
        );
        setLeads(res.data);
        setMeta(res.meta);
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [token, search],
  );

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return (
    <>
      <Header
        title="Leads"
        description={`${meta.total} total leads`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </div>
        }
      />
      <div className="p-6">
        {/* Search & Filters */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, phone..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Company</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-left font-medium">Score</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No leads found. Import a CSV or add leads manually.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead.id} className="border-b hover:bg-muted/50 cursor-pointer">
                        <td className="px-4 py-3 font-medium">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="px-4 py-3">{formatPhone(lead.phone)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.email || "-"}</td>
                        <td className="px-4 py-3">{lead.company || "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{lead.source}</Badge>
                        </td>
                        <td className="px-4 py-3">{lead.score}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.createdAt)}</td>
                      </tr>
                    ))
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
                onClick={() => fetchLeads(meta.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => fetchLeads(meta.page + 1)}
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
