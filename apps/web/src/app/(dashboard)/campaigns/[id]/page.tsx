"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, Trash2, Plus, UserMinus, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface CampaignLead {
  id: string;
  status: string;
  attempts: number;
  lastCalledAt: string | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: string;
  };
}

interface CampaignDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  script: string;
  maxRetries: number;
  timezone: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  campaignLeads: CampaignLead[];
}

interface AvailableLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
}

const statusConfig: Record<string, { variant: "default" | "success" | "warning" | "secondary"; label: string }> = {
  DRAFT: { variant: "secondary", label: "Draft" },
  ACTIVE: { variant: "success", label: "Active" },
  PAUSED: { variant: "warning", label: "Paused" },
  COMPLETED: { variant: "default", label: "Completed" },
};

const leadStatusConfig: Record<string, { variant: "default" | "success" | "warning" | "secondary" | "destructive"; label: string }> = {
  PENDING: { variant: "secondary", label: "Pending" },
  IN_PROGRESS: { variant: "warning", label: "In Progress" },
  COMPLETED: { variant: "success", label: "Completed" },
  FAILED: { variant: "destructive", label: "Failed" },
  SKIPPED: { variant: "default", label: "Skipped" },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const id = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddLeads, setShowAddLeads] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<AvailableLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [searchLeads, setSearchLeads] = useState("");
  const [addingLeads, setAddingLeads] = useState(false);

  const fetchCampaign = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: CampaignDetail }>(`/api/campaigns/${id}`, { token });
      setCampaign(res.data);
    } catch {
      router.push("/campaigns");
    } finally {
      setLoading(false);
    }
  }, [token, id, router]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const fetchAvailableLeads = async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (searchLeads) params.set("search", searchLeads);
      const res = await api<{ data: AvailableLead[] }>(`/api/leads?${params}`, { token });
      const existingIds = new Set(campaign?.campaignLeads.map((cl) => cl.lead.id) || []);
      setAvailableLeads(res.data.filter((l) => !existingIds.has(l.id)));
    } catch {}
  };

  const handleOpenAddLeads = async () => {
    setShowAddLeads(true);
    setSelectedLeadIds([]);
    setSearchLeads("");
    await fetchAvailableLeads();
  };

  const handleAddLeads = async () => {
    if (!token || selectedLeadIds.length === 0) return;
    setAddingLeads(true);
    try {
      await api(`/api/campaigns/${id}/leads`, {
        method: "POST",
        token,
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      setShowAddLeads(false);
      setSelectedLeadIds([]);
      fetchCampaign();
    } catch {
    } finally {
      setAddingLeads(false);
    }
  };

  const handleAction = async (action: "start" | "pause") => {
    if (!token) return;
    try {
      await api(`/api/campaigns/${id}/${action}`, { method: "POST", token });
      fetchCampaign();
    } catch {}
  };

  const handleDelete = async () => {
    if (!token || !confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await api(`/api/campaigns/${id}`, { method: "DELETE", token });
      router.push("/campaigns");
    } catch {}
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    );
  };

  const selectAllLeads = () => {
    if (selectedLeadIds.length === availableLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(availableLeads.map((l) => l.id));
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Campaign" />
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      </>
    );
  }

  if (!campaign) return null;

  const config = statusConfig[campaign.status] || statusConfig.DRAFT;

  return (
    <>
      <Header
        title={campaign.name}
        description={campaign.description || undefined}
        action={
          <div className="flex gap-2">
            {campaign.status === "DRAFT" || campaign.status === "PAUSED" ? (
              <Button size="sm" onClick={() => handleAction("start")}>
                <Play className="mr-1 h-4 w-4" /> Start
              </Button>
            ) : campaign.status === "ACTIVE" ? (
              <Button size="sm" variant="outline" onClick={() => handleAction("pause")}>
                <Pause className="mr-1 h-4 w-4" /> Pause
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/campaigns")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Campaigns
        </Button>

        {/* Campaign Info */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={config.variant} className="mt-1">{config.label}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Leads</p>
              <p className="text-2xl font-bold">{campaign.campaignLeads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Calling Window</p>
              <p className="text-sm font-medium mt-1">
                {campaign.callingWindowStart} - {campaign.callingWindowEnd}
              </p>
              <p className="text-xs text-muted-foreground">{campaign.timezone}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Max Retries</p>
              <p className="text-2xl font-bold">{campaign.maxRetries}</p>
            </CardContent>
          </Card>
        </div>

        {/* Script */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Script / Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{campaign.script}</p>
          </CardContent>
        </Card>

        {/* Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campaign Leads ({campaign.campaignLeads.length})</CardTitle>
            <Button size="sm" onClick={handleOpenAddLeads}>
              <Plus className="mr-1 h-4 w-4" /> Add Leads
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {campaign.campaignLeads.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No leads added to this campaign yet.</p>
                <Button size="sm" className="mt-2" onClick={handleOpenAddLeads}>
                  <Plus className="mr-1 h-4 w-4" /> Add Leads
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Attempts</th>
                      <th className="px-4 py-3 text-left font-medium">Last Called</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.campaignLeads.map((cl) => {
                      const lConfig = leadStatusConfig[cl.status] || leadStatusConfig.PENDING;
                      return (
                        <tr key={cl.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">
                            {cl.lead.firstName} {cl.lead.lastName}
                          </td>
                          <td className="px-4 py-3">{cl.lead.phone}</td>
                          <td className="px-4 py-3">
                            <Badge variant={lConfig.variant}>{lConfig.label}</Badge>
                          </td>
                          <td className="px-4 py-3">{cl.attempts}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {cl.lastCalledAt ? formatDate(cl.lastCalledAt) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Leads Modal */}
        {showAddLeads && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg max-h-[80vh] flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Add Leads to Campaign</h2>
                <button onClick={() => setShowAddLeads(false)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>
              <div className="mb-3">
                <Input
                  placeholder="Search leads..."
                  value={searchLeads}
                  onChange={(e) => setSearchLeads(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchAvailableLeads()}
                />
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{availableLeads.length} leads available</span>
                <button onClick={selectAllLeads} className="text-primary text-sm hover:underline">
                  {selectedLeadIds.length === availableLeads.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-0">
                {availableLeads.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No available leads found.</p>
                ) : (
                  availableLeads.map((lead) => (
                    <label
                      key={lead.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{lead.status}</Badge>
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddLeads(false)}>Cancel</Button>
                <Button onClick={handleAddLeads} disabled={addingLeads || selectedLeadIds.length === 0}>
                  {addingLeads ? "Adding..." : `Add ${selectedLeadIds.length} Lead${selectedLeadIds.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
