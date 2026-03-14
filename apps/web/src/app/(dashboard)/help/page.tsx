"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  ChevronDown,
  Search,
  LayoutDashboard,
  Users,
  Phone,
  Megaphone,
  MessageSquare,
  CalendarDays,
  BarChart3,
  Settings,
  HelpCircle,
} from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  title: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const faqSections: FaqSection[] = [
  {
    title: "Getting Started",
    icon: LayoutDashboard,
    items: [
      {
        question: "How do I log in?",
        answer:
          "Navigate to the login page and enter your email and password. Default credentials are provided by your administrator. After logging in, you will be redirected to the Dashboard.",
      },
      {
        question: "How do I navigate the dashboard?",
        answer:
          "Use the sidebar on the left to navigate between sections: Dashboard, Leads, Campaigns, Calls, Messages, Calendar, Analytics, and Settings. The Dashboard shows your key metrics at a glance.",
      },
      {
        question: "What does each metric on the Dashboard mean?",
        answer:
          "Total Leads: All leads in the system. Total Calls: Number of completed calls. Active Campaigns: Currently running campaigns. Conversion Rate: Percentage of leads converted to customers. Avg Duration: Average call length. Calls Today: Calls made today.",
      },
    ],
  },
  {
    title: "Managing Leads",
    icon: Users,
    items: [
      {
        question: "How do I add a new lead?",
        answer:
          'Click the "Add Lead" button on the Leads page. Fill in the lead\'s information: first name, last name, phone number, email, and any notes. Click "Save" to create the lead.',
      },
      {
        question: "How do I import leads from a CSV file?",
        answer:
          'Click the "Import CSV" button on the Leads page. Your CSV file should have columns: firstName, lastName, phone, email, notes. Select your file and click "Upload". The system will create leads for each row.',
      },
      {
        question: "How do I view a lead's details?",
        answer:
          "Click on any lead in the Leads table to view their full profile. You'll see their contact information, property details, service requests, call history, and notes.",
      },
      {
        question: "What are the lead statuses?",
        answer:
          "NEW: Just added. CONTACTED: Has been called. QUALIFIED: Shows interest and fits criteria. CONVERTED: Became a customer. LOST: No longer interested or unreachable.",
      },
      {
        question: "What is the CRM Pipeline?",
        answer:
          "The CRM pipeline tracks a lead through 11 stages from initial contact to closed deal: New Lead → First Contact → Qualified → Quote Sent → Follow Up → Negotiation → Scheduled → Deposit → Confirmed → Completed → Closed Won.",
      },
    ],
  },
  {
    title: "Calls & SunnyBee AI",
    icon: Phone,
    items: [
      {
        question: "What is SunnyBee?",
        answer:
          "SunnyBee is your AI calling assistant. It makes automated outbound calls to leads, has natural conversations in English, and extracts key information like property details, service needs, and scheduling preferences.",
      },
      {
        question: "How does a call work?",
        answer:
          "When a call is initiated, SunnyBee dials the lead and conducts a professional conversation. After the call, AI analyzes the transcript to extract structured data (name, phone, property type, service requested) and generates a summary.",
      },
      {
        question: "What are call outcomes?",
        answer:
          "INTERESTED: Lead wants to learn more or schedule. NOT INTERESTED: Lead declined. CALLBACK: Lead wants to be called back later. VOICEMAIL: Went to voicemail. SCHEDULED: Appointment was booked. DEPOSIT REQUESTED: Lead is ready to pay.",
      },
      {
        question: "Can I listen to call recordings?",
        answer:
          "Yes. Go to the Calls page or open a lead's detail page. In the Call History section, you can expand each call to see the transcript and access the recording.",
      },
      {
        question: "How are call summaries generated?",
        answer:
          "After each call, OpenAI GPT-4o-mini analyzes the full transcript and generates a concise 2-3 sentence summary highlighting the key points, outcome, and any action items.",
      },
    ],
  },
  {
    title: "Campaigns",
    icon: Megaphone,
    items: [
      {
        question: "What is a Campaign?",
        answer:
          "A Campaign is a targeted outreach effort. You create a campaign with a specific script/instructions, set a calling window, add leads, and start it. SunnyBee will then call each lead in the campaign following your instructions.",
      },
      {
        question: "How do I create a campaign?",
        answer:
          'Click "Create Campaign" on the Campaigns page. Enter a name, script/instructions for SunnyBee, set the calling window (start/end hours), timezone, and max retries. Click "Create" to save.',
      },
      {
        question: "How do I add leads to a campaign?",
        answer:
          'Open a campaign, then click "Add Leads". You can search and select leads from your database. Use "Select All" to add all matching leads at once.',
      },
      {
        question: "Can I pause a campaign?",
        answer:
          "Yes. Click the Pause button on an active campaign. This will stop new calls from being made. You can resume at any time by clicking Start again.",
      },
    ],
  },
  {
    title: "Messages (SMS)",
    icon: MessageSquare,
    items: [
      {
        question: "How do I send an SMS?",
        answer:
          'Go to the Messages page. Select a lead from the dropdown or switch to "Phone Number" mode to enter any number manually. Type your message or choose a template, then click "Send".',
      },
      {
        question: "What templates are available?",
        answer:
          "There are 18 pre-built templates organized by category: First Contact, Follow-up, Quote/Estimate, Scheduling, Payment, Post-Service, and Re-engagement. Click on a template to auto-fill the message body.",
      },
      {
        question: "Can I send SMS to a number not in my leads?",
        answer:
          'Yes. On the Messages page, switch to "Phone Number" mode using the toggle button. Enter any US phone number and type your message.',
      },
      {
        question: "What do the message statuses mean?",
        answer:
          "QUEUED: Message is being processed. SENT: Message was sent to the carrier. DELIVERED: Message reached the recipient. FAILED: Message could not be delivered. RECEIVED: Incoming message from the lead.",
      },
    ],
  },
  {
    title: "Calendar",
    icon: CalendarDays,
    items: [
      {
        question: "What does the Calendar show?",
        answer:
          "The Calendar displays all scheduled cleaning appointments. Events are color-coded by service type: Deep Cleaning, Standard Cleaning, Recurring, Move In/Out, and Post Construction.",
      },
      {
        question: "Can I switch between views?",
        answer:
          "Yes. Use the view buttons at the top to switch between Month, Week, Day, and List views. Click Today to jump back to the current date.",
      },
    ],
  },
  {
    title: "Analytics",
    icon: BarChart3,
    items: [
      {
        question: "What charts are available?",
        answer:
          "Call Volume (30-day area chart), Conversion Funnel (horizontal bars), Call Outcomes (pie chart), Leads by Source (bar chart), and Leads by Status (summary cards).",
      },
      {
        question: "How often is data updated?",
        answer:
          "Analytics data is fetched in real-time when you visit the page. Refresh the page to get the latest numbers.",
      },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      {
        question: "How do I change my password?",
        answer:
          'Go to Settings, find the "Change Password" section, enter your current password and your new password, then click "Update Password".',
      },
      {
        question: "What services are connected?",
        answer:
          "The Settings page shows connected services: Twilio (SMS & calls), VAPI/SunnyBee (AI assistant), OpenAI (data extraction), and N8N (workflow automation). Each shows its connection status.",
      },
    ],
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredSections = faqSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !search ||
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <Header title="Help Center" description="Find answers to common questions" />
      <div className="mx-auto max-w-4xl p-8">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for help..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border-none bg-white py-4 pl-12 pr-4 text-base shadow-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Quick Help */}
        <div className="mb-8 rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Need more help?</h2>
          </div>
          <p className="mt-2 text-sm text-white/70">
            Contact support at{" "}
            <a href="mailto:support@optzen.com" className="font-medium text-white underline">
              support@optzen.com
            </a>{" "}
            or reach out to your account manager.
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div key={section.title} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.title)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-base font-semibold">{section.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {section.items.length}
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    openSections[section.title] ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Section Items */}
              {openSections[section.title] && (
                <div className="border-t px-6 pb-2">
                  {section.items.map((item, idx) => {
                    const key = `${section.title}-${idx}`;
                    return (
                      <div key={key} className="border-b last:border-b-0">
                        <button
                          onClick={() => toggleItem(key)}
                          className="flex w-full items-center justify-between py-4 text-left"
                        >
                          <span className="pr-4 text-sm font-medium">{item.question}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                              openItems[key] ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {openItems[key] && (
                          <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                            {item.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Optzen
        </p>
      </div>
    </>
  );
}
