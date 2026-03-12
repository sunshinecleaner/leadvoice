"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CalendarDays, RefreshCw, Link2, Link2Off, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  color: string;
  textColor?: string;
  extendedProps?: {
    leadId?: string;
    serviceRequestId?: string;
    source: "leadvoice" | "google";
    serviceType?: string;
    googleLink?: string;
  };
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  crmStage: string;
  serviceRequests: ServiceRequest[];
}

interface ServiceRequest {
  id: string;
  serviceType: string;
  scheduledDate: string | null;
  googleCalendarLink: string | null;
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  start: { dateTime: string };
  end?: { dateTime: string };
  colorId?: string;
  htmlLink?: string;
  extendedProperties?: {
    private?: {
      leadvoiceLeadId?: string;
      leadvoiceServiceRequestId?: string;
    };
  };
}

interface GCalStatus {
  connected: boolean;
  email?: string;
  calendarName?: string;
}

// ── Color maps ────────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DEEP_CLEANING:      { bg: "#ef4444", text: "#fff", label: "Deep Cleaning" },
  STANDARD_CLEANING:  { bg: "#22c55e", text: "#fff", label: "Standard Cleaning" },
  RECURRING:          { bg: "#eab308", text: "#000", label: "Recurring" },
  MOVE_IN:            { bg: "#3b82f6", text: "#fff", label: "Move In" },
  MOVE_OUT:           { bg: "#f97316", text: "#fff", label: "Move Out" },
  POST_CONSTRUCTION:  { bg: "#8b5cf6", text: "#fff", label: "Post Construction" },
};

const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
  "5": "#f6c026", "6": "#f5511d", "7": "#039be5", "8": "#616161",
  "9": "#3f51b5", "10": "#0b8043", "11": "#d50000",
};

// ── View types ────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "day" | "list";

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Event pill component ──────────────────────────────────────────────────────

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate mb-0.5 hover:opacity-80 transition-opacity"
      style={{ backgroundColor: event.color, color: event.textColor ?? "#fff" }}
      title={event.title}
    >
      {event.extendedProps?.source === "google" && (
        <span className="mr-1 opacity-70">G</span>
      )}
      {formatTime(event.start)} {event.title}
    </button>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const today = new Date();
  const firstDay = startOfMonth(currentDate);
  const lastDay = endOfMonth(currentDate);
  const startDate = startOfWeek(firstDay);

  const weeks: Date[][] = [];
  let current = new Date(startDate);
  while (current <= lastDay || weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    if (current > lastDay && weeks.length >= 4) break;
  }

  const eventsOnDay = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.start), date));

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Weeks */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, today);
              const dayEvents = eventsOnDay(day);
              return (
                <div
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={[
                    "border-b border-r min-h-[100px] p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                    !isCurrentMonth && "opacity-40",
                  ].filter(Boolean).join(" ")}
                >
                  <div className={[
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                  ].join(" ")}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventPill key={event.id} event={event} onClick={() => onEventClick(event)} />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const today = new Date();
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsOnDay = (date: Date) =>
    events.filter((e) => isSameDay(new Date(e.start), date));

  return (
    <div className="grid grid-cols-7 gap-px bg-border h-full">
      {days.map((day, i) => {
        const isToday = isSameDay(day, today);
        const dayEvents = eventsOnDay(day);
        return (
          <div key={i} className="bg-background p-2">
            <div className={[
              "text-center mb-2 pb-2 border-b",
            ].join(" ")}>
              <div className="text-xs text-muted-foreground">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
              <div className={[
                "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-semibold",
                isToday ? "bg-primary text-primary-foreground" : "",
              ].join(" ")}>
                {day.getDate()}
              </div>
            </div>
            <div className="space-y-1">
              {dayEvents.map((event) => (
                <EventPill key={event.id} event={event} onClick={() => onEventClick(event)} />
              ))}
              {dayEvents.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mb-4 opacity-30" />
        <p>No events in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {sorted.map((event) => (
        <button
          key={event.id}
          onClick={() => onEventClick(event)}
          className="w-full text-left flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div
            className="w-1 rounded-full self-stretch flex-shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{event.title}</span>
              {event.extendedProps?.source === "google" && (
                <Badge variant="outline" className="text-xs">Google</Badge>
              )}
              {event.extendedProps?.serviceType && (
                <Badge variant="secondary" className="text-xs">
                  {SERVICE_COLORS[event.extendedProps.serviceType]?.label ?? event.extendedProps.serviceType}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDateLabel(new Date(event.start))} at {formatTime(event.start)}
              {event.end && ` — ${formatTime(event.end)}`}
            </div>
          </div>
          {event.extendedProps?.googleLink && (
            <a
              href={event.extendedProps.googleLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
              title="Open in Google Calendar"
            >
              <Link2 className="h-4 w-4" />
            </a>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Event detail modal ────────────────────────────────────────────────────────

function EventModal({
  event,
  onClose,
  onNavigate,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onNavigate: (leadId: string) => void;
}) {
  const serviceInfo = event.extendedProps?.serviceType
    ? SERVICE_COLORS[event.extendedProps.serviceType]
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <div>
            <h3 className="font-semibold text-lg leading-tight">{event.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateLabel(new Date(event.start))} at {formatTime(event.start)}
              {event.end && ` — ${formatTime(event.end)}`}
            </p>
          </div>
        </div>

        {serviceInfo && (
          <div className="mb-3">
            <Badge style={{ backgroundColor: event.color, color: event.textColor ?? "#fff" }}>
              {serviceInfo.label}
            </Badge>
          </div>
        )}

        {event.extendedProps?.source === "google" && (
          <p className="text-xs text-muted-foreground mb-3">From Google Calendar</p>
        )}

        <div className="flex gap-2 mt-4">
          {event.extendedProps?.leadId && (
            <Button
              size="sm"
              onClick={() => onNavigate(event.extendedProps!.leadId!)}
            >
              View Lead
            </Button>
          )}
          {event.extendedProps?.googleLink && (
            <Button size="sm" variant="outline" asChild>
              <a href={event.extendedProps.googleLink} target="_blank" rel="noopener noreferrer">
                Open in Google Calendar
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [gcStatus, setGcStatus] = useState<GCalStatus>({ connected: false });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [connectingGc, setConnectingGc] = useState(false);

  // Handle OAuth redirect params
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      checkGcStatus();
    }
  }, [searchParams]);

  const checkGcStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api<{ success: boolean; data: GCalStatus }>("/api/google-calendar/status", { token });
      setGcStatus(res.data);
    } catch {
      setGcStatus({ connected: false });
    }
  }, [token]);

  useEffect(() => {
    checkGcStatus();
  }, [checkGcStatus]);

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();

    const merged: CalendarEvent[] = [];

    try {
      // Fetch scheduled leads from API
      const params = new URLSearchParams({ limit: "200", page: "1" });
      const leadsRes = await api<{ success: boolean; data: Lead[] }>(`/api/leads?${params}`, { token });

      for (const lead of leadsRes.data ?? []) {
        for (const sr of lead.serviceRequests ?? []) {
          if (!sr.scheduledDate) continue;
          const colorInfo = SERVICE_COLORS[sr.serviceType] ?? { bg: "#6366f1", text: "#fff" };
          merged.push({
            id: `sr-${sr.id}`,
            title: `${sr.serviceType.replace(/_/g, " ")} — ${lead.firstName} ${lead.lastName}`,
            start: sr.scheduledDate,
            end: new Date(new Date(sr.scheduledDate).getTime() + 2 * 60 * 60 * 1000).toISOString(),
            color: colorInfo.bg,
            textColor: colorInfo.text,
            extendedProps: {
              leadId: lead.id,
              serviceRequestId: sr.id,
              source: "leadvoice",
              serviceType: sr.serviceType,
              googleLink: sr.googleCalendarLink ?? undefined,
            },
          });
        }
      }
    } catch {
      // Non-fatal — show what we can
    }

    // Fetch Google Calendar events if connected
    if (gcStatus.connected) {
      try {
        const gcParams = new URLSearchParams({ timeMin, timeMax });
        const gcRes = await api<{ success: boolean; data: GoogleCalendarEvent[] }>(
          `/api/google-calendar/events?${gcParams}`,
          { token }
        );

        for (const gce of gcRes.data ?? []) {
          // Skip events that are already represented as LeadVoice events
          const srId = gce.extendedProperties?.private?.leadvoiceServiceRequestId;
          if (srId && merged.some((e) => e.extendedProps?.serviceRequestId === srId)) continue;

          const color = gce.colorId ? (GOOGLE_COLOR_MAP[gce.colorId] ?? "#4285f4") : "#4285f4";
          merged.push({
            id: `gcal-${gce.id}`,
            title: gce.summary,
            start: gce.start.dateTime,
            end: gce.end?.dateTime,
            color,
            textColor: "#fff",
            extendedProps: {
              leadId: gce.extendedProperties?.private?.leadvoiceLeadId,
              serviceRequestId: srId,
              source: "google",
              googleLink: gce.htmlLink,
            },
          });
        }
      } catch {
        // Google Calendar fetch failed — show LeadVoice events only
      }
    }

    setEvents(merged);
    setLoading(false);
  }, [token, currentDate, gcStatus.connected]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleConnectGoogle = async () => {
    if (!token) return;
    setConnectingGc(true);
    try {
      const res = await api<{ success: boolean; data: { url: string } }>("/api/google-calendar/auth/url", { token });
      window.location.href = res.data.url;
    } catch {
      setConnectingGc(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!token) return;
    try {
      await api("/api/google-calendar/auth/disconnect", { token, method: "DELETE" });
      setGcStatus({ connected: false });
      fetchEvents();
    } catch {}
  };

  const navigate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + direction);
      else if (view === "week") d.setDate(d.getDate() + direction * 7);
      else if (view === "day") d.setDate(d.getDate() + direction);
      else d.setMonth(d.getMonth() + direction);
      return d;
    });
  };

  const headerLabel = () => {
    if (view === "month") return formatMonthYear(currentDate);
    if (view === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "day") return formatDateLabel(currentDate);
    return formatMonthYear(currentDate);
  };

  const viewEvents = () => {
    if (view === "day") return events.filter((e) => isSameDay(new Date(e.start), currentDate));
    if (view === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 7);
      return events.filter((e) => {
        const d = new Date(e.start);
        return d >= ws && d < we;
      });
    }
    return events;
  };

  return (
    <>
      <Header
        title="Calendar"
        description={`${events.length} scheduled events`}
        action={
          <div className="flex items-center gap-2">
            {gcStatus.connected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="hidden sm:inline">{gcStatus.email ?? "Google Calendar"}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnectGoogle}>
                  <Link2Off className="mr-1.5 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleConnectGoogle} disabled={connectingGc}>
                <Link2 className="mr-1.5 h-4 w-4" />
                {connectingGc ? "Connecting..." : "Connect Google Calendar"}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => fetchEvents()} title="Refresh">
              <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            </Button>
          </div>
        }
      />

      <div className="flex flex-col h-[calc(100vh-4rem)] p-4 gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="font-semibold text-lg flex-1">{headerLabel()}</h2>

          {/* View switcher */}
          <div className="flex rounded-md border overflow-hidden">
            {(["month", "week", "day", "list"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  "px-3 py-1.5 text-sm font-medium capitalize border-r last:border-r-0 transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(SERVICE_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.bg }} />
              <span className="text-xs text-muted-foreground">{val.label}</span>
            </div>
          ))}
          {gcStatus.connected && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#4285f4]" />
              <span className="text-xs text-muted-foreground">Google Calendar</span>
            </div>
          )}
        </div>

        {/* Google Calendar connect prompt */}
        {!gcStatus.connected && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-4 py-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">Connect Google Calendar</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sync scheduled cleanings to your Google Calendar. Changes made in Google Calendar will automatically update the schedule here.
                </p>
              </div>
              <Button size="sm" onClick={handleConnectGoogle} disabled={connectingGc}>
                {connectingGc ? "Connecting..." : "Connect"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Calendar view */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 h-full">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading events...
              </div>
            ) : view === "month" ? (
              <MonthView
                currentDate={currentDate}
                events={events}
                onDayClick={(date) => { setCurrentDate(date); setView("day"); }}
                onEventClick={setSelectedEvent}
              />
            ) : view === "week" ? (
              <WeekView
                currentDate={currentDate}
                events={viewEvents()}
                onEventClick={setSelectedEvent}
              />
            ) : view === "day" ? (
              <div className="p-4">
                <h3 className="font-semibold mb-4">{formatDateLabel(currentDate)}</h3>
                {viewEvents().length === 0 ? (
                  <div className="text-center text-muted-foreground py-16">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No events scheduled for this day</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {viewEvents()
                      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                      .map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full text-left flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-1 rounded-full h-10 flex-shrink-0" style={{ backgroundColor: event.color }} />
                          <div>
                            <div className="font-medium text-sm">{event.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(event.start)}{event.end && ` — ${formatTime(event.end)}`}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <ListView events={viewEvents()} onEventClick={setSelectedEvent} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onNavigate={(leadId) => {
            setSelectedEvent(null);
            router.push(`/leads/${leadId}`);
          }}
        />
      )}
    </>
  );
}
