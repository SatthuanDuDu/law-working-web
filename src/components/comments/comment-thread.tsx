"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { createCommentAction, deleteCommentAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type CommentMentionUser = {
  id: string;
  name: string;
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

type CommentThreadProps = {
  matterId: string;
  matterPlanStepId?: string;
  currentUserId: string;
  canModerate: boolean;
  canPost: boolean;
  mentionUsers: CommentMentionUser[];
  comments: CommentItem[];
  /** Compact styling for embedding inside plan-step cards. */
  compact?: boolean;
};

const MENTION_TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

function renderBody(body: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_TOKEN.lastIndex = 0;
  let key = 0;
  while ((match = MENTION_TOKEN.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`m-${key++}`}
        className="rounded bg-primary-muted px-1 font-medium text-primary"
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}

export function CommentThread({
  matterId,
  matterPlanStepId,
  currentUserId,
  canModerate,
  canPost,
  mentionUsers,
  comments,
  compact = false,
}: CommentThreadProps) {
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  return (
    <div className="min-w-0">
      {dialog}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "interactive-press inline-flex items-center gap-1.5 rounded-md text-slate-500 transition-colors hover:text-primary",
          compact ? "text-xs" : "text-sm",
        )}
      >
        <MessageSquare className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span className="font-medium">
          Bình luận{comments.length > 0 ? ` (${comments.length})` : ""}
        </span>
        <ChevronDown
          className={cn(
            "transition-transform",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="min-w-0 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có bình luận nào.</p>
            ) : (
              <ul className="min-w-0 space-y-3">
                {comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    canDelete={
                      canModerate || comment.author.id === currentUserId
                    }
                    onDelete={confirm}
                  />
                ))}
              </ul>
            )}

            {canPost ? (
              <CommentComposer
                matterId={matterId}
                matterPlanStepId={matterPlanStepId}
                mentionUsers={mentionUsers}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: CommentItem;
  canDelete: boolean;
  onDelete: (opts: {
    title: string;
    message: string;
    variant?: "default" | "destructive";
    confirmLabel?: string;
    onConfirm: () => void;
  }) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    onDelete({
      title: "Xóa bình luận",
      message: "Bạn có chắc muốn xóa bình luận này?",
      variant: "destructive",
      confirmLabel: "Xóa",
      onConfirm: () => {
        startTransition(async () => {
          await deleteCommentAction(comment.id);
        });
      },
    });
  }

  return (
    <li
      className={cn(
        "min-w-0 rounded-md border border-slate-200 bg-white p-3 transition-opacity",
        isPending && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {comment.author.name}
          </p>
          <p className="text-xs text-slate-400">
            {formatDateTime(comment.createdAt)}
          </p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            aria-label="Xóa bình luận"
            className="interactive-press shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
        {renderBody(comment.body)}
      </p>
    </li>
  );
}

function CommentComposer({
  matterId,
  matterPlanStepId,
  mentionUsers,
}: {
  matterId: string;
  matterPlanStepId?: string;
  mentionUsers: CommentMentionUser[];
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<CommentMentionUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [query, setQuery] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return mentionUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, mentionUsers]);

  useLayoutEffect(() => {
    if (query === null || !textareaRef.current) {
      setAnchor(null);
      return;
    }
    const rect = textareaRef.current.getBoundingClientRect();
    setAnchor({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }, [query, text]);

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) {
      setQuery(null);
      return;
    }
    const between = before.slice(at + 1);
    // Only treat as mention query if no whitespace/newline after '@'.
    if (/[\s\n]/.test(between) || between.length > 40) {
      setQuery(null);
      return;
    }
    const charBefore = at > 0 ? before[at - 1] : " ";
    if (charBefore && !/[\s\n(]/.test(charBefore)) {
      setQuery(null);
      return;
    }
    setQuery(between);
    setActiveIndex(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    if (error) setError(null);
    detectMention(value, e.target.selectionStart ?? value.length);
  }

  function pickMention(user: CommentMentionUser) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) return;
    const after = text.slice(caret);
    const insert = `@${user.name} `;
    const next = before.slice(0, at) + insert + after;
    setText(next);
    setMentions((prev) =>
      prev.some((m) => m.id === user.id) ? prev : [...prev, user],
    );
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = at + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
  }

  function buildBody() {
    let body = text.trim();
    const used = mentions.filter((m) => text.includes(`@${m.name}`));
    // Longer names first to avoid partial overlap replacement.
    const sorted = [...used].sort((a, b) => b.name.length - a.name.length);
    for (const m of sorted) {
      body = body.split(`@${m.name}`).join(`@[${m.name}](${m.id})`);
    }
    const mentionedUserIds = used.map((m) => m.id);
    return { body, mentionedUserIds };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Nội dung bình luận không được để trống");
      return;
    }
    const { body, mentionedUserIds } = buildBody();
    const formData = new FormData();
    formData.set("matterId", matterId);
    if (matterPlanStepId) formData.set("matterPlanStepId", matterPlanStepId);
    formData.set("body", body);
    formData.set("mentionedUserIds", JSON.stringify(mentionedUserIds));

    startTransition(async () => {
      const result = await createCommentAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setText("");
      setMentions([]);
      setError(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-2">
      <div className="relative min-w-0">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setQuery(null), 120)}
          placeholder="Viết bình luận... gõ @ để nhắc đồng nghiệp"
          className="min-h-[64px] w-full min-w-0 resize-y"
          disabled={isPending}
        />
        {query !== null &&
          suggestions.length > 0 &&
          anchor &&
          createPortal(
            <ul
              className="fixed z-[60] max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-[var(--shadow-overlay)]"
              style={{
                left: anchor.left,
                top: anchor.top,
                width: Math.min(anchor.width, 280),
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {suggestions.map((user, index) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => pickMention(user)}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
                      index === activeIndex && "bg-slate-100",
                    )}
                  >
                    <span className="truncate">{user.name}</span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !text.trim()}
          className="rounded-md"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isPending ? "Đang gửi..." : "Gửi"}
        </Button>
      </div>
    </form>
  );
}
