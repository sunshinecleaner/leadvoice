"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Plug, Webhook } from "lucide-react";

const integrations = [
  {
    name: "Twilio",
    description: "Voice calls, SMS, and phone number management",
    icon: Phone,
    status: "Configure",
  },
  {
    name: "HubSpot",
    description: "Sync leads and contacts with HubSpot CRM",
    icon: MessageSquare,
    status: "Connect",
  },
  {
    name: "Salesforce",
    description: "Bidirectional sync with Salesforce",
    icon: Plug,
    status: "Connect",
  },
  {
    name: "Webhooks",
    description: "Send events to external systems via webhooks",
    icon: Webhook,
    status: "Configure",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <Header title="Integrations" description="Connect with external services" />
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.name}>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <integration.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </div>
                <Badge variant="outline">Not connected</Badge>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm">
                  {integration.status}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
