import { Router, type IRouter } from "express";
import {
  GetSettingsResponse,
  SendTelegramTestResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { getSettings, updateSettings } from "../services/radar";
import { sendTelegramTestMessage } from "../services/telegram";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  res.json(GetSettingsResponse.parse(await getSettings()));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(UpdateSettingsResponse.parse(await updateSettings(parsed.data)));
});

router.post("/telegram/test", async (_req, res): Promise<void> => {
  try {
    await sendTelegramTestMessage();
    res.json(SendTelegramTestResponse.parse({ ok: true, message: "Test alert sent" }));
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Telegram test failed",
    });
  }
});

export default router;