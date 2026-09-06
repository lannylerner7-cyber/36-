import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("depslip_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull().default("active"),
  slipLimit: integer("slip_limit").notNull().default(0),
  slipsUsed: integer("slips_used").notNull().default(0),
  designLimit: integer("design_limit").notNull().default(0),
  designsUsed: integer("designs_used").notNull().default(0),
  pdfPrintCount: integer("pdf_print_count").notNull().default(0),
  browserPrintCount: integer("browser_print_count").notNull().default(0),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const accessTokensTable = pgTable("depslip_access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  encryptedToken: text("encrypted_token").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const sessionsTable = pgTable("depslip_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  userId: uuid("user_id").references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenLoginAttemptsTable = pgTable("depslip_token_login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  fingerprint: text("fingerprint").notNull().unique(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const payeesTable = pgTable("depslip_payees", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  bankName: text("bank_name").notNull(),
  bankAddress: text("bank_address").notNull(),
  routingNumberEncrypted: text("routing_number_encrypted").notNull(),
  accountNumberEncrypted: text("account_number_encrypted").notNull(),
  bankLogoUrl: text("bank_logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable("depslip_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number").notNull().unique(),
  userId: uuid("user_id").references(() => usersTable.id),
  planId: text("plan_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("pending"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  acceptedPaymentTerms: text("accepted_payment_terms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentSettingsTable = pgTable("depslip_payment_settings", {
  id: text("id").primaryKey(),
  bitcoinWallet: text("bitcoin_wallet").notNull().default(""),
  bitcoinQrUrl: text("bitcoin_qr_url"),
  bitcoinInstructions: text("bitcoin_instructions").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const auditEventsTable = pgTable("depslip_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorRole: text("actor_role").notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAccessTokenSchema = createInsertSchema(accessTokensTable).omit({
  id: true,
  createdAt: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertTokenLoginAttemptSchema = createInsertSchema(tokenLoginAttemptsTable).omit({
  id: true,
  updatedAt: true,
});
export const insertPayeeSchema = createInsertSchema(payeesTable).omit({
  id: true,
  createdAt: true,
});
export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPaymentSettingsSchema = createInsertSchema(paymentSettingsTable).omit({
  updatedAt: true,
});
export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type AccessToken = typeof accessTokensTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type TokenLoginAttempt = typeof tokenLoginAttemptsTable.$inferSelect;
export type Payee = typeof payeesTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type PaymentSettings = typeof paymentSettingsTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;