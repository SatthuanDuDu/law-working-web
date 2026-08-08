import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const LOOKUP_TTL_SECONDS = 180;

export const WORK_TYPES_TAG = "work-types";
export const ATTACHMENT_LABELS_TAG = "attachment-labels";
export const DEPARTMENTS_TAG = "departments";

export type CachedWorkType = { id: string; name: string };
export type CachedAttachmentLabel = { id: string; name: string };
export type CachedDepartment = { id: string; name: string };

export const getCachedWorkTypes = unstable_cache(
  async (): Promise<CachedWorkType[]> =>
    prisma.workType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["cached-work-types"],
  { revalidate: LOOKUP_TTL_SECONDS, tags: [WORK_TYPES_TAG] },
);

export const getCachedAttachmentLabels = unstable_cache(
  async (): Promise<CachedAttachmentLabel[]> =>
    prisma.attachmentLabel.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["cached-attachment-labels"],
  { revalidate: LOOKUP_TTL_SECONDS, tags: [ATTACHMENT_LABELS_TAG] },
);

export const getCachedDepartments = unstable_cache(
  async (): Promise<CachedDepartment[]> =>
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ["cached-departments"],
  { revalidate: LOOKUP_TTL_SECONDS, tags: [DEPARTMENTS_TAG] },
);
