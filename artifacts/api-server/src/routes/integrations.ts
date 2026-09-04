import { Router, type IRouter } from "express";
import {
  AutocompletePlaceBody,
  AutocompletePlaceResponse,
  GetIntegrationStatusResponse,
  LookupRoutingNumberBody,
  LookupRoutingNumberResponse,
} from "@workspace/api-zod";
import {
  autocompletePlace,
  getIntegrationStatus,
  lookupRoutingNumber,
} from "../lib/integrations";

const router: IRouter = Router();

router.get("/integrations/status", (_req, res) => {
  res.json(GetIntegrationStatusResponse.parse(getIntegrationStatus()));
});

router.post("/places/autocomplete", async (req, res): Promise<void> => {
  const parsed = AutocompletePlaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await autocompletePlace(parsed.data);
    res.json(AutocompletePlaceResponse.parse(result));
  } catch (error) {
    req.log.warn({ err: error }, "Address autocomplete unavailable");
    res.status(503).json({
      error: "Address autocomplete is not configured or temporarily unavailable.",
    });
  }
});

router.post("/routing/lookup", (req, res): void => {
  const parsed = LookupRoutingNumberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.json(LookupRoutingNumberResponse.parse(lookupRoutingNumber(parsed.data)));
});

export default router;