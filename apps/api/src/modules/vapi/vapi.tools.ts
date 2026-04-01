import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import * as smsService from "../sms/sms.service.js";
import { prisma } from "@leadvoice/database";

// ─── ZIP code prefixes covered by Sunshine WL Brazilian ─────────────────────
const SERVICE_AREAS: Record<string, string[]> = {
  GA: [
    "300", "301", "302", "303", "304", "305",
    "306", "307", "308", "309", "310", "311",
    "312", "313", "314", "315",
  ],
  TX: [
    "750", "751", "752", "753", "754", "755",
    "760", "761", "762", "763", "764", "765",
    "770", "771", "772", "773", "774", "775",
    "776", "777", "778", "779",
    "786", "787", "788", "789",
  ],
  MA: [
    "010", "011", "012", "013", "014", "015",
    "016", "017", "018", "019", "020", "021",
    "022", "023", "024", "025", "026", "027",
  ],
  FL: [
    "320", "321", "322", "323", "324", "325",
    "326", "327", "328", "329",
    "330", "331", "332", "333", "334", "335",
    "336", "337", "338", "339",
    "340", "341", "342", "344", "346", "347",
  ],
  NY: [
    "100", "101", "102", "103", "104", "105",
    "106", "107", "108", "109",
    "110", "111", "112", "113", "114", "115",
    "116", "117", "118", "119",
    "120", "121", "122", "123", "124", "125",
    "126", "127", "128", "129",
    "130", "131", "132", "133", "134", "135",
    "140", "141", "142", "143", "144", "145",
  ],
};

const ALL_PREFIXES = new Set(Object.values(SERVICE_AREAS).flat());

function validateZipCode(zipCode: string): { serviceable: boolean; state?: string; message: string } {
  const cleaned = zipCode.replace(/\D/g, "").slice(0, 5);

  if (cleaned.length < 3) {
    return { serviceable: false, message: "Invalid zip code provided." };
  }

  const prefix = cleaned.slice(0, 3);

  if (ALL_PREFIXES.has(prefix)) {
    const state = Object.entries(SERVICE_AREAS).find(([, prefixes]) =>
      prefixes.includes(prefix)
    )?.[0];

    return {
      serviceable: true,
      state,
      message: `Great news! We service the ${cleaned} area in ${state}.`,
    };
  }

  return {
    serviceable: false,
    message: "Unfortunately, we don't currently service that area. We operate in Georgia, Florida, Texas, New York, and Massachusetts.",
  };
}

// ─── Helper: extract VAPI tool call arguments ────────────────────────────────

interface VapiToolCallBody {
  message?: {
    toolCallList?: Array<{
      id?: string;
      function?: { name?: string; arguments?: Record<string, unknown> };
    }>;
  };
}

function extractToolArgs(body: unknown): { toolCallId?: string; args: Record<string, unknown> } | null {
  const typed = body as VapiToolCallBody;
  const toolCalls = typed?.message?.toolCallList;
  if (toolCalls && toolCalls.length > 0) {
    return {
      toolCallId: toolCalls[0]?.id,
      args: toolCalls[0]?.function?.arguments || {},
    };
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function vapiToolsRoutes(app: FastifyInstance) {

  // ─── Tool: check_location (ZIP code validation) ────────────────────────────
  app.post("/check-zip", async (request, reply) => {
    const toolCall = extractToolArgs(request.body);

    if (toolCall) {
      const zipCode = String(toolCall.args.zip_code || "");
      const result = validateZipCode(zipCode);
      logger.info({ zipCode, result }, "VAPI tool: check_location");

      return reply.send({
        results: [{ toolCallId: toolCall.toolCallId, result: JSON.stringify(result) }],
      });
    }

    // Fallback: direct API call (for testing)
    const directBody = request.body as { zip_code?: string };
    if (directBody?.zip_code) {
      const result = validateZipCode(directBody.zip_code);
      return reply.send({ success: true, data: result });
    }

    return reply.status(400).send({ success: false, error: "Missing zip_code" });
  });

  // ─── Tool: get_cleaning_quote (n8n → Google Sheets price lookup) ───────────
  app.post("/get-cleaning-quote", async (request, reply) => {
    const toolCall = extractToolArgs(request.body);

    if (toolCall) {
      const { args } = toolCall;
      logger.info({ args }, "VAPI tool: get_cleaning_quote — requesting price from n8n");

      const price = await fetchQuoteFromN8N(args);

      return reply.send({
        results: [{
          toolCallId: toolCall.toolCallId,
          result: JSON.stringify(price),
        }],
      });
    }

    // Fallback: direct API call (for testing)
    const directBody = request.body as Record<string, unknown>;
    if (directBody?.quote_type) {
      const price = await fetchQuoteFromN8N(directBody);
      return reply.send({ success: true, data: price });
    }

    return reply.status(400).send({ success: false, error: "Missing quote parameters" });
  });

  // ─── Tool: send_checklist (SMS 55-point checklist to caller) ───────────────
  app.post("/send-checklist", async (request, reply) => {
    const toolCall = extractToolArgs(request.body);

    if (toolCall) {
      const { args } = toolCall;
      const phone = String(args.phone || "");
      const serviceType = String(args.service_type || "deep_clean");
      logger.info({ phone, serviceType }, "VAPI tool: send_checklist");

      const result = await sendChecklistSms(phone, serviceType);

      return reply.send({
        results: [{
          toolCallId: toolCall.toolCallId,
          result: JSON.stringify(result),
        }],
      });
    }

    // Fallback: direct API call (for testing)
    const directBody = request.body as { phone?: string; service_type?: string };
    if (directBody?.phone) {
      const result = await sendChecklistSms(directBody.phone, directBody.service_type || "deep_clean");
      return reply.send({ success: true, data: result });
    }

    return reply.status(400).send({ success: false, error: "Missing phone number" });
  });
}

// ─── n8n Price Lookup ────────────────────────────────────────────────────────

async function fetchQuoteFromN8N(
  params: Record<string, unknown>,
): Promise<{ price: number | null; exact_match: boolean; error?: string }> {
  const webhookUrl = env.N8N_QUOTE_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn("N8N_QUOTE_WEBHOOK_URL not set — cannot fetch quote");
    return { price: null, exact_match: false, error: "Pricing system unavailable. A manager will follow up with the exact quote." };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_type: params.quote_type,
        state: params.state,
        service: params.service,
        // Full property
        bedrooms: params.bedrooms,
        bathrooms: params.bathrooms,
        // Per-room
        rooms: params.rooms,
        // Commercial
        offices: params.offices,
        common_areas: params.common_areas,
        sqft: params.sqft,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, response: text.slice(0, 500) }, "n8n quote webhook error");
      return { price: null, exact_match: false, error: "Unable to retrieve pricing at this time." };
    }

    const data = await res.json() as { price?: number; exact_match?: boolean };
    logger.info({ params, result: data }, "n8n quote response");

    if (data.price === undefined || data.price === null) {
      return { price: null, exact_match: false, error: "No matching price found for these specifications." };
    }

    return {
      price: data.price,
      exact_match: data.exact_match !== false,
    };
  } catch (error) {
    logger.error({ error }, "Failed to fetch quote from n8n");
    return { price: null, exact_match: false, error: "Pricing system temporarily unavailable." };
  }
}

// ─── Checklist SMS ───────────────────────────────────────────────────────────

const CHECKLIST_MESSAGES: Record<string, string> = {
  deep_clean: `Sunshine Cleaning — 55-Point Deep Clean Checklist

KITCHEN
- Countertops, backsplash & sink (scrub + sanitize)
- Stovetop, burners & drip pans
- Exterior of all appliances
- Cabinet fronts (wipe down)
- Microwave (interior + exterior)
- Dishwasher (exterior + edges)
- Trash can area (sanitize)
- Floor (sweep + mop + edges)
- Light switches & outlets

BATHROOMS
- Toilet (full sanitize, base + behind)
- Shower/tub (scrub tiles, grout, fixtures)
- Vanity, sink & mirror
- Cabinet fronts
- Floor (scrub + mop)
- Trash can (sanitize)
- Light switches & outlets

BEDROOMS & LIVING AREAS
- Dust all surfaces, shelves & decor
- Ceiling fans & light fixtures
- Baseboards & door frames
- Window sills & tracks
- Mirrors & glass surfaces
- Vacuum carpets / mop hard floors
- Under furniture (reachable areas)
- Light switches & outlets

GENERAL
- All door handles (sanitize)
- Cobweb removal (all rooms)
- Blinds (dust)
- Stairs (vacuum/mop + rails)
- Laundry room surfaces
- Entryway & hallways

Note: Inside oven, fridge, cabinets, and walls are available as add-ons.
This checklist defines the scope of work. Final pricing reflects actual conditions.`,

  regular_clean: `Sunshine Cleaning — Maintenance Clean Checklist

KITCHEN: Countertops, sink, stovetop, appliance exteriors, cabinet fronts, floor
BATHROOMS: Toilet, shower/tub, vanity, mirror, floor
BEDROOMS: Dust surfaces, make beds, vacuum/mop floors
LIVING AREAS: Dust surfaces, vacuum/mop, light fixtures
GENERAL: Door handles, light switches, cobwebs, trash cans

Note: This is a maintenance clean to keep your space fresh between deep cleans.`,
};

async function sendChecklistSms(
  phone: string,
  serviceType: string,
): Promise<{ sent: boolean; message: string }> {
  if (!phone || !phone.startsWith("+") || phone.length < 10) {
    return { sent: false, message: "Invalid phone number" };
  }

  try {
    const checklistType = serviceType.toLowerCase().includes("regular") ? "regular_clean" : "deep_clean";
    const body = CHECKLIST_MESSAGES[checklistType] || CHECKLIST_MESSAGES.deep_clean;

    // Find lead by phone to use sendMessage
    const lead = await prisma.lead.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (lead) {
      await smsService.sendMessage({ leadId: lead.id, body });
    } else {
      // Direct Twilio send if no lead exists yet
      logger.warn({ phone }, "No lead found for checklist SMS — skipping");
      return { sent: false, message: "No lead record found for this phone number" };
    }

    logger.info({ phone, checklistType }, "Checklist SMS sent");
    return { sent: true, message: "Checklist sent successfully" };
  } catch (error) {
    logger.error({ error, phone }, "Failed to send checklist SMS");
    return { sent: false, message: "Failed to send checklist" };
  }
}
