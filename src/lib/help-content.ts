export type HelpContextKey =
  | "default"
  | "dashboard"
  | "mattersList"
  | "matterHub"
  | "matterPlan"
  | "matterReport"
  | "chat"
  | "tasks"
  | "calendar"
  | "expenses"
  | "clients"
  | "admin";

export type HelpFaqId =
  | "createMatter"
  | "matterMembers"
  | "planSteps"
  | "uploadDocs"
  | "fileAccess"
  | "comments"
  | "chatUse"
  | "expenses"
  | "roles";

/** All FAQ chips in display order. */
export const HELP_FAQ_IDS: HelpFaqId[] = [
  "createMatter",
  "matterMembers",
  "planSteps",
  "uploadDocs",
  "fileAccess",
  "comments",
  "chatUse",
  "expenses",
  "roles",
];

/** Suggested FAQ ids to surface first for the current page. */
export const HELP_FAQ_SUGGESTED: Record<HelpContextKey, HelpFaqId[]> = {
  default: ["createMatter", "roles", "comments"],
  dashboard: ["createMatter", "expenses", "roles"],
  mattersList: ["createMatter", "matterMembers", "roles"],
  matterHub: ["uploadDocs", "fileAccess", "matterMembers"],
  matterPlan: ["planSteps", "uploadDocs", "comments"],
  matterReport: ["comments", "uploadDocs", "planSteps"],
  chat: ["chatUse", "comments", "roles"],
  tasks: ["createMatter", "planSteps", "roles"],
  calendar: ["planSteps", "createMatter", "comments"],
  expenses: ["expenses", "createMatter", "roles"],
  clients: ["createMatter", "roles", "matterMembers"],
  admin: ["roles", "createMatter", "fileAccess"],
};

export function resolveHelpContext(pathname: string): HelpContextKey {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (pathname === "/matters") return "mattersList";
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return "chat";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "tasks";
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) {
    return "calendar";
  }
  if (pathname === "/expenses" || pathname.startsWith("/expenses/")) {
    return "expenses";
  }
  if (pathname === "/clients" || pathname.startsWith("/clients/")) {
    return "clients";
  }
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/work-types") ||
    pathname.startsWith("/departments") ||
    pathname.startsWith("/attachment-labels") ||
    pathname.startsWith("/audit") ||
    pathname.startsWith("/workload") ||
    pathname.startsWith("/settings")
  ) {
    return "admin";
  }

  const matterMatch = pathname.match(
    /^\/matters\/([^/]+)(?:\/(plan|report))?\/?$/,
  );
  if (matterMatch) {
    const section = matterMatch[2];
    if (section === "plan") return "matterPlan";
    if (section === "report") return "matterReport";
    return "matterHub";
  }

  return "default";
}

/** Suggested chips first, then the remaining FAQs. */
export function suggestedFaqIds(context: HelpContextKey): HelpFaqId[] {
  const suggested = HELP_FAQ_SUGGESTED[context] ?? [];
  const rest = HELP_FAQ_IDS.filter((id) => !suggested.includes(id));
  return [...suggested, ...rest];
}
