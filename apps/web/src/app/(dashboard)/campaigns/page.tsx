"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Play, Pause, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <>
      <Header
        title="Campaigns"
        description="Manage your calling campaigns"
        action={
          <Link href="/campaigns/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </Link>
        }
      />
      <div className="p-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No campaigns yet. Create your first campaign.</p>
              <Link href="/campaigns/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Campaign
                </Button>
              </Link>
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
