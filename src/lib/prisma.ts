import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  /** Bump when schema gains fields on existing models (HMR keeps old engine). */
  prismaSchemaRev?: number;
};

/** Soft-delete + PLAN_DUE + perf indexes — must recreate cached client. */
const PRISMA_SCHEMA_REV = 2;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  const staleRev = globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV;
  // After `prisma generate`, a cached client can miss new delegates/fields until recreate.
  const staleDelegate = Boolean(existing && !("matterPlanStepAssignee" in existing));
  if (existing && (staleRev || staleDelegate)) {
    void existing.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  }

  return globalForPrisma.prisma;
}

/**
 * Lazy proxy so HMR / schema-rev bumps always hit a fresh client
 * (a plain `export const prisma = …` can keep a stale instance).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
