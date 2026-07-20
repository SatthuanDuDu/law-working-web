"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  createDirectConversationAction,
  createGroupConversationAction,
  listConversationsAction,
  listMessagesAction,
  listStaffForChatAction,
  markConversationReadAction,
  sendChatMessageAction,
} from "@/lib/chat-actions";
import { LocationPicker } from "@/components/location/location-picker";
import { LocationChip } from "@/components/location/location-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn, formatDate } from "@/lib/utils";
import {
  appendLocationToFormData,
  type LocationValue,
} from "@/lib/location";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

type Staff = {
  id: string;
  name: string;
  username: string;
  avatarKey: string | null;
  role?: string;
};

type ConversationItem = {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  title: string;
  updatedAt: string;
  members: { id: string; name: string; username: string; avatarKey: string | null }[];
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    senderName: string;
  } | null;
  unread: boolean;
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username: string;
    avatarKey: string | null;
  };
  mentionUserIds: string[];
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }[];
  location: LocationValue | null;
};

type PendingFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function encodeMentions(text: string, staff: Staff[]) {
  let body = text;
  const used = staff.filter((m) => text.includes(`@${m.username}`));
  for (const m of used) {
    body = body.split(`@${m.username}`).join(`@[${m.username}](${m.id})`);
  }
  return { body, mentionedUserIds: used.map((m) => m.id) };
}

function renderBody(body: string) {
  const parts = body.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <span key={i} className="font-semibold text-primary">
          @{match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatMessageTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDaySectionLabel(
  iso: string,
  locale: string,
  labels: { today: string; yesterday: string },
) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameCalendarDay(date, today)) return labels.today;
  if (sameCalendarDay(date, yesterday)) return labels.yesterday;
  return formatDate(date, locale);
}

function stripMentionMarkup(body: string) {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

export function ChatWorkspace({
  initialConversationId = null,
}: {
  initialConversationId?: string | null;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { data: session } = useSession();
  const meId = session?.user?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversationId || searchParams.get("c"),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const mentionCandidates = useMemo(() => {
    const pool =
      active?.type === "GROUP"
        ? active.members
            .filter((m) => m.id !== meId)
            .map((m) => ({
              id: m.id,
              name: m.name,
              username: m.username,
              avatarKey: m.avatarKey,
            }))
        : staff;
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return pool
      .filter(
        (s) =>
          s.username.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [active, staff, mentionQuery, meId]);

  const filteredConversations = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = [
        c.title,
        c.name ?? "",
        ...c.members.map((m) => `${m.name} ${m.username}`),
        c.lastMessage?.body ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, sidebarQuery]);

  const staffMatches = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return staff
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [staff, sidebarQuery]);

  const groupStaff = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q),
    );
  }, [staff, groupQuery]);

  const messageItems = useMemo(() => {
    const items: Array<
      | { kind: "day"; key: string; label: string }
      | { kind: "message"; message: ChatMessage }
    > = [];
    let lastDay: string | null = null;
    for (const message of messages) {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        items.push({
          kind: "day",
          key: `day-${key}`,
          label: formatDaySectionLabel(message.createdAt, locale, {
            today: t("today"),
            yesterday: t("yesterday"),
          }),
        });
        lastDay = key;
      }
      items.push({ kind: "message", message });
    }
    return items;
  }, [messages, locale, t]);

  const refreshConversations = useCallback(async () => {
    const res = await listConversationsAction();
    if ("conversations" in res) setConversations(res.conversations);
  }, []);

  const loadMessages = useCallback(
    async (
      conversationId: string,
      opts?: { after?: string | null; replace?: boolean },
    ) => {
      const res = await listMessagesAction(conversationId, {
        after: opts?.after ?? null,
      });
      if ("error" in res && res.error) return;
      const next = res.messages ?? [];
      if (opts?.replace || !opts?.after) {
        setMessages(next);
        lastIdRef.current = next[next.length - 1]?.id ?? null;
      } else if (next.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...next.filter((m) => !ids.has(m.id))];
          lastIdRef.current = merged[merged.length - 1]?.id ?? null;
          return merged;
        });
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [convRes, staffRes] = await Promise.all([
        listConversationsAction(),
        listStaffForChatAction(),
      ]);
      if (cancelled) return;
      if ("conversations" in convRes) setConversations(convRes.conversations);
      if ("staff" in staffRes) setStaff(staffRes.staff);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      lastIdRef.current = null;
      void Promise.resolve().then(() => {
        if (!cancelled) setMessages([]);
      });
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      await loadMessages(activeId, { replace: true });
      if (cancelled) return;
      await markConversationReadAction(activeId);
      if (cancelled) return;
      await refreshConversations();
      if (!cancelled) router.replace(`/chat?c=${activeId}`, { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, loadMessages, refreshConversations, router]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadMessages(activeId, { after: lastIdRef.current });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshConversations();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function updateDraft(next: string) {
    setDraft(next);
    const cursorMatch = next.match(/@([a-z0-9_]*)$/i);
    if (cursorMatch) {
      setMentionQuery(cursorMatch[1] ?? "");
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(user: Staff) {
    setDraft((prev) => prev.replace(/@([a-z0-9_]*)$/i, `@${user.username} `));
    setMentionQuery(null);
  }

  async function uploadFile(file: File) {
    if (!activeId) return;
    if (file.size <= 0 || file.size > MAX_SIZE_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const prepare = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          conversationId: activeId,
        }),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) {
        setError(prepared.error || t("uploadFailed"));
        return;
      }
      const { putAttachmentBytes } = await import("@/lib/browser-upload");
      const uploaded = await putAttachmentBytes({
        attachmentId: prepared.attachment.id,
        uploadUrl: prepared.uploadUrl,
        file,
        mimeType: file.type || "application/octet-stream",
      });
      if (!uploaded.ok) {
        await fetch(`/api/attachments/${prepared.attachment.id}`, {
          method: "DELETE",
        });
        setError(t("uploadFailed"));
        return;
      }
      setPendingFiles((prev) => [
        ...prev,
        {
          id: prepared.attachment.id,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  }

  function handleSend() {
    if (!activeId) return;
    const text = draft.trim();
    if (!text && pendingFiles.length === 0 && !location) return;

    const pool =
      active?.members.map((m) => ({
        id: m.id,
        name: m.name,
        username: m.username,
        avatarKey: m.avatarKey,
      })) ?? staff;
    const { body, mentionedUserIds } = encodeMentions(text, pool);

    const formData = new FormData();
    formData.set("body", body);
    formData.set("mentionedUserIds", JSON.stringify(mentionedUserIds));
    formData.set(
      "attachmentIds",
      JSON.stringify(pendingFiles.map((f) => f.id)),
    );
    appendLocationToFormData(formData, location);

    startTransition(async () => {
      const result = await sendChatMessageAction(activeId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      setPendingFiles([]);
      setLocation(null);
      setShowLocation(false);
      setError(null);
      await loadMessages(activeId, { replace: true });
      await refreshConversations();
    });
  }

  function startDm(userId: string) {
    startTransition(async () => {
      const res = await createDirectConversationAction(userId);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSidebarQuery("");
      setShowGroup(false);
      await refreshConversations();
      if (res.conversationId) setActiveId(res.conversationId);
    });
  }

  function createGroup() {
    const formData = new FormData();
    formData.set("name", groupName);
    formData.set("memberIds", JSON.stringify(selectedMembers));
    startTransition(async () => {
      const res = await createGroupConversationAction(formData);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setShowGroup(false);
      setGroupName("");
      setGroupQuery("");
      setSelectedMembers([]);
      await refreshConversations();
      if (res.conversationId) setActiveId(res.conversationId);
    });
  }

  const showThread = Boolean(activeId);

  return (
    <div className="flex h-[min(70dvh,680px)] min-h-[24rem] overflow-hidden rounded-md border border-border bg-surface sm:h-[min(76dvh,760px)]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex w-full flex-col border-border bg-muted/20 sm:w-[17.5rem] sm:border-r lg:w-80",
          showThread ? "hidden sm:flex" : "flex",
        )}
      >
        <div className="space-y-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {t("conversations")}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="interactive-press h-8 gap-1 px-2"
              onClick={() => setShowGroup(true)}
              title={t("newGroup")}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{t("newGroup")}</span>
            </Button>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder={t("searchUser")}
              className="h-9 pl-8 text-base sm:text-sm"
              autoComplete="off"
            />
            {sidebarQuery ? (
              <button
                type="button"
                className="interactive-press absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarQuery("")}
                aria-label={t("clearSearch")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {staffMatches.length > 0 ? (
            <div className="border-b border-border/70 px-2 py-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("people")}
              </p>
              <ul className="space-y-0.5">
                {staffMatches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => startDm(s.id)}
                      className="interactive-press flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <UserAvatar
                        userId={s.id}
                        name={s.name}
                        avatarKey={s.avatarKey}
                        className="h-8 w-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {s.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          @{s.username}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {filteredConversations.length === 0 && staffMatches.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-7 w-7 opacity-40" />
              <p>{sidebarQuery ? t("noSearchResults") : t("empty")}</p>
              <p className="mt-1 text-xs">{t("searchUserHint")}</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="py-1">
              {sidebarQuery ? (
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("conversations")}
                </p>
              ) : null}
              {filteredConversations.map((c) => {
                const peer = c.members.find((m) => m.id !== meId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "interactive-press flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/80",
                      activeId === c.id && "bg-primary/10",
                    )}
                  >
                    <UserAvatar
                      userId={peer?.id ?? c.id}
                      name={c.title}
                      avatarKey={peer?.avatarKey ?? null}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {c.title}
                        </p>
                        {c.lastMessage ? (
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {formatMessageTime(c.lastMessage.createdAt, locale)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {c.lastMessage
                            ? stripMentionMarkup(c.lastMessage.body) || "—"
                            : "—"}
                        </p>
                        {c.unread ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" title={t("unread")} />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-surface",
          showThread ? "flex" : "hidden sm:flex",
        )}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-9 w-9 opacity-35" />
            <p>{t("emptyHint")}</p>
            <p className="text-xs">{t("searchUserHint")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-press h-8 w-8 sm:hidden"
                onClick={() => setActiveId(null)}
                aria-label={t("back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <UserAvatar
                userId={
                  active.members.find((m) => m.id !== meId)?.id ?? active.id
                }
                name={active.title}
                avatarKey={
                  active.members.find((m) => m.id !== meId)?.avatarKey ?? null
                }
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {active.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {active.type === "GROUP"
                    ? t("memberCount", { count: active.members.length })
                    : `@${active.members.find((m) => m.id !== meId)?.username ?? ""}`}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t("noMessages")}
                </p>
              ) : (
                messageItems.map((item) => {
                  if (item.kind === "day") {
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-3 py-2"
                        role="separator"
                        aria-label={item.label}
                      >
                        <div className="h-px flex-1 bg-border" />
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.label}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    );
                  }

                  const m = item.message;
                  const mine = m.sender.id === meId;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex gap-2",
                        mine ? "justify-end" : "justify-start",
                      )}
                    >
                      {!mine ? (
                        <UserAvatar
                          userId={m.sender.id}
                          name={m.sender.name}
                          avatarKey={m.sender.avatarKey}
                          className="mt-0.5 h-7 w-7 shrink-0"
                        />
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[min(100%,26rem)] rounded-md px-2.5 py-1.5 text-sm",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {!mine ? (
                          <p className="mb-0.5 text-[11px] font-medium opacity-80">
                            {m.sender.name}
                          </p>
                        ) : null}
                        {m.body ? (
                          <p className="whitespace-pre-wrap break-words leading-snug">
                            {renderBody(m.body)}
                          </p>
                        ) : null}
                        {m.location ? (
                          <div
                            className={cn(
                              "mt-1.5",
                              mine && "[&_*]:text-primary-foreground",
                            )}
                          >
                            <LocationChip location={m.location} />
                          </div>
                        ) : null}
                        {m.attachments.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {m.attachments.map((f) => (
                              <li key={f.id}>
                                <button
                                  type="button"
                                  className={cn(
                                    "interactive-press text-left text-xs underline underline-offset-2",
                                    mine
                                      ? "text-primary-foreground"
                                      : "text-primary",
                                  )}
                                  onClick={async () => {
                                    const res = await fetch(
                                      `/api/attachments/${f.id}?mode=download`,
                                    );
                                    const data = await res.json();
                                    if (data.url) window.open(data.url, "_blank");
                                  }}
                                >
                                  {f.fileName}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p
                          className={cn(
                            "mt-1 text-right text-[10px] tabular-nums leading-none",
                            mine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatMessageTime(m.createdAt, locale)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border px-3 py-2.5">
              {pendingFiles.length > 0 ? (
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {pendingFiles.map((f) => (
                    <li
                      key={f.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      <span className="truncate">{f.fileName}</span>
                      <button
                        type="button"
                        className="interactive-press shrink-0"
                        onClick={() =>
                          setPendingFiles((prev) =>
                            prev.filter((x) => x.id !== f.id),
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {showLocation || location ? (
                <LocationPicker
                  value={location}
                  onChange={(next) => {
                    setLocation(next);
                    if (!next) setShowLocation(false);
                  }}
                  className="mb-2"
                />
              ) : null}

              <div className="relative">
                {mentionCandidates.length > 0 ? (
                  <ul className="absolute bottom-full z-10 mb-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]">
                    {mentionCandidates.map((u, i) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={cn(
                            "interactive-press flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                            i === mentionIndex && "bg-muted",
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickMention(u)}
                        >
                          <span className="font-medium">@{u.username}</span>
                          <span className="text-muted-foreground">{u.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <textarea
                  value={draft}
                  onChange={(e) => updateDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (mentionCandidates.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex(
                          (i) => (i + 1) % mentionCandidates.length,
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex(
                          (i) =>
                            (i - 1 + mentionCandidates.length) %
                            mentionCandidates.length,
                        );
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        pickMention(mentionCandidates[mentionIndex]);
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={2}
                  placeholder={t("placeholder")}
                  className="interactive-field w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground sm:text-sm"
                />
              </div>

              {error ? (
                <p className="mt-1 text-xs text-rose-600">{error}</p>
              ) : null}

              <div className="mt-2 flex items-center gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    files.forEach((f) => void uploadFile(f));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="interactive-press h-9 w-9"
                  disabled={isUploading || isPending}
                  onClick={() => fileRef.current?.click()}
                  title={t("attach")}
                  aria-label={t("attach")}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "interactive-press h-9 w-9",
                    (showLocation || location) && "bg-primary/10 text-primary",
                  )}
                  disabled={isPending}
                  onClick={() => setShowLocation((v) => !v)}
                  title={t("addLocation")}
                  aria-label={t("addLocation")}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  className="interactive-press h-9 gap-1.5 px-3"
                  disabled={isPending || isUploading}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                  {t("send")}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Create group modal */}
      {showGroup ? (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t("cancel")}
            onClick={() => setShowGroup(false)}
          />
          <div className="relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-lg border border-border bg-surface shadow-[var(--shadow-overlay)] sm:rounded-md">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">{t("newGroup")}</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="interactive-press h-8 w-8"
                onClick={() => setShowGroup(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t("groupName")}
                className="text-base sm:text-sm"
              />
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder={t("searchStaff")}
                  className="pl-8 text-base sm:text-sm"
                />
              </div>
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {groupStaff.map((s) => {
                  const checked = selectedMembers.includes(s.id);
                  return (
                    <li key={s.id}>
                      <label className="interactive-press flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedMembers((prev) =>
                              checked
                                ? prev.filter((id) => id !== s.id)
                                : [...prev, s.id],
                            )
                          }
                        />
                        <UserAvatar
                          userId={s.id}
                          name={s.name}
                          avatarKey={s.avatarKey}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{s.username}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowGroup(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={
                  isPending || !groupName.trim() || selectedMembers.length === 0
                }
                onClick={createGroup}
              >
                {t("create")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
