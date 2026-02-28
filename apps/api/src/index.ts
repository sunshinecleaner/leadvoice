import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    logger.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
