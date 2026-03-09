import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

interface ServiceBalance {
  service: string;
  status: "active" | "inactive" | "error";
  balance?: string;
  currency?: string;
  link?: string;
}

export async function integrationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/balances", async (_request, reply) => {
    const balances: ServiceBalance[] = await Promise.all([
      getTwilioBalance(),
      getVapiBalance(),
      getOpenAIStatus(),
    ]);

    return reply.send({ success: true, data: balances });
  });
}

async function getTwilioBalance(): Promise<ServiceBalance> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return { service: "Twilio", status: "inactive", link: "https://console.twilio.com" };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Balance.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        },
      },
    );

    if (!res.ok) {
      return { service: "Twilio", status: "error", link: "https://console.twilio.com" };
    }

    const data = await res.json() as { balance: string; currency: string };
    return {
      service: "Twilio",
      status: "active",
      balance: parseFloat(data.balance).toFixed(2),
      currency: data.currency,
      link: "https://console.twilio.com",
    };
  } catch (error) {
    logger.error({ error }, "Failed to fetch Twilio balance");
    return { service: "Twilio", status: "error", link: "https://console.twilio.com" };
  }
}

async function getVapiBalance(): Promise<ServiceBalance> {
  if (!env.VAPI_API_KEY) {
    return { service: "VAPI", status: "inactive", link: "https://dashboard.vapi.ai" };
  }

  try {
    // VAPI uses /org endpoint for balance info
    const res = await fetch("https://api.vapi.ai/org", {
      headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` },
    });

    if (!res.ok) {
      return { service: "VAPI", status: "active", link: "https://dashboard.vapi.ai" };
    }

    const data = await res.json() as any;
    // VAPI org may return balance/credits info
    const balance = data.balance ?? data.credits ?? data.subscription?.balance;
    if (balance !== undefined) {
      return {
        service: "VAPI",
        status: "active",
        balance: parseFloat(String(balance)).toFixed(2),
        currency: "USD",
        link: "https://dashboard.vapi.ai",
      };
    }

    return { service: "VAPI", status: "active", link: "https://dashboard.vapi.ai" };
  } catch (error) {
    logger.error({ error }, "Failed to fetch VAPI balance");
    return { service: "VAPI", status: "error", link: "https://dashboard.vapi.ai" };
  }
}

async function getOpenAIStatus(): Promise<ServiceBalance> {
  if (!env.OPENAI_API_KEY) {
    return { service: "OpenAI", status: "inactive", link: "https://platform.openai.com" };
  }

  try {
    // OpenAI doesn't have a public balance API — just verify the key works
    const res = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });

    return {
      service: "OpenAI",
      status: res.ok ? "active" : "error",
      link: "https://platform.openai.com/usage",
    };
  } catch {
    return { service: "OpenAI", status: "error", link: "https://platform.openai.com" };
  }
}
