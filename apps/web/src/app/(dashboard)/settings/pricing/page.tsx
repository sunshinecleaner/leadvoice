"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { DollarSign, Save, Info } from "lucide-react";

interface PricingRate {
  id: string;
  serviceType: "DEEP_CLEAN" | "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  classification: "EASY" | "MEDIUM" | "HARD";
  pricePerRoom: number;
  active: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  DEEP_CLEAN: "Deep Clean",
  MONTHLY: "Monthly",
  BIWEEKLY: "Bi-Weekly",
  WEEKLY: "Weekly",
};

const CLASSIFICATION_LABELS: Record<string, { label: string; rooms: string; example: number }> = {
  EASY:   { label: "Easy",   rooms: "2–3 rooms",  example: 3 },
  MEDIUM: { label: "Medium", rooms: "4–6 rooms",  example: 5 },
  HARD:   { label: "Hard",   rooms: "7+ rooms",   example: 8 },
};

const SERVICE_ORDER = ["DEEP_CLEAN", "MONTHLY", "BIWEEKLY", "WEEKLY"];
const CLASSIFICATION_ORDER = ["EASY", "MEDIUM", "HARD"];

function calcExample(pricePerRoom: number, rooms: number): string {
  const total = rooms * pricePerRoom * 1.18;
  return `$${total.toFixed(2)}`;
}

export default function PricingPage() {
  const { token } = useAuthStore();
  const [rates, setRates] = useState<PricingRate[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ id: string; type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<{ success: boolean; data: PricingRate[] }>("/api/pricing", { token })
      .then((res) => {
        setRates(res.data);
        const initial: Record<string, string> = {};
        res.data.forEach((r) => {
          initial[r.id] = String(r.pricePerRoom);
        });
        setEdited(initial);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const showMessage = (id: string, type: "success" | "error", text: string) => {
    setMessage({ id, type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (rate: PricingRate) => {
    if (!token) return;
    const value = parseFloat(edited[rate.id] || "0");
    if (isNaN(value) || value <= 0) {
      showMessage(rate.id, "error", "Invalid value");
      return;
    }
    setSaving((s) => ({ ...s, [rate.id]: true }));
    try {
      await api(`/api/pricing/${rate.id}`, {
        token,
        method: "PUT",
        body: JSON.stringify({ pricePerRoom: value }),
      });
      setRates((prev) =>
        prev.map((r) => (r.id === rate.id ? { ...r, pricePerRoom: value } : r))
      );
      showMessage(rate.id, "success", "Saved");
    } catch {
      showMessage(rate.id, "error", "Failed to save");
    } finally {
      setSaving((s) => ({ ...s, [rate.id]: false }));
    }
  };

  const grouped = SERVICE_ORDER.reduce<Record<string, PricingRate[]>>((acc, svc) => {
    acc[svc] = CLASSIFICATION_ORDER.map(
      (cls) => rates.find((r) => r.serviceType === svc && r.classification === cls)!
    ).filter(Boolean);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-screen">
      <Header title="Pricing" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-400">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>How pricing works:</strong> Final price = total rooms × price per room × 1.18 (18% margin).
              Total rooms = bedrooms + bathrooms. Classification is automatic: Easy (2–3), Medium (4–6), Hard (7+).
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading rates…</div>
          ) : (
            SERVICE_ORDER.map((svc) => (
              <Card key={svc}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{SERVICE_LABELS[svc]}</CardTitle>
                      <CardDescription className="text-xs">Price per room (before margin)</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {grouped[svc]?.map((rate) => {
                      const cls = CLASSIFICATION_LABELS[rate.classification];
                      const currentValue = parseFloat(edited[rate.id] || "0");
                      const example = calcExample(isNaN(currentValue) ? rate.pricePerRoom : currentValue, cls.example);
                      const isDirty = parseFloat(edited[rate.id]) !== rate.pricePerRoom;

                      return (
                        <div key={rate.id} className="flex items-center gap-3">
                          <div className="w-36">
                            <p className="text-sm font-medium">{cls.label}</p>
                            <p className="text-xs text-muted-foreground">{cls.rooms}</p>
                          </div>
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input
                              type="number"
                              min="1"
                              step="0.01"
                              className="pl-7"
                              value={edited[rate.id] ?? rate.pricePerRoom}
                              onChange={(e) =>
                                setEdited((prev) => ({ ...prev, [rate.id]: e.target.value }))
                              }
                            />
                          </div>
                          <div className="flex-1 text-xs text-muted-foreground">
                            e.g. {cls.example} rooms = <span className="font-medium text-foreground">{example}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {message?.id === rate.id && (
                              <Badge
                                className={
                                  message.type === "success"
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                }
                              >
                                {message.text}
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant={isDirty ? "default" : "outline"}
                              disabled={saving[rate.id] || !isDirty}
                              onClick={() => handleSave(rate)}
                              className="gap-1.5"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {saving[rate.id] ? "Saving…" : "Save"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
