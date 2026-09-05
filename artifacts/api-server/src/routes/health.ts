import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { getProviderSnapshots } from "../providers/manager";
import { getSummary } from "../services/radar";
import { checkTelegram } from "../services/telegram";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  const [summary, telegram] = await Promise.all([getSummary(), checkTelegram()]);
  let database: "connected" | "disconnected" = "connected";
  try {
    await pool.query("select 1");
  } catch {
    database = "disconnected";
  }
  const providers = Object.fromEntries(
    getProviderSnapshots().map((provider) => [provider.id, provider.status]),
  );
  const data = HealthCheckResponse.parse({
    status:
      database === "connected" &&
      (telegram === "connected" || telegram === "unconfigured")
        ? "ok"
        : "degraded",
    uptime: Math.floor(process.uptime()),
    providers,
    telegram,
    database,
    lastEventAt: summary.lastEventAt,
  });
  res.json(data);
});

export default router;