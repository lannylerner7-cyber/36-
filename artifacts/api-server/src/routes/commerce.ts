import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetBitcoinPaymentSettingsResponse,
  ListPlansResponse,
  LookupOrderBody,
  LookupOrderResponse,
} from "@workspace/api-zod";
import { db, ordersTable, paymentSettingsTable } from "@workspace/db";
import { getPlan, isValidEmail, makeOrderNumber, PLANS, serializeOrder } from "../lib/depslip";

const router: IRouter = Router();

router.get("/plans", (_req, res): void => {
  res.json(ListPlansResponse.parse(Object.values(PLANS)));
});

router.get("/payment-settings/bitcoin", async (_req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(paymentSettingsTable)
    .where(eq(paymentSettingsTable.id, "default"))
    .limit(1);
  res.json(GetBitcoinPaymentSettingsResponse.parse({
    bitcoinWallet: settings?.bitcoinWallet ?? "",
    bitcoinQrUrl: settings?.bitcoinQrUrl ?? null,
    bitcoinInstructions: settings?.bitcoinInstructions ?? "",
  }));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isValidEmail(parsed.data.email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (!parsed.data.acceptedPaymentTerms) {
    res.status(400).json({ error: "Accept the manual payment terms to continue." });
    return;
  }
  const plan = getPlan(parsed.data.planId);
  if (!plan) {
    res.status(400).json({ error: "That plan is not available." });
    return;
  }
  const [order] = await db
    .insert(ordersTable)
    .values({
      orderNumber: makeOrderNumber(),
      planId: plan.id,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      billingAddress: parsed.data.billingAddress,
      paymentMethod: parsed.data.paymentMethod,
      status: "pending",
      amountCents: plan.priceCents,
      currency: plan.currency,
      acceptedPaymentTerms: "true",
    })
    .returning();
  res.status(201).json(CreateOrderResponse.parse(serializeOrder(order)));
});

router.post("/orders/lookup", async (req, res): Promise<void> => {
  const parsed = LookupOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.orderNumber, parsed.data.orderNumber));
  if (!order || order.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    res.status(404).json({ error: "No matching order was found." });
    return;
  }
  res.json(LookupOrderResponse.parse(serializeOrder(order)));
});

export default router;