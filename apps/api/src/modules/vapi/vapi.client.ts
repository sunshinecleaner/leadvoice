import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const VAPI_BASE_URL = "https://api.vapi.ai";

async function vapiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY is not configured");
  }

  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.VAPI_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    logger.error({ status: res.status, error }, "VAPI API error");
    throw new Error(`VAPI API error: ${res.status} - ${error}`);
  }

  return res.json() as Promise<T>;
}

// Create an outbound call via VAPI
export async function createCall(params: {
  phoneNumber: string;
  assistantId?: string;
  assistantOverrides?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  return vapiRequest<VapiCall>("/call", {
    method: "POST",
    body: JSON.stringify({
      phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
      assistantId: params.assistantId || env.VAPI_ASSISTANT_ID,
      assistantOverrides: params.assistantOverrides,
      customer: {
        number: params.phoneNumber,
      },
      metadata: params.metadata,
    }),
  });
}

// Get call details
export async function getCall(callId: string) {
  return vapiRequest<VapiCall>(`/call/${callId}`);
}

// List calls
export async function listCalls(params?: { limit?: number; createdAtGt?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.createdAtGt) query.set("createdAtGt", params.createdAtGt);
  return vapiRequest<VapiCall[]>(`/call?${query}`);
}

// List assistants
export async function listAssistants() {
  return vapiRequest<VapiAssistant[]>("/assistant");
}

// Get assistant
export async function getAssistant(assistantId: string) {
  return vapiRequest<VapiAssistant>(`/assistant/${assistantId}`);
}

// Create assistant
export async function createAssistant(params: {
  name: string;
  firstMessage: string;
  model: {
    provider: string;
    model: string;
    systemPrompt: string;
  };
  voice?: {
    provider: string;
    voiceId: string;
  };
}) {
  return vapiRequest<VapiAssistant>("/assistant", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Types
export interface VapiCall {
  id: string;
  orgId: string;
  type: string;
  status: string;
  phoneNumberId: string;
  assistantId: string;
  customer: { number: string };
  startedAt: string;
  endedAt: string;
  duration: number;
  cost: number;
  transcript: string;
  recordingUrl: string;
  summary: string;
  metadata: Record<string, unknown>;
  analysis: {
    successEvaluation: string;
    summary: string;
    structuredData: Record<string, unknown>;
  };
}

export interface VapiAssistant {
  id: string;
  name: string;
  firstMessage: string;
  model: {
    provider: string;
    model: string;
    systemPrompt: string;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
}
