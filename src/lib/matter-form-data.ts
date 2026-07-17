import { countTodayMatters } from "@/lib/matter-code";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

export type MatterFormData = {
  currentUser: { id: string; name: string; role: SessionUser["role"] };
  todayMatterCount: number;
  clients: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
  }[];
  lawyers: { id: string; name: string; role: SessionUser["role"] }[];
  members: { id: string; name: string; role: SessionUser["role"] }[];
};

export type MatterFilterOptions = Pick<MatterFormData, "clients" | "lawyers" | "members">;

export async function getMatterFilterOptions(): Promise<MatterFilterOptions> {
  const [clients, lawyers, members] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["LAWYER", "MANAGER", "ADMIN"] }, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { clients, lawyers, members };
}

export async function getMatterFormData(user: SessionUser): Promise<MatterFormData> {
  const [clients, lawyers, members, todayMatterCount] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["LAWYER", "MANAGER", "ADMIN"] }, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    countTodayMatters(prisma),
  ]);

  return {
    currentUser: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    todayMatterCount,
    clients,
    lawyers,
    members,
  };
}
