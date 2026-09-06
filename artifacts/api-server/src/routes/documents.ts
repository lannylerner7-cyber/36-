import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  RecordDocumentUsageBody,
  RecordDocumentUsageResponse,
  RenderSamplePdfBody,
  RenderSamplePdfResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { requireUser, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.post("/documents/pdf", (req, res): void => {
  const parsed = RenderSamplePdfBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.status(202).json(
    RenderSamplePdfResponse.parse({
      status: "not_configured",
      message:
        "Sample PDF export is reserved for the configured server renderer. Browser print is available now.",
    }),
  );
});

router.post("/documents/usage", requireUser, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).auth?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  const parsed = RecordDocumentUsageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Customer account not found." });
    return;
  }
  if (user.slipsUsed >= user.slipLimit) {
    res.status(409).json({ error: "This plan has reached its slip limit." });
    return;
  }

  const updates = parsed.data.kind === "pdf"
    ? {
        slipsUsed: sql`${usersTable.slipsUsed} + 1`,
        pdfPrintCount: sql`${usersTable.pdfPrintCount} + 1`,
      }
    : {
        slipsUsed: sql`${usersTable.slipsUsed} + 1`,
        browserPrintCount: sql`${usersTable.browserPrintCount} + 1`,
      };
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();
  res.json(RecordDocumentUsageResponse.parse({
    kind: parsed.data.kind,
    slipsUsed: updated.slipsUsed,
    slipLimit: updated.slipLimit,
    remaining: Math.max(updated.slipLimit - updated.slipsUsed, 0),
  }));
});

export default router;