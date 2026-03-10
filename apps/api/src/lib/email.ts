import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let resend: Resend | null = null;

function getClient() {
  if (!resend && env.RESEND_API_KEY) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const client = getClient();
  if (!client) {
    logger.warn("RESEND_API_KEY not configured — skipping email");
    return;
  }

  try {
    const result = await client.emails.send({
      from: "SunnyBee <notifications@sunshinebrazilian.com>",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    logger.info({ to: params.to, subject: params.subject }, "Email sent");
    return result;
  } catch (error) {
    logger.error({ error, to: params.to }, "Failed to send email");
  }
}
