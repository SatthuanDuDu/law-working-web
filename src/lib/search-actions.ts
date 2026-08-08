"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleClientIds, getAccessibleMatterIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";

const RESULTS_PER_GROUP = 6;
const MIN_QUERY_LENGTH = 2;

export type GlobalSearchMatter = {
  id: string;
  code: string;
  title: string;
  clientName: string;
};

export type GlobalSearchClient = {
  id: string;
  code: string;
  name: string;
};

export type GlobalSearchTask = {
  id: string;
  title: string;
  matterId: string | null;
};

export type GlobalSearchResult = {
  matters: GlobalSearchMatter[];
  clients: GlobalSearchClient[];
  tasks: GlobalSearchTask[];
};

const EMPTY_RESULT: GlobalSearchResult = { matters: [], clients: [], tasks: [] };

export async function globalSearchAction(rawQuery: string): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return EMPTY_RESULT;

  const user = await requireAuth();
  const [matterIds, clientIds] = await Promise.all([
    getAccessibleMatterIds(user.id, user.role),
    getAccessibleClientIds(user.id, user.role),
  ]);

  const matterWhere = matterIds ? { id: { in: matterIds } } : {};
  const clientWhere = clientIds ? { id: { in: clientIds } } : {};
  const canViewAllTasks = isManagerOrAbove(user.role);
  const taskWhere = canViewAllTasks ? {} : { assigneeId: user.id };

  const [matters, clients, tasks] = await Promise.all([
    prisma.matter.findMany({
      where: {
        deletedAt: null,
        ...matterWhere,
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { client: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: { id: true, code: true, title: true, client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_GROUP,
    }),
    prisma.client.findMany({
      where: {
        deletedAt: null,
        ...clientWhere,
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
      take: RESULTS_PER_GROUP,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        title: { contains: query, mode: "insensitive" },
      },
      select: { id: true, title: true, matterId: true },
      orderBy: { updatedAt: "desc" },
      take: RESULTS_PER_GROUP,
    }),
  ]);

  return {
    matters: matters.map((matter) => ({
      id: matter.id,
      code: matter.code,
      title: matter.title,
      clientName: matter.client.name,
    })),
    clients,
    tasks,
  };
}
