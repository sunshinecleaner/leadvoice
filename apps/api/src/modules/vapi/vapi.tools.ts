import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";

// ZIP code prefixes covered by Sunshine WL Brazilian
// These map to metro areas where the company actively operates
const SERVICE_AREAS: Record<string, string[]> = {
  // Georgia — Metro Atlanta & surrounding
  GA: [
    "300", "301", "302", "303", "304", "305", // Atlanta metro
    "306", "307", "308", "309", "310", "311", // Greater Atlanta
    "312", "313", "314", "315",               // North GA
  ],
  // Texas — Dallas, Houston, Austin, San Antonio metros
  TX: [
    "750", "751", "752", "753", "754", "755", // Dallas
    "760", "761", "762", "763", "764", "765", // DFW
    "770", "771", "772", "773", "774", "775", // Houston
    "776", "777", "778", "779",               // Houston metro
    "786", "787", "788", "789",               // Austin/San Antonio
  ],
  // Massachusetts — Boston metro
  MA: [
    "010", "011", "012", "013", "014", "015", // Western/Central MA
    "016", "017", "018", "019", "020", "021", // Boston metro
    "022", "023", "024", "025", "026", "027", // Greater Boston
  ],
  // Florida — Miami, Orlando, Tampa metros
  FL: [
    "320", "321", "322", "323", "324", "325", // North FL / Orlando
    "326", "327", "328", "329",               // Central FL
    "330", "331", "332", "333", "334", "335", // Miami / South FL
    "336", "337", "338", "339",               // Tampa / Gulf Coast
    "340", "341", "342", "344", "346", "347", // West FL
  ],
};

// Flatten all prefixes for quick lookup
const ALL_PREFIXES = new Set(
  Object.values(SERVICE_AREAS).flat()
);

function validateZipCode(zipCode: string): { serviceable: boolean; state?: string; message: string } {
  // Clean the zip code
  const cleaned = zipCode.replace(/\D/g, "").slice(0, 5);

  if (cleaned.length < 3) {
    return { serviceable: false, message: "Invalid zip code provided." };
  }

  const prefix = cleaned.slice(0, 3);

  if (ALL_PREFIXES.has(prefix)) {
    // Find which state
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
    message: "Unfortunately, we don't currently service that area. We operate in Georgia, Texas, Massachusetts, and Florida.",
  };
}

export async function vapiToolsRoutes(app: FastifyInstance) {
  // VAPI Tool: Validate ZIP code for service area coverage
  app.post("/check-zip", async (request, reply) => {
    const body = request.body as { message?: { toolCallList?: Array<{ function?: { arguments?: { zip_code?: string } } }> } };

    // VAPI sends tool calls in a specific format
    const toolCalls = body?.message?.toolCallList;
    if (toolCalls && toolCalls.length > 0) {
      const zipCode = toolCalls[0]?.function?.arguments?.zip_code || "";
      const result = validateZipCode(zipCode);
      logger.info({ zipCode, result }, "VAPI tool: ZIP code check");

      return reply.send({
        results: [{ result: JSON.stringify(result) }],
      });
    }

    // Fallback: direct API call (for testing)
    const directBody = request.body as { zip_code?: string };
    if (directBody?.zip_code) {
      const result = validateZipCode(directBody.zip_code);
      logger.info({ zipCode: directBody.zip_code, result }, "Direct ZIP code check");
      return reply.send({ success: true, data: result });
    }

    return reply.status(400).send({ success: false, error: "Missing zip_code" });
  });
}
