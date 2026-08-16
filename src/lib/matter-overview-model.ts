import type {
  MatterPlanStepStatus,
  MatterStatus,
  MatterType,
  TaskPriority,
} from "@prisma/client";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { formatDateTime } from "@/lib/utils";

export type MatterOverviewComment = {
  when: string;
  authorName: string;
  body: string;
};

/** Status tint shared by the PDF and Word exports. */
export type MatterOverviewTone =
  | "info"
  | "warn"
  | "success"
  | "danger"
  | "neutral";

const MATTER_STATUS_TONE: Record<MatterStatus, MatterOverviewTone> = {
  NEW: "info",
  IN_PROGRESS: "warn",
  ON_HOLD: "danger",
  CLOSED: "success",
  ARCHIVED: "neutral",
};

const STEP_STATUS_TONE: Record<MatterPlanStepStatus, MatterOverviewTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warn",
  DONE: "success",
  BLOCKED: "danger",
};

export type MatterOverviewStep = {
  index: number;
  total: number;
  title: string;
  workType: string | null;
  status: string;
  statusTone: MatterOverviewTone;
  priority: string;
  startedAt: string | null;
  dueAt: string | null;
  assignees: string;
  location: string | null;
  comments: MatterOverviewComment[];
};

export type MatterOverviewSummary = {
  total: number;
  notStarted: number;
  inProgress: number;
  done: number;
  blocked: number;
};

export type MatterOverviewModel = {
  exportedAt: string;
  title: string;
  code: string;
  status: string;
  statusTone: MatterOverviewTone;
  type: string;
  createdAt: string;
  clientName: string;
  clientPhone: string | null;
  clientAddress: string | null;
  leadLawyerName: string;
  members: string;
  description: string | null;
  summary: MatterOverviewSummary;
  steps: MatterOverviewStep[];
  generalComments: MatterOverviewComment[];
};

export type MatterOverviewLabels = {
  matterStatus: Record<MatterStatus, string>;
  planStepStatus: Record<MatterPlanStepStatus, string>;
  taskPriority: Record<TaskPriority, string>;
};

type CommentLike = {
  body: string;
  createdAt: Date | string;
  author: { name: string };
};

type StepAssignee =
  | { user: { name: string } }
  | { name: string };

type StepLike = {
  title: string;
  status: MatterPlanStepStatus;
  priority: TaskPriority;
  startedAt: Date | string | null;
  dueAt: Date | string | null;
  sortOrder: number;
  workType: { name: string } | null;
  assignees: StepAssignee[];
  locationName: string | null;
  locationAddress: string | null;
  comments: CommentLike[];
};

function formatWhen(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  try {
    return formatDateTime(value);
  } catch {
    return String(value);
  }
}

function formatComment(c: CommentLike): MatterOverviewComment {
  return {
    when: formatWhen(c.createdAt) ?? "—",
    authorName: c.author.name,
    body: c.body.trim() || "—",
  };
}

function formatLocation(
  name: string | null,
  address: string | null,
): string | null {
  const parts = [name?.trim(), address?.trim()].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
}

function assigneeNames(step: StepLike): string {
  const names = step.assignees.map((a) =>
    "user" in a ? a.user.name : a.name,
  );
  return names.filter(Boolean).join(", ") || "—";
}

export function buildMatterOverview(input: {
  matter: {
    title: string;
    code: string;
    status: MatterStatus;
    type: MatterType;
    customTypeLabel: string | null;
    description: string | null;
    createdAt: Date | string;
    client: {
      name: string;
      phone: string | null;
      address: string | null;
      city: string | null;
    };
    leadLawyer: { id: string; name: string };
    members: { userId: string; user: { id: string; name: string } }[];
  };
  planSteps: StepLike[];
  generalComments: CommentLike[];
  labels: MatterOverviewLabels;
}): MatterOverviewModel {
  const { matter, labels } = input;
  const stepsSorted = [...input.planSteps].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const total = stepsSorted.length;

  const summary: MatterOverviewSummary = {
    total,
    notStarted: stepsSorted.filter((s) => s.status === "NOT_STARTED").length,
    inProgress: stepsSorted.filter((s) => s.status === "IN_PROGRESS").length,
    done: stepsSorted.filter((s) => s.status === "DONE").length,
    blocked: stepsSorted.filter((s) => s.status === "BLOCKED").length,
  };

  const address = [matter.client.address, matter.client.city]
    .filter(Boolean)
    .join(", ");

  const membersDisplay =
    matter.members
      .filter((m) => m.userId !== matter.leadLawyer.id)
      .map((m) => m.user.name)
      .join(", ") || "—";

  return {
    exportedAt: formatDateTime(new Date()),
    title: matter.title,
    code: matter.code,
    status: labels.matterStatus[matter.status] ?? matter.status,
    statusTone: MATTER_STATUS_TONE[matter.status] ?? "neutral",
    type: getMatterTypeDisplay(matter.type, matter.customTypeLabel),
    createdAt: formatWhen(matter.createdAt) ?? "—",
    clientName: matter.client.name,
    clientPhone: matter.client.phone?.trim() || null,
    clientAddress: address || null,
    leadLawyerName: matter.leadLawyer.name,
    members: membersDisplay,
    description: matter.description?.trim() || null,
    summary,
    steps: stepsSorted.map((step, i) => ({
      index: i + 1,
      total,
      title: step.title,
      workType: step.workType?.name ?? null,
      status: labels.planStepStatus[step.status] ?? step.status,
      statusTone: STEP_STATUS_TONE[step.status] ?? "neutral",
      priority: labels.taskPriority[step.priority] ?? step.priority,
      startedAt: formatWhen(step.startedAt),
      dueAt: formatWhen(step.dueAt),
      assignees: assigneeNames(step),
      location: formatLocation(step.locationName, step.locationAddress),
      comments: step.comments.map(formatComment),
    })),
    generalComments: input.generalComments.map(formatComment),
  };
}

export function matterOverviewFilenameBase(code: string): string {
  const safe = code.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  return `vu-viec-${safe}-tong-quan`;
}
