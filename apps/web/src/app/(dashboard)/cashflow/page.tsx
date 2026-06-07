"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Plus, Trash2, DollarSign } from "lucide-react";

interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  paymentMethod?: string;
  notes?: string;
}

interface Summary { income: number; expense: number; net: number }

const CATEGORIES = ["Service", "Supplies", "Payroll", "Marketing", "Equipment", "Fuel", "Other"];
const PAYMENT_METHODS = ["Zelle", "Venmo", "Cash App", "PayPal", "Cash", "Check", "Other"];

const now = new Date();
const EMPTY_FORM = {
  date: now.toISOString().slice(0, 10),
  description: "",
  category: "Service",
  amount: "",
  type: "INCOME" as "INCOME" | "EXPENSE",
  paymentMethod: "",
  notes: "",
};

export default function CashFlowPage() {
  const { token } = useAuthStore();
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));

  const load = () => {
    if (!token) return;
    api<{ success: boolean; data: { entries: CashFlowEntry[]; summary: Summary } }>(
      `/api/cashflow?month=${month}&year=${year}`,
      { token }
    )
      .then((res) => { setEntries(res.data.entries); setSummary(res.data.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token, month, year]);

  const handleSubmit = async () => {
    if (!token || !form.description || !form.amount) return;
    setSaving(true);
    try {
      await api("/api/cashflow", {
        token,
        method: "POST",
        body: JSON.stringify({
          ...form,
          date: new Date(form.date).toISOString(),
          amount: parseFloat(form.amount),
          paymentMethod: form.paymentMethod || undefined,
          notes: form.notes || undefined,
        }),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    await api(`/api/cashflow/${id}`, { token, method: "DELETE" });
    load();
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Cash Flow" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Income", value: summary.income, icon: TrendingUp, color: "text-green-500" },
              { label: "Expenses", value: summary.expense, icon: TrendingDown, color: "text-red-500" },
              { label: "Net", value: summary.net, icon: DollarSign, color: summary.net >= 0 ? "text-green-500" : "text-red-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-lg font-semibold ${color}`}>${Math.abs(value).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={month} onChange={e => setMonth(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, "0");
                  return <option key={m} value={m}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>;
                })}
              </select>
              <Input className="w-24" type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">New Entry</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button size="sm" variant={form.type === "INCOME" ? "default" : "outline"} onClick={() => setForm(f => ({ ...f, type: "INCOME" }))} className="flex-1">Income</Button>
                    <Button size="sm" variant={form.type === "EXPENSE" ? "default" : "outline"} onClick={() => setForm(f => ({ ...f, type: "EXPENSE" }))} className="flex-1">Expense</Button>
                  </div>
                  <Input placeholder="Description *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input className="pl-7" type="number" placeholder="Amount *" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="">Payment method</option>
                    {PAYMENT_METHODS.map(p => <option key={p}>{p}</option>)}
                  </select>
                  <Input className="col-span-2" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button size="sm" disabled={saving || !form.description || !form.amount} onClick={handleSubmit}>{saving ? "Saving…" : "Add"}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entries list */}
          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No entries for this period.</div>
          ) : (
            entries.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {e.type === "INCOME"
                      ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                      : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString()} · {e.category}
                        {e.paymentMethod ? ` · ${e.paymentMethod}` : ""}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold shrink-0 ${e.type === "INCOME" ? "text-green-500" : "text-red-500"}`}>
                      {e.type === "INCOME" ? "+" : "-"}${e.amount.toFixed(2)}
                    </p>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-500 shrink-0" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
