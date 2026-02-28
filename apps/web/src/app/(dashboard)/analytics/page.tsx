"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <>
      <Header title="Analytics" description="Performance metrics and insights" />
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Volume (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Charts will be displayed here after Recharts integration.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Lead conversion funnel visualization.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Campaign comparison metrics.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Call Outcomes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Distribution of call outcomes.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
