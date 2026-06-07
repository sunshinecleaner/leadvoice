"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Users2, Phone, MapPin, Calendar, DollarSign, Repeat } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  frequency?: string;
  serviceType?: string;
  estimatedAmount?: number;
  scheduledDate?: string;
  teamMember?: { name: string } | null;
  paymentStatus?: string;
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  BI_WEEKLY: "Bi-Weekly",
  MONTHLY: "Monthly",
};

const FREQ_COLORS: Record<string, string> = {
  WEEKLY: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  BI_WEEKLY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  MONTHLY: "bg-green-500/10 text-green-500 border-green-500/20",
};

const SERVICE_LABELS: Record<string, string> = {
  DEEP_CLEANING: "Deep Clean",
  STANDARD_CLEANING: "Standard",
  RECURRING: "Recurring",
  MOVE_IN: "Move In",
  MOVE_OUT: "Move Out",
};

export default function ClientsPage() {
  const { token } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<{ success: boolean; data: Client[] }>("/api/clients", { token })
      .then((res) => setClients(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col h-screen">
      <Header title="Clients" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Active recurring clients — {clients.length} total
            </p>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading clients…</div>
          ) : clients.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Users2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No recurring clients yet.</p>
              <p className="text-xs mt-1">Clients appear here when a lead has an active recurring service request.</p>
            </div>
          ) : (
            clients.map((client) => (
              <Card key={client.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{client.name}</p>
                        {client.frequency && (
                          <Badge className={FREQ_COLORS[client.frequency] ?? ""}>
                            <Repeat className="h-3 w-3 mr-1" />
                            {FREQ_LABELS[client.frequency] ?? client.frequency}
                          </Badge>
                        )}
                        {client.serviceType && (
                          <Badge variant="outline">{SERVICE_LABELS[client.serviceType] ?? client.serviceType}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{client.phone}
                          </span>
                        )}
                        {(client.city || client.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{[client.city, client.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {client.scheduledDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next: {new Date(client.scheduledDate).toLocaleDateString()}
                          </span>
                        )}
                        {client.teamMember && (
                          <span className="flex items-center gap-1">
                            👤 {client.teamMember.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {client.estimatedAmount != null && (
                        <p className="text-lg font-semibold flex items-center gap-1 justify-end">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          {client.estimatedAmount.toFixed(2)}
                        </p>
                      )}
                      {client.paymentStatus && (
                        <p className="text-xs text-muted-foreground">{client.paymentStatus}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
