import type { Order, User } from "@workspace/db";

export const PLANS = {
  starter: {
    id: "starter",
    name: "Starter",
    priceCents: 1200,
    currency: "USD",
    slipLimit: 15,
    designLimit: 1,
    billing: "one_time",
    description: "15 deposit slips with one design.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 2100,
    currency: "USD",
    slipLimit: 30,
    designLimit: 2,
    billing: "one_time",
    description: "30 deposit slips with two designs.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceCents: 4500,
    currency: "USD",
    slipLimit: 70,
    designLimit: -1,
    billing: "monthly",
    description: "70 slips each month with unlimited designs.",
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlan(planId: string): (typeof PLANS)[PlanId] | undefined {
  return PLANS[planId as PlanId];
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    slipLimit: user.slipLimit,
    slipsUsed: user.slipsUsed,
    designLimit: user.designLimit,
    designsUsed: user.designsUsed,
    pdfPrintCount: user.pdfPrintCount,
    browserPrintCount: user.browserPrintCount,
    lockoutUntil: user.lockoutUntil?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeOrder(order: Order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    planId: order.planId,
    name: order.name,
    email: order.email,
    paymentMethod: order.paymentMethod,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    acceptedPaymentTerms: order.acceptedPaymentTerms === "true",
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function makeOrderNumber(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DS-${new Date().getFullYear()}-${suffix}`;
}