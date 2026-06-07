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
const SERVER_URL = process.env.VAPI_SERVER_URL || "https://api.sunshinebrazilian.com/api/webhooks/vapi";
const TOOLS_BASE_URL = process.env.VAPI_TOOLS_BASE_URL || "https://api.sunshinebrazilian.com/api/vapi/tools";

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
    model: "gpt-4o-mini",
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
            "Calculates the cleaning price in real time from the pricing database. Call this after knowing: service type, number of bedrooms, and number of bathrooms. Returns { price, formatted, exact_match }.",
          parameters: {
            type: "object",
            properties: {
              service_type: {
                type: "string",
                enum: ["deep_clean", "monthly", "biweekly", "weekly"],
                description:
                  "Type of cleaning service: deep_clean (one-time deep clean, move-in, move-out), monthly (once a month recurring), biweekly (every two weeks), weekly (every week)",
              },
              bedrooms: {
                type: "integer",
                description: "Number of bedrooms",
              },
              bathrooms: {
                type: "integer",
                description: "Number of bathrooms",
              },
            },
            required: ["service_type", "bedrooms", "bathrooms"],
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
    provider: "11labs",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    model: "eleven_turbo_v2_5",
    stability: 0.4,
    similarityBoost: 0.75,
  },

  serverUrl: SERVER_URL,

  analysisPlan: {
    summaryPlan: {
      enabled: true,
      messages: [
        {
          role: "system",
          content:
            "Summarize this cleaning service call in 2-3 sentences. Include: caller name, property details (type, beds/baths, location), service type, price quoted, and outcome. Write in third person, professional tone. Example: 'John Smith called about a 3-bed/2-bath house in Atlanta, GA. Quoted $380 for a deep cleaning. Appointment booked for Monday at 10 AM.'",
        },
        {
          role: "user",
          content:
            "Here is the transcript:\n\n{{transcript}}\n\nHere is the ended reason of the call:\n\n{{endedReason}}",
        },
      ],
    },
    successEvaluationPlan: {
      enabled: true,
      rubric: "PassFail",
      messages: [
        {
          role: "system",
          content:
            "Evaluate the call outcome. Respond with ONLY one of these values:\n- 'pass' if the caller booked a date, expressed interest, or wants a follow-up\n- 'fail' if the caller declined, was not interested, or the call went to voicemail",
        },
        {
          role: "user",
          content:
            "Here is the transcript:\n\n{{transcript}}\n\nHere is the ended reason of the call:\n\n{{endedReason}}",
        },
      ],
    },
    structuredDataPlan: {
      enabled: true,
      schema: structuredDataSchema,
      messages: [
        {
          role: "system",
          content:
            "Extract structured data from the call transcript. Only include fields that were explicitly mentioned. For outcome: 'booked' if a date was locked in, 'interested' if engaged and wants quote/follow-up, 'callback' if wants to be called back, 'not_interested' if declined, 'voicemail' if no live conversation, 'out_of_area' if outside service area, 'deposit_requested' if a deep clean deposit was discussed and the caller agreed to pay. Always include quotedPrice if a price was stated during the call.\n\nJson Schema:\n{{schema}}\n\nOnly respond with the JSON.",
        },
        {
          role: "user",
          content:
            "Here is the transcript:\n\n{{transcript}}\n\nHere is the ended reason of the call:\n\n{{endedReason}}",
        },
      ],
    },
  },

  recordingEnabled: true,
  silenceTimeoutSeconds: 600,
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
