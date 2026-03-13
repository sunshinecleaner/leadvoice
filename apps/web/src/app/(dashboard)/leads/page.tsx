"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Upload, Search, Filter, MapPin, Home, ArrowRight, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api, apiUpload } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { PaginatedResponse } from "@leadvoice/shared";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  crmStage: string;
  city: string | null;
  state: string | null;
  propertyType: string | null;
  tags: string[];
  createdAt: string;
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "warning",
  CONVERTED: "success",
  LOST: "destructive",
};

const crmStageLabels: Record<string, string> = {
  LEAD_NEW: "Lead Novo",
  LEAD_NO_PHONE: "Sem Telefone",
  LEAD_QUALIFIED: "Qualificado",
  CHECKLIST_SENT: "Checklist Enviado",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em Execução",
  SERVICE_COMPLETED: "Finalizado",
  PAYMENT_PENDING: "Pgto Pendente",
  PAID: "Pós-Serviço",
  UPSELL: "Pós-Serviço",
  REFERRAL_REQUESTED: "Pós-Serviço",
};

const crmStageColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  LEAD_NEW: "default",
  LEAD_NO_PHONE: "default",
  LEAD_QUALIFIED: "warning",
  CHECKLIST_SENT: "secondary",
  SCHEDULED: "success",
  IN_PROGRESS: "warning",
  SERVICE_COMPLETED: "success",
  PAYMENT_PENDING: "destructive",
  PAID: "success",
  UPSELL: "success",
  REFERRAL_REQUESTED: "success",
};

export default function LeadsPage() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Add Lead modal
  const [showAddLead, setShowAddLead] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const [leadForm, setLeadForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Import CSV modal
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !leadForm.firstName || !leadForm.phone) return;
    setAddingLead(true);
    try {
      await api("/api/leads", {
        method: "POST",
        token,
        body: JSON.stringify({
          firstName: leadForm.firstName,
          lastName: leadForm.lastName || undefined,
          phone: leadForm.phone,
          email: leadForm.email || undefined,
          notes: leadForm.notes || undefined,
          source: "MANUAL",
        }),
      });
      setShowAddLead(false);
      setLeadForm({ firstName: "", lastName: "", phone: "", email: "", notes: "" });
      fetchLeads();
    } catch {
    } finally {
      setAddingLead(false);
    }
  };

  const handleImportCsv = async (file: File) => {
    if (!token) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await apiUpload<{ success: boolean; data: { imported: number; errors: string[] } }>(
        "/api/leads/import",
        file,
        token,
      );
      setImportResult(res.data);
      fetchLeads();
    } catch {
      setImportResult({ imported: 0, errors: ["Failed to upload file. Please check the format."] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Header
        title="Leads"
        description={`${meta.total} total leads`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowImport(true); setImportResult(null); }}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setShowAddLead(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </div>
        }
      />
      <div className="p-6">
        {/* Add Lead Modal */}
        {showAddLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add Lead</h2>
                <button onClick={() => setShowAddLead(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">First Name *</label>
                    <Input
                      value={leadForm.firstName}
                      onChange={(e) => setLeadForm({ ...leadForm, firstName: e.target.value })}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Last Name</label>
                    <Input
                      value={leadForm.lastName}
                      onChange={(e) => setLeadForm({ ...leadForm, lastName: e.target.value })}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Phone *</label>
                  <Input
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                    placeholder="+14701234567"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Notes</label>
                  <textarea
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddLead(false)}>Cancel</Button>
                  <Button type="submit" disabled={addingLead || !leadForm.firstName || !leadForm.phone}>
                    {addingLead ? "Adding..." : "Add Lead"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import CSV Modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Import CSV</h2>
                <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!importResult ? (
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed p-8 text-center">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Upload CSV file</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Columns: firstName, lastName, phone, email, notes
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportCsv(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      {importing ? "Importing..." : "Select File"}
                    </Button>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-medium mb-1">CSV format example:</p>
                    <code className="text-xs text-muted-foreground block">
                      firstName,lastName,phone,email<br />
                      John,Smith,4701234567,john@email.com<br />
                      Mary,Johnson,4709876543,mary@email.com
                    </code>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {importResult.imported > 0 ? (
                    <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-950 dark:text-green-300">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">{importResult.imported} leads imported successfully!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-950 dark:text-red-300">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">No leads were imported.</span>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="rounded-md border p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-1 text-destructive">Errors:</p>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setImportResult(null); }}>
                      Import Another
                    </Button>
                    <Button onClick={() => setShowImport(false)}>Done</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, phone, city..."
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
                    <th className="px-4 py-3 text-left font-medium">Location</th>
                    <th className="px-4 py-3 text-left font-medium">Property</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">CRM Stage</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        No leads found. Leads are created automatically from inbound calls.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {lead.firstName} {lead.lastName}
                          </div>
                          {lead.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {lead.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{formatPhone(lead.phone)}</td>
                        <td className="px-4 py-3">
                          {lead.city || lead.state ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {lead.propertyType ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Home className="h-3 w-3" />
                              <span className="capitalize">{lead.propertyType.toLowerCase()}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={crmStageColors[lead.crmStage] || "default"}>
                            {crmStageLabels[lead.crmStage] || lead.crmStage}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{lead.source.replace(/_/g, " ")}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </td>
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
