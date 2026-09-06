import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAdminTokenBody,
  CreateAdminTokenResponse,
  GetAdminOverviewResponse,
  GetAdminPaymentSettingsResponse,
  ListAdminOrdersResponse,
  ListAdminUsersResponse,
  RevealAdminTokenParams,
  RevealAdminTokenResponse,
  RevokeAdminTokenParams,
  UpdateAdminOrderStatusBody,
  UpdateAdminOrderStatusParams,
  UpdateAdminOrderStatusResponse,
  UpdateAdminPaymentSettingsBody,
  UpdateAdminPaymentSettingsResponse,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
} from "@workspace/api-zod";
import {
  accessTokensTable,
  auditEventsTable,
  db,
  ordersTable,
  paymentSettingsTable,
  usersTable,
} from "@workspace/db";
import {
  encryptSecret,
  generateAccessToken,
  hashSecret,
  requireAdmin,
} from "../lib/auth";
import { getPlan, isValidEmail, serializeOrder, serializeUser } from "../lib/depslip";

const router: IRouter = Router();

function numberValue(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function serializeAdminUser(
  user: typeof usersTable.$inferSelect,
  token: typeof accessTokensTable.$inferSelect,
) {
  return {
    ...serializeUser(user),
    tokenId: token.id,
    tokenStatus: token.status,
  };
}

async function recordAudit(action: string, targetType: string, targetId?: string): Promise<void> {
  await db.insert(auditEventsTable).values({
    actorRole: "admin",
    action,
    targetType,
    targetId: targetId ?? null,
    metadata: {},
  });
}

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsers] = await db.select({ value: count() }).from(usersTable);
  const [activeUsers] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.status, "active"));
  const [restrictedUsers] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.status, "restricted"));
  const [printTotals] = await db.select({
    pdf: sum(usersTable.pdfPrintCount),
    browser: sum(usersTable.browserPrintCount),
  }).from(usersTable);
  const [pendingOrders] = await db.select({ value: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [successfulOrders] = await db.select({ value: count() }).from(ordersTable).where(eq(ordersTable.status, "successful"));
  const [failedOrders] = await db.select({ value: count() }).from(ordersTable).where(eq(ordersTable.status, "failed"));
  res.json(GetAdminOverviewResponse.parse({
    totalUsers: numberValue(totalUsers?.value),
    activeUsers: numberValue(activeUsers?.value),
    restrictedUsers: numberValue(restrictedUsers?.value),
    totalPdfPrints: numberValue(printTotals?.pdf),
    totalBrowserPrints: numberValue(printTotals?.browser),
    pendingOrders: numberValue(pendingOrders?.value),
    successfulOrders: numberValue(successfulOrders?.value),
    failedOrders: numberValue(failedOrders?.value),
  }));
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const rows = [];
  for (const user of users) {
    const [token] = await db
      .select()
      .from(accessTokensTable)
      .where(eq(accessTokensTable.userId, user.id))
      .orderBy(desc(accessTokensTable.createdAt))
      .limit(1);
    if (token) rows.push(serializeAdminUser(user, token));
  }
  res.json(ListAdminUsersResponse.parse(rows));
});

router.post("/admin/tokens", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAdminTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isValidEmail(parsed.data.email)) {
    res.status(400).json({ error: "Enter a valid customer email address." });
    return;
  }
  const plan = getPlan(parsed.data.planId);
  if (!plan) {
    res.status(400).json({ error: "That plan is not available." });
    return;
  }
  const rawToken = generateAccessToken();
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(usersTable).values({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      slipLimit: plan.slipLimit,
      designLimit: plan.designLimit,
    }).returning();
    const [token] = await tx.insert(accessTokensTable).values({
      userId: user.id,
      tokenHash: hashSecret(rawToken),
      encryptedToken: encryptSecret(rawToken),
    }).returning();
    return { user, token };
  });
  await recordAudit("create_token", "access_token", result.token.id);
  res.status(201).json(CreateAdminTokenResponse.parse({
    tokenId: result.token.id,
    token: rawToken,
    user: serializeUser(result.user),
  }));
});

router.post("/admin/tokens/:tokenId/reveal", requireAdmin, async (req, res): Promise<void> => {
  const params = RevealAdminTokenParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [token] = await db.select().from(accessTokensTable).where(eq(accessTokensTable.id, params.data.tokenId)).limit(1);
  if (!token) {
    res.status(404).json({ error: "Token not found." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, token.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Token owner not found." });
    return;
  }
  await recordAudit("reveal_token", "access_token", token.id);
  res.json(RevealAdminTokenResponse.parse({
    tokenId: token.id,
    token: (await import("../lib/auth")).decryptSecret(token.encryptedToken),
    user: serializeUser(user),
  }));
});

router.post("/admin/tokens/:tokenId/revoke", requireAdmin, async (req, res): Promise<void> => {
  const params = RevokeAdminTokenParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db.update(accessTokensTable)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(accessTokensTable.id, params.data.tokenId))
    .returning({ id: accessTokensTable.id });
  if (!updated) {
    res.status(404).json({ error: "Token not found." });
    return;
  }
  await recordAudit("revoke_token", "access_token", updated.id);
  res.sendStatus(204);
});

router.patch("/admin/users/:userId/status", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminUserStatusParams.safeParse(req.params);
  const parsed = UpdateAdminUserStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable)
    .set({ status: parsed.data.status })
    .where(eq(usersTable.id, params.data.userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  const [token] = await db.select().from(accessTokensTable).where(eq(accessTokensTable.userId, user.id)).orderBy(desc(accessTokensTable.createdAt)).limit(1);
  if (!token) {
    res.status(404).json({ error: "Customer token not found." });
    return;
  }
  await recordAudit("update_user_status", "user", user.id);
  res.json(UpdateAdminUserStatusResponse.parse(serializeAdminUser(user, token)));
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  res.json(ListAdminOrdersResponse.parse(orders.map(serializeOrder)));
});

router.patch("/admin/orders/:orderId/status", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAdminOrderStatusParams.safeParse(req.params);
  const parsed = UpdateAdminOrderStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.orderId))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  await recordAudit("update_order_status", "order", order.id);
  res.json(UpdateAdminOrderStatusResponse.parse(serializeOrder(order)));
});

router.get("/admin/settings/payment", requireAdmin, async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.id, "default")).limit(1);
  if (!settings) {
    [settings] = await db.insert(paymentSettingsTable).values({ id: "default" }).returning();
  }
  res.json(GetAdminPaymentSettingsResponse.parse({
    bitcoinWallet: settings.bitcoinWallet,
    bitcoinQrUrl: settings.bitcoinQrUrl,
    bitcoinInstructions: settings.bitcoinInstructions,
  }));
});

router.patch("/admin/settings/payment", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAdminPaymentSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [settings] = await db.insert(paymentSettingsTable)
    .values({ id: "default", ...parsed.data })
    .onConflictDoUpdate({
      target: paymentSettingsTable.id,
      set: parsed.data,
    })
    .returning();
  await recordAudit("update_payment_settings", "payment_settings");
  res.json(UpdateAdminPaymentSettingsResponse.parse({
    bitcoinWallet: settings.bitcoinWallet,
    bitcoinQrUrl: settings.bitcoinQrUrl,
    bitcoinInstructions: settings.bitcoinInstructions,
  }));
});

export default router;