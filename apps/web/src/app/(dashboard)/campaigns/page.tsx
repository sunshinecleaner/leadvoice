"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Play, Pause, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Campaign {
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
  _count: { campaignLeads: number };
}

const statusConfig: Record<string, { variant: "default" | "success" | "warning" | "secondary"; label: string }> = {
  DRAFT: { variant: "secondary", label: "Draft" },
  ACTIVE: { variant: "success", label: "Active" },
  PAUSED: { variant: "warning", label: "Paused" },
  COMPLETED: { variant: "default", label: "Completed" },
};

export default function CampaignsPage() {
  const token = useAuthStore((s) => s.token);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    script: "",
    maxRetries: 3,
    callingWindowStart: "09:00",
    callingWindowEnd: "17:00",
    timezone: "America/New_York",
  });

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: Campaign[] }>("/api/campaigns", { token });
      setCampaigns(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleAction = async (id: string, action: "start" | "pause") => {
    if (!token) return;
    try {
      await api(`/api/campaigns/${id}/${action}`, { method: "POST", token });
      fetchCampaigns();
    } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name || !form.script) return;
    setCreating(true);
    try {
      await api("/api/campaigns", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          script: form.script,
          maxRetries: form.maxRetries,
          callingWindowStart: form.callingWindowStart,
          callingWindowEnd: form.callingWindowEnd,
          timezone: form.timezone,
        }),
      });
      setShowCreate(false);
      setForm({ name: "", description: "", script: "", maxRetries: 3, callingWindowStart: "09:00", callingWindowEnd: "17:00", timezone: "America/New_York" });
      fetchCampaigns();
    } catch {
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Header
        title="Campaigns"
        description="Manage your calling campaigns"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        }
      />
      <div className="p-6">
        {/* Create Campaign Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">New Campaign</h2>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Campaign Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Spring Cleaning Outreach"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Script / Instructions *</label>
                  <textarea
                    value={form.script}
                    onChange={(e) => setForm({ ...form, script: e.target.value })}
                    placeholder="Call script or AI assistant instructions..."
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Max Retries</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={form.maxRetries}
                      onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Start Time</label>
                    <Input
                      type="time"
                      value={form.callingWindowStart}
                      onChange={(e) => setForm({ ...form, callingWindowStart: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">End Time</label>
                    <Input
                      type="time"
                      value={form.callingWindowEnd}
                      onChange={(e) => setForm({ ...form, callingWindowEnd: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Timezone</label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="America/New_York">Eastern (New York)</option>
                    <option value="America/Chicago">Central (Chicago)</option>
                    <option value="America/Denver">Mountain (Denver)</option>
                    <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !form.name || !form.script}>
                    {creating ? "Creating..." : "Create Campaign"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No campaigns yet. Create your first campaign.</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const config = statusConfig[campaign.status] || statusConfig.DRAFT;
              return (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      {campaign.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{campaign._count.campaignLeads} leads</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.callingWindowStart} - {campaign.callingWindowEnd} ({campaign.timezone})
                      </div>
                      <div className="text-xs text-muted-foreground">Created {formatDate(campaign.createdAt)}</div>
                      <div className="flex gap-2 pt-2">
                        {campaign.status === "DRAFT" || campaign.status === "PAUSED" ? (
                          <Button size="sm" variant="outline" onClick={() => handleAction(campaign.id, "start")}>
                            <Play className="mr-1 h-3 w-3" /> Start
                          </Button>
                        ) : campaign.status === "ACTIVE" ? (
                          <Button size="sm" variant="outline" onClick={() => handleAction(campaign.id, "pause")}>
                            <Pause className="mr-1 h-3 w-3" /> Pause
                          </Button>
                        ) : null}
                        <Link href={`/campaigns/${campaign.id}`}>
                          <Button size="sm" variant="ghost">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
