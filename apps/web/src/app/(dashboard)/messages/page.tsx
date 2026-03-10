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
  { id: "first-contact", label: "First contact — lead left message", body: `Hello, I hope you're doing well. Thank you for reaching out to Sunshine. I noticed your message regarding our cleaning services and I'll be sending you the checklist and pricing details shortly.\nIf you have any questions, feel free to reach out. I'm happy to help.` },
  { id: "request-phone", label: "Request phone number", body: `Hello! Could you please share your phone number so we can communicate more easily? Thank you.` },
  { id: "all-info-received", label: "All information received", body: `Hello, thank you for your message. I received all the details regarding your cleaning request and will be sending the checklist and full information shortly.\nIf you have any questions, please don't hesitate to reach out. I look forward to hearing from you.` },
  { id: "continue-sms", label: "Continue via SMS", body: `Hello! Yes, of course. I'll continue our communication via text message on your phone number for better and faster assistance.` },
  { id: "missed-call", label: "Missed call — collect info", body: `Hi! Thank you for your call.\nCould you please let me know if the space is a house, apartment, or office, along with the square footage or number of bedrooms and bathrooms?\nAlso, are you looking for a deep cleaning, a one-time standard cleaning, or a recurring service (bi-weekly or monthly)?\nI look forward to your response.` },
  { id: "payment-no-deposit", label: "Payment info (no deposit)", body: `Sunshine accepts payment via Zelle, Venmo, or Cash App.\nPlease note that payment is made only after the service is completed.\nWhich method works best for you?` },
  { id: "service-finished", label: "Service finished", body: `Hello! My team has just finished the service. I truly hope you're happy with the cleaning and that everything met your expectations.` },
  { id: "checklist-confirmed", label: "Checklist confirmed with team", body: `Just to keep you informed, my team has been fully briefed and is completely aligned with the checklist and all service details exactly as discussed.\nEverything will be completed with care and attention to detail.\nThank you for your trust.` },
  { id: "payment-followup", label: "Payment follow-up", body: `Hello, I hope you're doing well. I just wanted to kindly follow up to check if the payment has been processed, as I haven't received it yet.\nThank you for your time. I appreciate it.` },
  { id: "payment-deep", label: "Payment — Deep Cleaning (deposit)", body: `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App.\n\nTo secure your appointment, a $150 deposit is required due to high demand. This deposit reserves your date and is non-negotiable.\nThe remaining balance is due upon completion of the service.\n\nCancellations must be made at least 2 days in advance for a full refund. We're happy to assist with rescheduling if needed.\nThank you for your understanding.` },
  { id: "payment-first-regular", label: "Payment — First regular cleaning", body: `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App. Which option works best for you?\n\nPlease note that a $100 cancellation fee applies if the service is canceled within 2 days of the scheduled date. This fee is waived if the service is rescheduled at least 2 days in advance.\nThank you for your understanding.` },
  { id: "payment-info-fixed", label: "Payment details (Venmo/Zelle/PayPal)", body: `Venmo: @sunshinebrazilian\nZelle: sunshinebrazilian@hotmail.com\nPayPal: Sunshine WL Brazilian – sunshine15` },
  { id: "recommend-recurring", label: "Recommend recurring service", body: `I kindly recommend maintaining a regular cleaning schedule at least once a month. This helps preserve the cleanliness of your home and contributes to a healthier living environment.` },
  { id: "thank-you", label: "Thank you (institutional)", body: `Thank you for reaching out and for your interest in Sunshine. We truly appreciate the opportunity to serve you.` },
  { id: "referral-request", label: "Referral request", body: `Hi! I hope you're doing well.\nThank you for choosing Sunshine and being part of our journey. If you're happy with our service, I would truly appreciate your recommendation to friends, family, neighbors, or even on your Facebook page.\nGod bless you and your family.\nWarm regards,\nWelica Nunes` },
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
  const [messageBody, setMessageBody] = useState("");
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
    if (!token || !selectedLeadId || !messageBody.trim()) return;
    setSending(true);
    try {
      await api("/api/messages/send", {
        token,
        method: "POST",
        body: JSON.stringify({ leadId: selectedLeadId, body: messageBody }),
      });
      setShowSendForm(false);
      setSelectedLeadId("");
      setMessageBody("");
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
                <label className="text-sm font-medium">Select Lead</label>
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
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value=""
                  onChange={(e) => {
                    const tpl = messageTemplates.find((t) => t.id === e.target.value);
                    if (tpl) setMessageBody(tpl.body);
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
                <Button onClick={handleSend} disabled={sending || !selectedLeadId || !messageBody.trim()} size="sm">
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
