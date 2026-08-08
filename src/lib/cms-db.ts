import { PrismaClient } from "@/generated/cms-client";

const globalForCms = globalThis as unknown as {
  cmsPrisma: PrismaClient | undefined;
};

function createCmsClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function getCmsDb() {
  if (!globalForCms.cmsPrisma) {
    globalForCms.cmsPrisma = createCmsClient();
  }
  return globalForCms.cmsPrisma;
}

/** Convenience alias — same singleton as getCmsDb(). */
export const cmsDb = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getCmsDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
