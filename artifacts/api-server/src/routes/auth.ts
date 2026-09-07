import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdminLoginBody,
  AdminLoginResponse,
  GetAdminSessionResponse,
  GetUserSessionResponse,
  TokenLoginBody,
  TokenLoginResponse,
} from "@workspace/api-zod";
import {
  accessTokensTable,
  auditEventsTable,
  db,
  sessionsTable,
  tokenLoginAttemptsTable,
  usersTable,
} from "@workspace/db";
import {
  createSession,
  destroySession,
  hashSecret,
  requireAdmin,
  requireUser,
  validateAdminCredentials,
  type AuthenticatedRequest,
} from "../lib/auth";
import { serializeUser } from "../lib/depslip";

const router: IRouter = Router();

router.post("/auth/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validateAdminCredentials(parsed.data.username, parsed.data.password)) {
    req.log.warn("Rejected admin login attempt");
    res.status(401).json({ error: "Invalid admin credentials." });
    return;
  }
  await createSession(res, "admin");
  res.json(AdminLoginResponse.parse({ authenticated: true, role: "admin" }));
});

router.post("/auth/admin/logout", async (req, res): Promise<void> => {
  await destroySession(req, res, "admin");
  res.sendStatus(204);
});

router.get("/auth/admin/session", requireAdmin, (req, res): void => {
  res.json(GetAdminSessionResponse.parse({ authenticated: true, role: "admin" }));
});

router.post("/auth/token/login", async (req, res): Promise<void> => {
  const parsed = TokenLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const tokenHash = hashSecret(parsed.data.token);
  const fingerprint = hashSecret(`${req.ip ?? "unknown"}|${req.headers["user-agent"] ?? "unknown"}|${tokenHash}`);
  const [attempt] = await db
    .select()
    .from(tokenLoginAttemptsTable)
    .where(eq(tokenLoginAttemptsTable.fingerprint, fingerprint))
    .limit(1);

  const [accessToken] = await db
    .select()
    .from(accessTokensTable)
    .where(eq(accessTokensTable.tokenHash, tokenHash))
    .limit(1);
  if (!accessToken || accessToken.status !== "active") {
    if (attempt?.lockoutUntil && attempt.lockoutUntil > new Date()) {
      res.status(423).json({ error: "Too many failed attempts for this token. Try again in about one hour." });
      return;
    }
    const failedAttempts = (attempt?.failedAttempts ?? 0) + 1;
    const lockoutUntil = failedAttempts >= 3 ? new Date(Date.now() + 60 * 60 * 1000) : null;
    if (attempt) {
      await db
        .update(tokenLoginAttemptsTable)
        .set({ failedAttempts, lockoutUntil, updatedAt: new Date() })
        .where(eq(tokenLoginAttemptsTable.id, attempt.id));
    } else {
      await db.insert(tokenLoginAttemptsTable).values({
        fingerprint,
        failedAttempts,
        lockoutUntil,
      });
    }
    res.status(lockoutUntil ? 423 : 401).json({
      error: lockoutUntil
        ? "Too many failed attempts. Try again in about one hour."
        : "That access token is not valid.",
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, accessToken.userId)).limit(1);
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "This account is unavailable." });
    return;
  }
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    res.status(423).json({ error: "This account is temporarily locked. Try again later." });
    return;
  }

  if (attempt) {
    await db
      .update(tokenLoginAttemptsTable)
      .set({ failedAttempts: 0, lockoutUntil: null, updatedAt: new Date() })
      .where(eq(tokenLoginAttemptsTable.id, attempt.id));
  }
  await createSession(res, "user", user.id);
  res.json(TokenLoginResponse.parse({ authenticated: true, user: serializeUser(user) }));
});

router.post("/auth/token/logout", async (req, res): Promise<void> => {
  await destroySession(req, res, "user");
  res.sendStatus(204);
});

router.get("/auth/session", requireUser, (req, res): void => {
  const user = (req as AuthenticatedRequest).auth?.user;
  if (!user) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  res.json(GetUserSessionResponse.parse({ authenticated: true, user: serializeUser(user) }));
});

router.delete("/auth/session", requireUser, async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).auth?.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Customer token session required." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(usersTable).set({ status: "deleted" }).where(eq(usersTable.id, userId));
    await tx.update(accessTokensTable)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(accessTokensTable.userId, userId));
    await tx.delete(sessionsTable).where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.scope, "user")));
    await tx.insert(auditEventsTable).values({
      actorRole: "customer",
      actorId: userId,
      action: "delete_account",
      targetType: "user",
      targetId: userId,
      metadata: {},
    });
  });
  await destroySession(req, res, "user");
  res.sendStatus(204);
});

export default router;