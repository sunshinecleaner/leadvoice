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
import {
  User,
  Building2,
  Phone,
  Globe,
  ExternalLink,
  Lock,
  Bell,
  Clock,
  DollarSign,
  RefreshCw,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

interface ServiceBalance {
  service: string;
  status: "active" | "inactive" | "error";
  balance?: string;
  currency?: string;
  link?: string;
}

function StatusBadge({ status }: { status?: "active" | "inactive" | "error" }) {
  if (status === "active") {
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>;
  }
  if (status === "error") {
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Error</Badge>;
  }
  return <Badge variant="outline">Inactive</Badge>;
}

export default function SettingsPage() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [balances, setBalances] = useState<ServiceBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const fetchBalances = () => {
    if (!token) return;
    setLoadingBalances(true);
    api<{ success: boolean; data: ServiceBalance[] }>("/api/integrations/balances", { token })
      .then((res) => setBalances(res.data))
      .catch(() => {})
      .finally(() => setLoadingBalances(false));
  };

  useEffect(() => {
    if (token) {
      api<{ success: boolean; data: UserProfile }>("/api/auth/me", { token })
        .then((res) => {
          setProfile(res.data);
          setName(res.data.name);
          setEmail(res.data.email);
        })
        .catch(() => {});
      fetchBalances();
    }
  }, [token]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleUpdateProfile = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await api("/api/auth/profile", {
        token,
        method: "PATCH",
        body: JSON.stringify({ name, email }),
      });
      showMessage("success", "Profile updated successfully");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      showMessage("error", "Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("error", "Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await api("/api/auth/change-password", {
        token,
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showMessage("success", "Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <Header title="Settings" description="Manage your profile, company info, and preferences" />
      <div className="p-6 max-w-2xl space-y-6">
        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.type === "success"
                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                : "bg-red-500/10 text-red-500 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ─── Profile ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Your personal account information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Role: <Badge variant="outline" className="ml-1">{profile?.role || user?.role || "AGENT"}</Badge>
              </div>
              <Button onClick={handleUpdateProfile} disabled={saving} size="sm">
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Change Password ─────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-500/10">
                <Lock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base">Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
                size="sm"
                variant="outline"
              >
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Company Info ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/10">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Company</CardTitle>
                <CardDescription>Sunshine WL Brazilian Cleaning Service</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Founded</p>
                <p className="font-medium">2015</p>
              </div>
              <div>
                <p className="text-muted-foreground">Owner</p>
                <p className="font-medium">Welica Nunes</p>
              </div>
              <div>
                <p className="text-muted-foreground">Headquarters</p>
                <p className="font-medium">Marietta, GA</p>
              </div>
              <div>
                <p className="text-muted-foreground">Service Areas</p>
                <p className="font-medium">GA, TX, MA, FL</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Connected Services ──────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-500/10">
                  <Globe className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Connected Services</CardTitle>
                  <CardDescription>External platforms linked to LeadVoice</CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBalances}
                disabled={loadingBalances}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${loadingBalances ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Twilio */}
            {(() => {
              const twilio = balances.find((b) => b.service === "Twilio");
              return (
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Twilio</p>
                      <p className="text-xs text-muted-foreground">+1 (470) 888-4921</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {twilio?.balance && (
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <DollarSign className="h-3 w-3" />
                        {twilio.balance} {twilio.currency}
                      </span>
                    )}
                    <StatusBadge status={twilio?.status} />
                  </div>
                </div>
              );
            })()}

            {/* VAPI */}
            {(() => {
              const vapi = balances.find((b) => b.service === "VAPI");
              return (
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">VAPI</p>
                      <p className="text-xs text-muted-foreground">SunnyBee AI Assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vapi?.balance && (
                      <span className="flex items-center gap-1 text-xs font-medium">
                        <DollarSign className="h-3 w-3" />
                        {vapi.balance} {vapi.currency}
                      </span>
                    )}
                    <a
                      href="https://dashboard.vapi.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Dashboard <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* OpenAI */}
            {(() => {
              const openai = balances.find((b) => b.service === "OpenAI");
              return (
                <div className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">OpenAI</p>
                      <p className="text-xs text-muted-foreground">AI data extraction (gpt-4o-mini)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={openai?.status} />
                    <a
                      href="https://platform.openai.com/usage"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Usage <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* N8N */}
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">N8N Workflows</p>
                  <p className="text-xs text-muted-foreground">Automation engine</p>
                </div>
              </div>
              <a
                href="https://workflow.sunshinebrazilian.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* ─── Preferences ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Preferences</CardTitle>
                <CardDescription>System defaults and notification settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Timezone</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive alerts for qualified leads</p>
              </div>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">On</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
