import { Router, type IRouter } from "express";
import {
  GetDashboardSummaryResponse,
  GetEventsQueryParams,
  GetEventsResponse,
  GetProvidersResponse,
  GetTokensQueryParams,
  GetTokensResponse,
} from "@workspace/api-zod";
import { getProviderSnapshots } from "../providers/manager";
import { getSummary, listEvents, listTokens } from "../services/radar";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  res.json(GetDashboardSummaryResponse.parse(await getSummary()));
});

router.get("/providers", (_req, res): void => {
  res.json(GetProvidersResponse.parse(getProviderSnapshots()));
});

router.get("/tokens", async (req, res): Promise<void> => {
  const parsed = GetTokensQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokens = await listTokens(parsed.data);
  res.json(GetTokensResponse.parse(tokens));
});

router.get("/events", async (req, res): Promise<void> => {
  const parsed = GetEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(GetEventsResponse.parse(await listEvents(parsed.data.limit)));
});

export default router;