"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" description="Manage your account and system settings" />
      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">VAPI Configuration</CardTitle>
                <CardDescription>Configure your VAPI account for AI voice agents</CardDescription>
              </div>
              <Badge variant="outline">Voice AI</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">VAPI API Key</label>
              <Input type="password" placeholder="Your VAPI API key" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number ID</label>
              <Input placeholder="VAPI phone number ID" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Assistant ID</label>
              <Input placeholder="VAPI assistant ID" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Webhook Secret</label>
              <Input type="password" placeholder="For verifying VAPI webhooks" />
            </div>
            <Button>Save VAPI Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Twilio Configuration</CardTitle>
                <CardDescription>Phone numbers and call infrastructure (connected via VAPI)</CardDescription>
              </div>
              <Badge variant="outline">Telephony</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account SID</label>
              <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Auth Token</label>
              <Input type="password" placeholder="Your Twilio auth token" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input placeholder="+1234567890" />
            </div>
            <Button>Save Twilio Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">N8N Integration</CardTitle>
                <CardDescription>Workflow automation webhook URL</CardDescription>
              </div>
              <Badge variant="outline">Automation</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">N8N Webhook URL</label>
              <Input placeholder="http://n8n:5678" />
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook endpoints available for N8N:<br />
              POST /api/webhooks/n8n — Send actions (create_lead, update_lead, trigger_call)<br />
              POST /api/webhooks/inbound — Receive leads from external sources
            </p>
            <Button>Save N8N Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calling Rules</CardTitle>
            <CardDescription>Set default calling windows and retry policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Calling Window Start</label>
                <Input type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Calling Window End</label>
                <Input type="time" defaultValue="17:00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Retries</label>
                <Input type="number" defaultValue={3} min={0} max={10} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Retry Delay (min)</label>
                <Input type="number" defaultValue={60} min={1} />
              </div>
            </div>
            <Button>Save Calling Rules</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
