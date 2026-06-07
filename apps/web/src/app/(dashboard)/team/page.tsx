"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { HardHat, Plus, Pencil, X, Check, Phone, Mail, DollarSign } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  costPerClean?: number;
  active: boolean;
}

const EMPTY_FORM = { name: "", phone: "", email: "", address: "", emergencyContact: "", costPerClean: "" };

export default function TeamPage() {
  const { token } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    api<{ success: boolean; data: TeamMember[] }>("/api/team", { token })
      .then((res) => setMembers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSubmit = async () => {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        emergencyContact: form.emergencyContact || undefined,
        costPerClean: form.costPerClean ? parseFloat(form.costPerClean) : undefined,
      };

      if (editing) {
        await api(`/api/team/${editing}`, { token, method: "PUT", body: JSON.stringify(body) });
        showMsg("success", "Updated");
      } else {
        await api("/api/team", { token, method: "POST", body: JSON.stringify(body) });
        showMsg("success", "Added");
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditing(null);
      load();
    } catch {
      showMsg("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m: TeamMember) => {
    setForm({
      name: m.name,
      phone: m.phone ?? "",
      email: m.email ?? "",
      address: m.address ?? "",
      emergencyContact: m.emergencyContact ?? "",
      costPerClean: m.costPerClean != null ? String(m.costPerClean) : "",
    });
    setEditing(m.id);
    setShowForm(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!token) return;
    await api(`/api/team/${id}`, { token, method: "DELETE" });
    load();
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Team" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{members.filter(m => m.active).length} active members</p>
            <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Add Member
            </Button>
          </div>

          {msg && (
            <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === "success" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
              {msg.text}
            </div>
          )}

          {showForm && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{editing ? "Edit Member" : "New Team Member"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <Input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  <Input placeholder="Emergency contact" value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input className="pl-7" placeholder="Cost per clean" type="number" value={form.costPerClean} onChange={e => setForm(f => ({ ...f, costPerClean: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
                  <Button size="sm" disabled={saving || !form.name.trim()} onClick={handleSubmit}>
                    {saving ? "Saving…" : editing ? "Update" : "Add"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <HardHat className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No team members yet.</p>
            </div>
          ) : (
            members.map((m) => (
              <Card key={m.id} className={!m.active ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{m.name}</p>
                        {!m.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                        {m.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                        {m.costPerClean != null && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${m.costPerClean}/clean</span>}
                        {m.emergencyContact && <span>Emergency: {m.emergencyContact}</span>}
                      </div>
                    </div>
                    {m.active && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDeactivate(m.id)}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
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
