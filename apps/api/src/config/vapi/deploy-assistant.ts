/**
 * Deploy / Update SunnyBee assistant on VAPI
 *
 * Usage:
 *   npx tsx apps/api/src/config/vapi/deploy-assistant.ts
 *
 * Requires VAPI_API_KEY and VAPI_ASSISTANT_ID in .env
 * If VAPI_ASSISTANT_ID is not set, creates a new assistant and prints the ID.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const SERVER_URL = process.env.VAPI_SERVER_URL || "https://sunshine-leadvoice-api.lxlgch.easypanel.host/api/webhooks/vapi";
const TOOLS_BASE_URL = process.env.VAPI_TOOLS_BASE_URL || "https://sunshine-leadvoice-api.lxlgch.easypanel.host/api/vapi/tools";

if (!VAPI_API_KEY) {
  console.error("Error: VAPI_API_KEY not set in environment");
  process.exit(1);
}

// ─── Load files ──────────────────────────────────────────────────────────────

const systemPrompt = readFileSync(resolve(__dirname, "sunnybee-prompt.md"), "utf-8");
const rawSchema = JSON.parse(
  readFileSync(resolve(__dirname, "sunnybee-structured-data.json"), "utf-8")
);
// Remove $schema field — VAPI doesn't accept it
const { $schema: _removed, ...structuredDataSchema } = rawSchema;

// ─── Assistant configuration ─────────────────────────────────────────────────

const assistantConfig = {
  name: "SunnyBee",

  firstMessage:
    "Hello, thank you for calling Sunshine Cleaning! This is SunnyBee. How can I help you today?",

  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "check_location",
          description:
            "Validates the caller's ZIP code or state against Sunshine's service areas (GA, FL, TX, NY, MA). Call this after getting the caller's address.",
          parameters: {
            type: "object",
            properties: {
              zip_code: {
                type: "string",
                description: "The caller's ZIP code (5 digits)",
              },
            },
            required: ["zip_code"],
          },
        },
        server: {
          url: `${TOOLS_BASE_URL}/check-zip`,
        },
      },
      {
        type: "function",
        function: {
          name: "get_cleaning_quote",
          description:
            "Retrieves the real-time price from the pricing matrix via n8n + Google Sheets. Call this AFTER collecting all property details and AFTER sending the checklist. Returns { price, exact_match }.",
          parameters: {
            type: "object",
            properties: {
              quote_type: {
                type: "string",
                enum: ["full_property", "per_room", "commercial"],
                description:
                  "full_property = residential whole home, per_room = specific rooms only, commercial = office/commercial space",
              },
              state: {
                type: "string",
                enum: ["GA", "FL", "TX", "NY", "MA"],
                description: "State abbreviation",
              },
              service: {
                type: "string",
                enum: ["Regular Clean", "Deep Clean", "Move In", "Move Out"],
                description: "Type of cleaning service",
              },
              bedrooms: {
                type: "integer",
                description: "Number of bedrooms (full_property only)",
              },
              bathrooms: {
                type: "integer",
                description: "Number of bathrooms (full_property only)",
              },
              rooms: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "Bathroom",
                        "Kitchen",
                        "Bedroom",
                        "Living Room",
                        "Office",
                        "Common Area",
                      ],
                    },
                    quantity: { type: "integer" },
                  },
                  required: ["type", "quantity"],
                },
                description: "Rooms to clean (per_room only)",
              },
              offices: {
                type: "integer",
                description: "Number of offices (commercial only)",
              },
              common_areas: {
                type: "integer",
                description: "Number of common areas (commercial only)",
              },
              sqft: {
                type: "integer",
                description: "Square footage (commercial only)",
              },
            },
            required: ["quote_type", "state", "service"],
          },
        },
        server: {
          url: `${TOOLS_BASE_URL}/get-cleaning-quote`,
        },
      },
      {
        type: "function",
        function: {
          name: "send_checklist",
          description:
            "Sends the 55-point service checklist via SMS to the caller's phone. Call this BEFORE announcing the price to build value. Say: 'I'm sending our detailed checklist to your phone right now.'",
          parameters: {
            type: "object",
            properties: {
              phone: {
                type: "string",
                description:
                  "Caller's phone number in E.164 format (e.g., +14701234567)",
              },
              service_type: {
                type: "string",
                enum: ["deep_clean", "regular_clean"],
                description: "Type of service to determine which checklist to send",
              },
            },
            required: ["phone", "service_type"],
          },
        },
        server: {
          url: `${TOOLS_BASE_URL}/send-checklist`,
        },
      },
    ],
  },

  voice: {
    provider: "openai",
    voiceId: "shimmer",
  },

  serverUrl: SERVER_URL,

  analysisPlan: {
    summaryPrompt:
      "Summarize this cleaning service call. Include: caller name, full address, property details, service type, condition level, price quoted, and outcome (booked, interested, callback, etc.). Write in third person.",
    successEvaluationPrompt:
      "Evaluate if this call was successful. Return 'booked' if the caller locked in a date. 'interested' if they want a quote or follow-up. 'callback' if they want to be called back. 'not_interested' if they declined. 'voicemail' if no live conversation. 'out_of_area' if outside service area.",
    structuredDataPrompt:
      "Extract structured data from the call. Only include fields explicitly mentioned. For outcome: 'booked' if date locked, 'interested' if engaged, 'callback' if wants callback, 'not_interested' if declined, 'voicemail' if no live conversation, 'out_of_area' if outside service area. Always include quotedPrice if a price was stated during the call.",
    structuredDataSchema,
  },

  recordingEnabled: true,
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 600,

  endCallMessage:
    "Thank you for choosing Sunshine Cleaning. You'll receive a text shortly with all the details. Have a wonderful day!",

  endCallPhrases: [
    "goodbye",
    "have a nice day",
    "no thank you",
    "not interested",
  ],

  metadata: {
    company: "Sunshine WL Brazilian",
    version: "2.0",
  },
};

// ─── Deploy ──────────────────────────────────────────────────────────────────

async function deploy() {
  const baseUrl = "https://api.vapi.ai";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${VAPI_API_KEY}`,
  };

  if (VAPI_ASSISTANT_ID) {
    // Update existing assistant
    console.log(`Updating assistant ${VAPI_ASSISTANT_ID}...`);

    const res = await fetch(`${baseUrl}/assistant/${VAPI_ASSISTANT_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(assistantConfig),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Failed to update assistant: ${res.status}`, error);
      process.exit(1);
    }

    const assistant = await res.json();
    console.log(`\nAssistant updated successfully!`);
    console.log(`  ID: ${(assistant as any).id}`);
    console.log(`  Name: ${(assistant as any).name}`);
    console.log(`  Tools: ${assistantConfig.model.tools.length}`);
    console.log(`  Prompt length: ${systemPrompt.length} chars`);
  } else {
    // Create new assistant
    console.log("Creating new assistant...");

    const res = await fetch(`${baseUrl}/assistant`, {
      method: "POST",
      headers,
      body: JSON.stringify(assistantConfig),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`Failed to create assistant: ${res.status}`, error);
      process.exit(1);
    }

    const assistant = await res.json();
    console.log(`\nAssistant created successfully!`);
    console.log(`  ID: ${(assistant as any).id}`);
    console.log(`  Name: ${(assistant as any).name}`);
    console.log(`\nAdd this to your .env:`);
    console.log(`  VAPI_ASSISTANT_ID=${(assistant as any).id}`);
  }
}

deploy().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
