import { getTranslations } from "next-intl/server";
import type { Role } from "@prisma/client";

/** Server-side action error helper (locale from next-intl request config). */
export async function actionError(key: string): Promise<string> {
  const t = await getTranslations("actions");
  // Keys are validated against messages/actions.* at call sites.
  return t(key as "invalidData");
}

export async function getLabelMaps() {
  const t = await getTranslations("labels");
  return {
    roles: {
      ADMIN: t("roles.ADMIN"),
      MANAGER: t("roles.MANAGER"),
      LAWYER: t("roles.LAWYER"),
      SUPPORT: t("roles.SUPPORT"),
    } satisfies Record<Role, string>,
    matterStatus: {
      NEW: t("matterStatus.NEW"),
      IN_PROGRESS: t("matterStatus.IN_PROGRESS"),
      ON_HOLD: t("matterStatus.ON_HOLD"),
      CLOSED: t("matterStatus.CLOSED"),
      ARCHIVED: t("matterStatus.ARCHIVED"),
    },
    matterType: {
      CIVIL: t("matterType.CIVIL"),
      CRIMINAL: t("matterType.CRIMINAL"),
      CORPORATE: t("matterType.CORPORATE"),
      LABOR: t("matterType.LABOR"),
      FAMILY: t("matterType.FAMILY"),
      OTHER: t("matterType.OTHER"),
    },
    planStepStatus: {
      NOT_STARTED: t("planStepStatus.NOT_STARTED"),
      IN_PROGRESS: t("planStepStatus.IN_PROGRESS"),
      DONE: t("planStepStatus.DONE"),
      BLOCKED: t("planStepStatus.BLOCKED"),
    },
    taskStatus: {
      TODO: t("taskStatus.TODO"),
      IN_PROGRESS: t("taskStatus.IN_PROGRESS"),
      DONE: t("taskStatus.DONE"),
      CANCELLED: t("taskStatus.CANCELLED"),
    },
    taskPriority: {
      LOW: t("taskPriority.LOW"),
      MEDIUM: t("taskPriority.MEDIUM"),
      HIGH: t("taskPriority.HIGH"),
      URGENT: t("taskPriority.URGENT"),
    },
    notificationType: {
      TASK_ASSIGNED: t("notificationType.TASK_ASSIGNED"),
      TASK_DUE: t("notificationType.TASK_DUE"),
      GENERAL: t("notificationType.GENERAL"),
      MENTION: t("notificationType.MENTION"),
    },
    clientBusinessType: {
      LLC: t("clientBusinessType.LLC"),
      JSC: t("clientBusinessType.JSC"),
      SOLE_PROPRIETOR: t("clientBusinessType.SOLE_PROPRIETOR"),
      PARTNERSHIP: t("clientBusinessType.PARTNERSHIP"),
      INDIVIDUAL: t("clientBusinessType.INDIVIDUAL"),
      OTHER: t("clientBusinessType.OTHER"),
    },
  };
}
