import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePayeeBody,
  CreatePayeeResponse,
  DeletePayeeParams,
  ListPayeesResponse,
} from "@workspace/api-zod";
import { db, payeesTable } from "@workspace/db";
import {
  decryptSecret,
  encryptSecret,
  requireUser,
  type AuthenticatedRequest,
} from "../lib/auth";

const router: IRouter = Router();

function serializePayee(payee: typeof payeesTable.$inferSelect) {
  return {
    id: payee.id,
    name: payee.name,
    address: payee.address,
    bankName: payee.bankName,
    bankAddress: payee.bankAddress,
    routingNumber: decryptSecret(payee.routingNumberEncrypted),
    accountNumber: decryptSecret(payee.accountNumberEncrypted),
    bankLogoUrl: payee.bankLogoUrl,
    createdAt: payee.createdAt.toISOString(),
  };
}

router.get("/payees", requireUser, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).auth?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  const payees = await db.select().from(payeesTable).where(eq(payeesTable.userId, userId));
  res.json(ListPayeesResponse.parse(payees.map(serializePayee)));
});

router.post("/payees", requireUser, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).auth?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  const parsed = CreatePayeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [payee] = await db
    .insert(payeesTable)
    .values({
      userId,
      name: parsed.data.name,
      address: parsed.data.address,
      bankName: parsed.data.bankName,
      bankAddress: parsed.data.bankAddress,
      routingNumberEncrypted: encryptSecret(parsed.data.routingNumber),
      accountNumberEncrypted: encryptSecret(parsed.data.accountNumber),
      bankLogoUrl: parsed.data.bankLogoUrl,
    })
    .returning();
  res.status(201).json(CreatePayeeResponse.parse(serializePayee(payee)));
});

router.delete("/payees/:payeeId", requireUser, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).auth?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  const params = DeletePayeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db
    .delete(payeesTable)
    .where(and(eq(payeesTable.id, params.data.payeeId), eq(payeesTable.userId, userId)))
    .returning({ id: payeesTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Payee not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;