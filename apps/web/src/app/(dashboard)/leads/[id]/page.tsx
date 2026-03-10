"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MapPin, Home, Calendar, Clock, FileText,
  MessageSquare, DollarSign, User, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate, formatDuration, formatPhone } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  serviceType: string;
  frequency: string;
  addOns: string[];
  depositRequired: boolean;
  depositAmount: number | null;
  paymentStatus: string;
  scheduledDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface Call {
  id: string;
  direction: string;
  status: string;
  duration: number | null;
  outcome: string | null;
  summary: string | null;
  transcription: string | null;
  recordingUrl: string | null;
  createdAt: string;
}

interface LeadDetail {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  crmStage: string;
  language: string;
  tags: string[];
  notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  isOccupied: boolean | null;
  conditionLevel: string | null;
  preferredSchedule: string | null;
  createdAt: string;
  updatedAt: string;
  calls: Call[];
  serviceRequests: ServiceRequest[];
}

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NEW: "default",
  CONTACTED: "secondary",
  QUALIFIED: "warning",
  CONVERTED: "success",
  LOST: "destructive",
};

const outcomeColors: Record<string, "success" | "destructive" | "warning" | "default"> = {
  INTERESTED: "success",
  SCHEDULED: "success",
  DEPOSIT_REQUESTED: "warning",
  CALLBACK: "warning",
  NOT_INTERESTED: "destructive",
  VOICEMAIL: "default",
  ERROR: "destructive",
};

const crmStageLabels: Record<string, string> = {
  LEAD_NEW: "New Lead",
  LEAD_NO_PHONE: "No Phone",
  LEAD_QUALIFIED: "Qualified",
  CHECKLIST_SENT: "Checklist Sent",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  SERVICE_COMPLETED: "Completed",
  PAYMENT_PENDING: "Payment Pending",
  PAID: "Paid",
  UPSELL: "Upsell",
  REFERRAL_REQUESTED: "Referral",
};

const serviceTypeLabels: Record<string, string> = {
  STANDARD_CLEANING: "Standard Cleaning",
  DEEP_CLEANING: "Deep Cleaning",
  RECURRING: "Recurring",
  MOVE_IN: "Move In",
  MOVE_OUT: "Move Out",
  POST_CONSTRUCTION: "Post Construction",
};

const frequencyLabels: Record<string, string> = {
  ONE_TIME: "One Time",
  WEEKLY: "Weekly",
  BI_WEEKLY: "Bi-Weekly",
  MONTHLY: "Monthly",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const fetchLead = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: LeadDetail }>(
        `/api/leads/${id}`,
        { token },
      );
      setLead(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  if (loading) {
    return (
      <>
        <Header title="Lead Details" />
        <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Header title="Lead Details" />
        <div className="flex items-center justify-center p-12 text-muted-foreground">Lead not found.</div>
      </>
    );
  }

  const location = [lead.address, lead.city, lead.state, lead.zipCode].filter(Boolean).join(", ");

  return (
    <>
      <Header
        title={`${lead.firstName} ${lead.lastName}`}
        description={formatPhone(lead.phone)}
        action={
          <Button variant="outline" size="sm" onClick={() => router.push("/leads")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Top row: Status + Tags */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={statusColors[lead.status] || "default"}>{lead.status}</Badge>
          <Badge variant="secondary">{crmStageLabels[lead.crmStage] || lead.crmStage}</Badge>
          <Badge variant="outline">{lead.source.replace(/_/g, " ")}</Badge>
          {lead.language === "ES" && <Badge variant="outline">Spanish</Badge>}
          {lead.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
              <Tag className="h-3 w-3" /> {tag}
            </span>
          ))}
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Contact Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Contact</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{formatPhone(lead.phone)}</span>
                </div>
                {lead.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.preferredSchedule && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Schedule</span>
                    <span>{lead.preferredSchedule}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Home className="h-4 w-4" /> Property</h3>
              <div className="space-y-2 text-sm">
                {location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-right max-w-[60%]">{location}</span>
                  </div>
                )}
                {lead.propertyType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{lead.propertyType.toLowerCase()}</span>
                  </div>
                )}
                {(lead.bedrooms !== null || lead.bathrooms !== null) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bed / Bath</span>
                    <span>{lead.bedrooms ?? "-"} bed / {lead.bathrooms ?? "-"} bath</span>
                  </div>
                )}
                {lead.sqft !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{lead.sqft.toLocaleString()} sqft</span>
                  </div>
                )}
                {lead.isOccupied !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Occupied</span>
                    <span>{lead.isOccupied ? "Yes" : "No"}</span>
                  </div>
                )}
                {lead.conditionLevel && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span className="capitalize">{lead.conditionLevel.toLowerCase()}</span>
                  </div>
                )}
                {!location && !lead.propertyType && lead.bedrooms === null && (
                  <p className="text-muted-foreground text-center py-2">No property data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Service Request */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Service Request</h3>
              {lead.serviceRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-2">No service request yet</p>
              ) : (
                lead.serviceRequests.map((sr) => (
                  <div key={sr.id} className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span>{serviceTypeLabels[sr.serviceType] || sr.serviceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency</span>
                      <span>{frequencyLabels[sr.frequency] || sr.frequency}</span>
                    </div>
                    {sr.addOns.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Add-ons</span>
                        <span className="text-right max-w-[60%]">{sr.addOns.join(", ")}</span>
                      </div>
                    )}
                    {sr.depositRequired && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deposit</span>
                        <span>${sr.depositAmount ?? 150}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment</span>
                      <Badge variant={sr.paymentStatus === "PAID" ? "success" : "default"}>
                        {sr.paymentStatus}
                      </Badge>
                    </div>
                    {sr.notes && (
                      <div>
                        <span className="text-muted-foreground">Notes: </span>
                        <span>{sr.notes}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calls History */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Phone className="h-4 w-4" /> Call History ({lead.calls.length})
            </h3>
            {lead.calls.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No calls recorded</p>
            ) : (
              <div className="space-y-3">
                {lead.calls.map((call) => (
                  <div key={call.id} className="border rounded-lg p-3">
                    {/* Call header */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{call.direction}</Badge>
                        {call.outcome && (
                          <Badge variant={outcomeColors[call.outcome] || "default"}>{call.outcome}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {call.duration ? formatDuration(call.duration) : "0:00"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(call.createdAt)}</span>
                    </div>

                    {/* Summary always visible */}
                    {call.summary && (
                      <p className="mt-2 text-sm text-muted-foreground">{call.summary}</p>
                    )}

                    {/* Expanded: transcript + recording */}
                    {expandedCall === call.id && (
                      <div className="mt-3 space-y-3">
                        {call.recordingUrl && (
                          <div>
                            <p className="text-xs font-medium mb-1">Recording</p>
                            <audio controls className="w-full h-8" src={call.recordingUrl} />
                          </div>
                        )}
                        {call.transcription && (
                          <div>
                            <p className="text-xs font-medium mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Transcript
                            </p>
                            <div className="bg-muted rounded p-3 text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                              {call.transcription}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {lead.notes && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4" /> Notes
              </h3>
              <p className="text-sm text-muted-foreground">{lead.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
