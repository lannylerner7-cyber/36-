import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";

const ADMIN_COOKIE = "depslip_admin_session";
const USER_COOKIE = "depslip_user_session";
const SESSION_DAYS = 30;

export type AuthContext = {
  scope: "admin" | "user";
  user?: User;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthContext;
};

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getEncryptionKey(): Buffer {
  const secret = process.env["TOKEN_ENCRYPTION_KEY"];
  if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptSecret(value: string): string {
  const [ivHex, tagHex, ciphertextHex] = value.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error("Invalid encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}

export function hashSecret(value: string): string {
  return hashValue(value);
}

export function generateAccessToken(): string {
  return `DS-${crypto.randomBytes(32).toString("base64url")}`;
}

export function getSessionCookie(scope: "admin" | "user"): string {
  return scope === "admin" ? ADMIN_COOKIE : USER_COOKIE;
}

export async function createSession(
  response: Response,
  scope: "admin" | "user",
  userId?: string,
): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({
    tokenHash: hashValue(rawToken),
    scope,
    userId: userId ?? null,
    expiresAt,
  });
  response.cookie(getSessionCookie(scope), rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export async function destroySession(request: Request, response: Response, scope: "admin" | "user"): Promise<void> {
  const rawToken = request.cookies?.[getSessionCookie(scope)] as string | undefined;
  if (rawToken) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashValue(rawToken)));
  response.clearCookie(getSessionCookie(scope), { httpOnly: true, sameSite: "lax", path: "/" });
}

async function getAuthContext(request: Request, scope: "admin" | "user"): Promise<AuthContext | null> {
  const rawToken = request.cookies?.[getSessionCookie(scope)] as string | undefined;
  if (!rawToken) return null;
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.tokenHash, hashValue(rawToken)), eq(sessionsTable.scope, scope), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;
  if (scope === "admin") return { scope };
  if (!session.userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user || user.status !== "active") return null;
  return { scope, user };
}

export async function requireAdmin(request: Request, response: Response, next: NextFunction): Promise<void> {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    response.status(401).json({ error: "Admin session required." });
    return;
  }
  (request as AuthenticatedRequest).auth = auth;
  next();
}

export async function requireUser(request: Request, response: Response, next: NextFunction): Promise<void> {
  const auth = await getAuthContext(request, "user");
  if (!auth?.user) {
    response.status(401).json({ error: "Customer token session required." });
    return;
  }
  (request as AuthenticatedRequest).auth = auth;
  next();
}

export function validateAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env["ADMIN_USERNAME"];
  const expectedPassword = process.env["ADMIN_PASSWORD"];
  if (!expectedUsername || !expectedPassword) return false;
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}