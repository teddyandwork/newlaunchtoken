import app from "./app";
import { logger } from "./lib/logger";
import { startDexScreener } from "./providers/dexscreener";
import { ensureSettings, ingestToken } from "./services/radar";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void ensureSettings()
    .then(() => startDexScreener(ingestToken))
    .catch((error) => logger.error({ err: error }, "Radar startup failed"));
});
