"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Send, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  from: string;
  to: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
  lead: Lead | null;
}

const messageTemplates = [
  // ── Lead qualification ──
  { id: "first-contact", label: "1. First contact — lead reached out", body: `Hello! Thank you for reaching out to Sunshine.\nI'd be happy to assist you and prepare an accurate quote.\n\nTo make sure we allocate the proper team size, time, and pricing, could you please confirm a few details:\n\n• House, apartment, or office?\n• How many bedrooms and bathrooms?\n• Approximate square footage?\n• Is the property occupied or vacant?\n• Is this move-in, move-out, post-construction, or regular cleaning?\n\nService type:\n• One-time standard cleaning\n• Deep cleaning\n• Recurring service (bi-weekly or monthly)\n\nHow would you describe the condition?\n1. Lightly maintained (routine buildup)\n2. Moderate buildup (visible dirt in kitchen/bathrooms)\n3. Heavily soiled (strong buildup, grease, stains)\n\nAdditional areas needed?\n• Inside oven, fridge, cabinets\n• Baseboards, blinds, walls\n• Garage, laundry, organization\n• Pet hair or heavy shedding\n\nOnce I receive this, I'll send your quote and checklist right away.` },
  { id: "request-phone", label: "2. Request phone number", body: `Hello! Could you please share your phone number so we can communicate more easily? Thank you.` },
  { id: "continue-sms", label: "3. Continue via SMS", body: `Hello! Yes, of course. I'll continue our communication via text message on your phone number for better and faster assistance.` },
  { id: "missed-call", label: "4. Missed call — collect info", body: `Hi! Thank you for your call.\nCould you please let me know if the space is a house, apartment, or office, along with the square footage or number of bedrooms and bathrooms?\nAlso, are you looking for a deep cleaning, a one-time standard cleaning, or a recurring service (bi-weekly or monthly)?\nI look forward to your response.` },
  { id: "heavily-soiled", label: "5. Heavily soiled property notice", body: `Thank you for confirming the condition.\n\nFor heavily soiled properties, we may need extended time and possibly a larger team to ensure proper results.\n\nFinal pricing may require confirmation after assessment, but I will provide a detailed estimate based on the information you shared.\n\nOur goal is transparency and delivering the highest quality service possible.` },
  { id: "price-before-info", label: "6. Client asks price before details", body: `I'd love to send your estimate.\n\nSince cleaning pricing depends directly on property size and current condition, I just need the details mentioned above to avoid underquoting or surprises later.\n\nAs soon as I receive that, I'll provide your quote immediately.` },
  { id: "followup-no-reply", label: "7. Follow-up — no reply", body: `Hello! Just following up regarding your cleaning request.\n\nI'm ready to prepare your quote — I just need the property details and condition level to move forward.\n\nOnce confirmed, I can also check availability and secure your preferred date.\n\nLooking forward to your reply.` },
  // ── Qualification complete ──
  { id: "all-info-received", label: "8. All info received — pre-quote", body: `Perfect. Thank you for the information.\n\nBased on what you described, I'll prepare your detailed estimate and checklist.\n\nPlease note:\n• For deep cleaning, a deposit is required to secure the appointment due to high demand.\n• Cancellations must be made at least 2 days in advance to avoid fees.\n• Final pricing reflects the actual scope and condition of the property.\n\nI'll send everything shortly.` },
  // ── Payment ──
  { id: "payment-deep", label: "9. Payment — Deep Cleaning (deposit)", body: `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App.\n\nTo secure your appointment, a $150 deposit is required due to high demand. This deposit reserves your date and is non-negotiable.\nThe remaining balance is due upon completion of the service.\n\nCancellations must be made at least 2 days in advance for a full refund. We're happy to assist with rescheduling if needed.\nThank you for your understanding.` },
  { id: "payment-first-regular", label: "10. Payment — First regular cleaning", body: `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App. Which option works best for you?\n\nPlease note that a $100 cancellation fee applies if the service is canceled within 2 days of the scheduled date. This fee is waived if the service is rescheduled at least 2 days in advance.\nThank you for your understanding.` },
  { id: "payment-no-deposit", label: "11. Payment info (no deposit)", body: `Sunshine accepts payment via Zelle, Venmo, or Cash App.\nPlease note that payment is made only after the service is completed.\nWhich method works best for you?` },
  { id: "payment-info-fixed", label: "12. Payment details (accounts)", body: `Venmo: @sunshinebrazilian\nZelle: sunshinebrazilian@hotmail.com\nPayPal: Sunshine WL Brazilian – sunshine15` },
  // ── Service execution ──
  { id: "checklist-confirmed", label: "13. Checklist confirmed with team", body: `Just to keep you informed, my team has been fully briefed and is completely aligned with the checklist and all service details exactly as discussed.\nEverything will be completed with care and attention to detail.\nThank you for your trust.` },
  { id: "service-finished", label: "14. Service finished", body: `Hello! My team has just finished the service. I truly hope you're happy with the cleaning and that everything met your expectations.` },
  // ── Post-service ──
  { id: "payment-followup", label: "15. Payment follow-up", body: `Hello, I hope you're doing well. I just wanted to kindly follow up to check if the payment has been processed, as I haven't received it yet.\nThank you for your time. I appreciate it.` },
  { id: "thank-you", label: "16. Thank you (payment received)", body: `Thank you for reaching out and for your interest in Sunshine. We truly appreciate the opportunity to serve you.` },
  { id: "recommend-recurring", label: "17. Recommend recurring service", body: `I kindly recommend maintaining a regular cleaning schedule at least once a month. This helps preserve the cleanliness of your home and contributes to a healthier living environment.` },
  { id: "referral-request", label: "18. Referral request", body: `Hi! I hope you're doing well.\nThank you for choosing Sunshine and being part of our journey. If you're happy with our service, I would truly appreciate your recommendation to friends, family, neighbors, or even on your Facebook page.\nGod bless you and your family.\nWarm regards,\nWelica Nunes` },
];

const statusColors: Record<string, string> = {
  SENT: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  DELIVERED: "bg-green-500/10 text-green-500 border-green-500/20",
  RECEIVED: "bg-green-500/10 text-green-500 border-green-500/20",
  FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
  QUEUED: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export default function MessagesPage() {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [sendMode, setSendMode] = useState<"lead" | "phone">("lead");
  const [messageBody, setMessageBody] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ messages: Message[] }>("/api/messages", { token });
      setMessages(res.messages || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api<{ data: Lead[] }>("/api/leads?limit=200", { token });
      setLeads(res.data || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleOpenSendForm = () => {
    setShowSendForm(true);
    fetchLeads();
  };

  const handleSend = async () => {
    if (!token || !messageBody.trim()) return;
    if (sendMode === "lead" && !selectedLeadId) return;
    if (sendMode === "phone" && !manualPhone.trim()) return;
    setSending(true);
    try {
      const payload: Record<string, string> = { body: messageBody };
      if (sendMode === "lead") {
        payload.leadId = selectedLeadId;
      } else {
        payload.phone = manualPhone.startsWith("+") ? manualPhone : `+${manualPhone}`;
      }
      if (selectedTemplateId) payload.templateId = selectedTemplateId;
      await api("/api/messages/send", {
        token,
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowSendForm(false);
      setSelectedLeadId("");
      setManualPhone("");
      setMessageBody("");
      setSelectedTemplateId("");
      setSendMode("lead");
      fetchMessages();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.phone.includes(q)
    );
  });

  return (
    <>
      <Header
        title="Messages"
        description="SMS messages sent and received"
        action={
          <Button size="sm" onClick={handleOpenSendForm}>
            <Send className="mr-2 h-4 w-4" /> Send SMS
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        {/* Send SMS Form */}
        {showSendForm && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Send SMS</h3>
                <button onClick={() => setShowSendForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Send to</label>
                <div className="flex gap-2">
                  <Button
                    variant={sendMode === "lead" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSendMode("lead"); fetchLeads(); }}
                  >
                    Lead
                  </Button>
                  <Button
                    variant={sendMode === "phone" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendMode("phone")}
                  >
                    Phone Number
                  </Button>
                </div>
                {sendMode === "lead" ? (
                  <>
                    <Input
                      placeholder="Search leads by name or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedLeadId}
                      onChange={(e) => setSelectedLeadId(e.target.value)}
                    >
                      <option value="">Choose a lead...</option>
                      {filteredLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.firstName} {lead.lastName} — {lead.phone}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <Input
                    placeholder="+1 (470) 555-1234"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const tpl = messageTemplates.find((t) => t.id === e.target.value);
                    if (tpl) {
                      setMessageBody(tpl.body);
                      setSelectedTemplateId(tpl.id);
                    }
                  }}
                >
                  <option value="">Use a template...</option>
                  {messageTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.label}</option>
                  ))}
                </select>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-none"
                  placeholder="Type your message or select a template above..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  maxLength={1600}
                />
                <p className="text-xs text-muted-foreground text-right">{messageBody.length}/1600</p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSend} disabled={sending || (sendMode === "lead" ? !selectedLeadId : !manualPhone.trim()) || !messageBody.trim()} size="sm">
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Direction</th>
                    <th className="px-4 py-3 text-left font-medium">Lead</th>
                    <th className="px-4 py-3 text-left font-medium">Message</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Loading...
                      </td>
                    </tr>
                  ) : messages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        No messages yet. Send your first SMS to get started.
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg) => (
                      <tr key={msg.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {msg.direction === "INBOUND" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
                            )}
                            <Badge variant="outline">
                              {msg.direction === "INBOUND" ? "Received" : "Sent"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {msg.lead ? (
                            <div>
                              <div className="font-medium">
                                {msg.lead.firstName} {msg.lead.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">{msg.lead.phone}</div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground">
                              {msg.direction === "INBOUND" ? msg.from : msg.to}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate">{msg.body}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusColors[msg.status] || ""}>
                            {msg.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(msg.sentAt || msg.createdAt)}
                        </td>
                      </tr>
                    ))
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
