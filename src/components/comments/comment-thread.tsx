"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  Download,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/location/location-picker";
import { LocationChip } from "@/components/location/location-chip";
import {
  appendLocationToFormData,
  locationFromPrismaFields,
  type LocationValue,
} from "@/lib/location";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import {
  clipboardLooksLikeBlockedImagePaste,
  extractClipboardFiles,
} from "@/lib/clipboard-files";
import { AttachmentViewer } from "@/components/attachments/attachment-viewer";
import { AttachmentUploadDialog } from "@/components/attachments/attachment-upload-dialog";
import { formatDateTime, cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export type CommentMentionUser = {
  id: string;
  name: string;
};

export type CommentAttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarKey?: string | null };
  attachments?: CommentAttachmentItem[];
  locationName?: string | null;
  locationAddress?: string | null;
  locationPlaceId?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
};

type CommentThreadProps = {
  matterId: string;
  matterPlanStepId?: string;
  currentUserId: string;
  canDeleteAsAdmin: boolean;
  canPost: boolean;
  mentionUsers: CommentMentionUser[];
  comments: CommentItem[];
  /** Compact styling for embedding inside plan-step cards. */
  compact?: boolean;
};

type PendingAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl?: string;
};

const MENTION_TOKEN = /@\[([^\]]+)\]\(([^)]+)\)/g;

function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

function bodyToEditable(body: string) {
  if (body === "(Đính kèm)" || body === "(Vị trí)") return "";
  return body.replace(MENTION_TOKEN, "@$1");
}

function encodeMentions(text: string, mentionUsers: CommentMentionUser[]) {
  let body = text.trim();
  const used = mentionUsers.filter((m) => text.includes(`@${m.name}`));
  const sorted = [...used].sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    body = body.split(`@${m.name}`).join(`@[${m.name}](${m.id})`);
  }
  return body;
}

function wasEdited(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60_000;
}

function renderBody(body: string) {
  if (body === "(Đính kèm)" || body === "(Vị trí)") return null;
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
  canDeleteAsAdmin,
  canPost,
  mentionUsers,
  comments,
  compact = false,
}: CommentThreadProps) {
  const t = useTranslations("comments");
  const [open, setOpen] = useState(compact);
  const { confirm, dialog } = useConfirmDialog();

  return (
    <div className={cn("min-w-0", compact && "border-t border-border/70 pt-4")}>
      {dialog}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "interactive-press inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-primary",
          compact ? "text-xs" : "text-sm",
        )}
      >
        <MessageSquare className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span className="font-medium">
          {t("title")}
          {comments.length > 0 ? ` (${comments.length})` : ""}
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
              <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
                {t("emptyThread")}
              </p>
            ) : (
              <ul
                className={cn(
                  "min-w-0",
                  compact ? "divide-y divide-border/70" : "space-y-3",
                )}
              >
                {comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    canEdit={comment.author.id === currentUserId}
                    canDelete={canDeleteAsAdmin}
                    mentionUsers={mentionUsers}
                    onDelete={confirm}
                    compact={compact}
                  />
                ))}
              </ul>
            )}

            {canPost ? (
              <CommentComposer
                matterId={matterId}
                matterPlanStepId={matterPlanStepId}
                mentionUsers={mentionUsers}
                compact={compact}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentAttachmentPreview({
  attachment,
  compact = false,
}: {
  attachment: CommentAttachmentItem;
  compact?: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isImage = isImageMime(attachment.mimeType);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/attachments/${attachment.id}?mode=preview`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) return;
      setThumbUrl(data.url || data.downloadUrl || null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attachment.id, isImage]);

  return (
    <>
      <AttachmentViewer
        attachment={attachment}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
      {isImage && thumbUrl ? (
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className={cn(
            "interactive-press block overflow-hidden rounded-md bg-surface",
            compact ? "ring-1 ring-border/60" : "border border-border",
          )}
          aria-label={`Xem ${attachment.fileName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbUrl}
            alt={attachment.fileName}
            className="max-h-48 w-full object-contain"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className={cn(
            "interactive-press flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground",
            compact
              ? "bg-muted/50 hover:bg-muted"
              : "border border-border bg-muted hover:bg-muted/80",
          )}
        >
          <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 truncate">{attachment.fileName}</span>
        </button>
      )}
    </>
  );
}

function CommentRow({
  comment,
  canEdit,
  canDelete,
  mentionUsers,
  onDelete,
  compact = false,
}: {
  comment: CommentItem;
  canEdit: boolean;
  canDelete: boolean;
  mentionUsers: CommentMentionUser[];
  onDelete: (opts: {
    title: string;
    message: string;
    variant?: "default" | "destructive";
    confirmLabel?: string;
    onConfirm: () => void;
  }) => void;
  compact?: boolean;
}) {
  const t = useTranslations("comments");
  const tCommon = useTranslations("common");
  const tActions = useTranslations("actions");
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const attachments = comment.attachments ?? [];
  const commentLocation = locationFromPrismaFields({
    locationName: comment.locationName ?? null,
    locationAddress: comment.locationAddress ?? null,
    locationPlaceId: comment.locationPlaceId ?? null,
    locationLat: comment.locationLat ?? null,
    locationLng: comment.locationLng ?? null,
  });
  const [editAttachments, setEditAttachments] = useState(attachments);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);
  const [editLocation, setEditLocation] = useState<LocationValue | null>(
    commentLocation,
  );
  const router = useRouter();
  const bodyNodes = renderBody(comment.body);
  const edited = wasEdited(comment.createdAt, comment.updatedAt);

  function handleDelete() {
    onDelete({
      title: t("deleteConfirmTitle"),
      message: t("deleteConfirmMessage"),
      variant: "destructive",
      confirmLabel: tCommon("delete"),
      onConfirm: () => {
        startTransition(async () => {
          await deleteCommentAction(comment.id);
          router.refresh();
        });
      },
    });
  }

  function startEdit() {
    setDraft(bodyToEditable(comment.body));
    setEditAttachments(comment.attachments ?? []);
    setRemoveAttachmentIds([]);
    setEditLocation(
      locationFromPrismaFields({
        locationName: comment.locationName ?? null,
        locationAddress: comment.locationAddress ?? null,
        locationPlaceId: comment.locationPlaceId ?? null,
        locationLat: comment.locationLat ?? null,
        locationLng: comment.locationLng ?? null,
      }),
    );
    setEditError(null);
    setEditing(true);
  }

  function removeEditAttachment(id: string) {
    setEditAttachments((prev) => prev.filter((a) => a.id !== id));
    setRemoveAttachmentIds((prev) =>
      prev.includes(id) ? prev : [...prev, id],
    );
  }

  function handleSaveEdit() {
    const encoded = encodeMentions(draft, mentionUsers);
    if (!encoded && editAttachments.length === 0 && !editLocation) {
      setEditError(tActions("commentEmpty"));
      return;
    }
    const formData = new FormData();
    formData.set("commentId", comment.id);
    formData.set("body", encoded);
    formData.set("removeAttachmentIds", JSON.stringify(removeAttachmentIds));
    appendLocationToFormData(formData, editLocation);
    startTransition(async () => {
      const result = await updateCommentAction(formData);
      if (result?.error) {
        setEditError(result.error);
        return;
      }
      setEditing(false);
      setEditError(null);
      setRemoveAttachmentIds([]);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "min-w-0 transition-opacity",
        compact
          ? "bg-transparent py-3 first:pt-0"
          : "rounded-md border border-border bg-surface p-3",
        isPending && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <UserAvatar
            userId={comment.author.id}
            name={comment.author.name}
            avatarKey={comment.author.avatarKey}
            size="sm"
            className="mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {comment.author.name}
              {edited ? (
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {t("edited")}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          {canEdit && !editing ? (
            <button
              type="button"
              onClick={startEdit}
              disabled={isPending}
              aria-label={t("editComment")}
              className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              aria-label={t("delete")}
              className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (editError) setEditError(null);
            }}
            className="min-h-[64px] w-full min-w-0 resize-y"
            disabled={isPending}
          />
          {editAttachments.length > 0 ? (
            <ul className="space-y-1.5">
              {editAttachments.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-foreground"
                >
                  <span className="min-w-0 truncate">{file.fileName}</span>
                  <button
                    type="button"
                    onClick={() => removeEditAttachment(file.id)}
                    disabled={isPending}
                    aria-label={`${tCommon("delete")} ${file.fileName}`}
                    className="interactive-press shrink-0 rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <LocationPicker
            value={editLocation}
            onChange={setEditLocation}
            disabled={isPending}
          />
          {editError ? <p className="text-xs text-red-600">{editError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setEditing(false);
                setEditError(null);
                setRemoveAttachmentIds([]);
                setEditAttachments(comment.attachments ?? []);
                setEditLocation(commentLocation);
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSaveEdit}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {tCommon("save")}
            </Button>
          </div>
        </div>
      ) : bodyNodes ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
          {bodyNodes}
        </p>
      ) : null}
      {!editing && commentLocation ? (
        <div className="mt-2">
          <LocationChip location={commentLocation} />
        </div>
      ) : null}
      {!editing && attachments.length > 0 ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {attachments.map((file) => (
            <CommentAttachmentPreview
              key={file.id}
              attachment={file}
              compact={compact}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function CommentComposer({
  matterId,
  matterPlanStepId,
  mentionUsers,
  compact = false,
}: {
  matterId: string;
  matterPlanStepId?: string;
  mentionUsers: CommentMentionUser[];
  compact?: boolean;
}) {
  const t = useTranslations("comments");
  const tActions = useTranslations("actions");
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<CommentMentionUser[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [labels, setLabels] = useState<{ id: string; name: string }[]>([]);
  const [dialogFile, setDialogFile] = useState<File | null>(null);
  const uploadQueueRef = useRef<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  useEffect(() => {
    let cancelled = false;
    async function loadLabels() {
      const res = await fetch("/api/attachment-labels");
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setLabels(data.labels ?? []);
    }
    void loadLabels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const file of pendingFiles) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      }
    };
    // Only revoke on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1) {
      setQuery(null);
      return;
    }
    const between = before.slice(at + 1);
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

  async function uploadFile(
    file: File,
    labelId: string | null,
    customLabel: string | null,
  ) {
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
          matterId,
          labelId,
          customLabel,
        }),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) {
        setError(prepared.error || t("uploadSessionFailed"));
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
        setError(
          uploaded.corsLikely ? t("uploadCorsFailed") : t("uploadFailed"),
        );
        return;
      }

      const previewUrl = isImageMime(file.type)
        ? URL.createObjectURL(file)
        : undefined;

      setPendingFiles((prev) => [
        ...prev,
        {
          id: prepared.attachment.id,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          previewUrl,
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  }

  function enqueueFiles(files: File[]) {
    if (files.length === 0) return;
    uploadQueueRef.current.push(...files);
    if (!dialogFile) {
      const next = uploadQueueRef.current.shift() ?? null;
      setDialogFile(next);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const data = e.clipboardData;
    const files = extractClipboardFiles(data);
    if (files.length === 0) {
      if (clipboardLooksLikeBlockedImagePaste(data)) {
        e.preventDefault();
        setError(t("pasteImageBlocked"));
      }
      return;
    }
    e.preventDefault();
    enqueueFiles(files);
  }

  async function removePending(id: string) {
    const target = pendingFiles.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
  }

  function buildBody() {
    let body = text.trim();
    const used = mentions.filter((m) => text.includes(`@${m.name}`));
    const sorted = [...used].sort((a, b) => b.name.length - a.name.length);
    for (const m of sorted) {
      body = body.split(`@${m.name}`).join(`@[${m.name}](${m.id})`);
    }
    const mentionedUserIds = used.map((m) => m.id);
    return { body, mentionedUserIds };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && pendingFiles.length === 0 && !location) {
      setError(tActions("commentEmpty"));
      return;
    }
    const { body, mentionedUserIds } = buildBody();
    const formData = new FormData();
    formData.set("matterId", matterId);
    if (matterPlanStepId) formData.set("matterPlanStepId", matterPlanStepId);
    formData.set("body", body);
    formData.set("mentionedUserIds", JSON.stringify(mentionedUserIds));
    formData.set(
      "attachmentIds",
      JSON.stringify(pendingFiles.map((f) => f.id)),
    );
    appendLocationToFormData(formData, location);

    startTransition(async () => {
      const result = await createCommentAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      for (const file of pendingFiles) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      }
      setText("");
      setMentions([]);
      setPendingFiles([]);
      setLocation(null);
      setShowLocationPicker(false);
      setError(null);
      router.refresh();
    });
  }

  const canSubmit =
    !isPending &&
    !isUploading &&
    (text.trim().length > 0 || pendingFiles.length > 0 || location != null);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "min-w-0 space-y-2",
        compact && "border-t border-border/70 pt-3",
      )}
    >
      <div className="relative min-w-0">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => window.setTimeout(() => setQuery(null), 120)}
          placeholder={t("placeholderExtended")}
          className="min-h-[64px] w-full min-w-0 resize-y"
          disabled={isPending}
        />
        {query !== null &&
          suggestions.length > 0 &&
          anchor &&
          createPortal(
            <ul
              className="fixed z-[60] max-h-56 overflow-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
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
                      "flex w-full items-center px-3 py-2 text-left text-sm text-foreground hover:bg-muted",
                      index === activeIndex && "bg-muted",
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

      {pendingFiles.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pendingFiles.map((file) => (
            <li
              key={file.id}
              className={cn(
                "relative max-w-[140px] overflow-hidden rounded-md bg-muted",
                compact ? "ring-1 ring-border/60" : "border border-border",
              )}
            >
              {file.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.previewUrl}
                  alt={file.fileName}
                  className="h-20 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 items-center px-2 text-[11px] text-muted-foreground">
                  <span className="line-clamp-3 break-all">{file.fileName}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => void removePending(file.id)}
                disabled={isPending}
                aria-label={t("removeFile", { name: file.fileName })}
                className="interactive-press absolute right-1 top-1 rounded-full bg-surface/90 p-0.5 text-muted-foreground shadow-sm hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {(showLocationPicker || location) && (
        <LocationPicker
          value={location}
          onChange={(next) => {
            setLocation(next);
            if (!next) setShowLocationPicker(false);
          }}
          disabled={isPending}
        />
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <AttachmentUploadDialog
        open={!!dialogFile}
        file={dialogFile}
        labels={labels}
        onCancel={() => {
          setDialogFile(null);
          uploadQueueRef.current = [];
        }}
        onConfirm={({ labelId, customLabel }) => {
          const file = dialogFile;
          setDialogFile(null);
          void (async () => {
            if (file) await uploadFile(file, labelId, customLabel);
            const next = uploadQueueRef.current.shift() ?? null;
            if (next) setDialogFile(next);
          })();
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            disabled={isPending || isUploading}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              enqueueFiles(files);
            }}
          />
          <button
            type="button"
            disabled={isPending || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="interactive-press inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-primary"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            {t("attach")}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowLocationPicker((v) => !v)}
            className={cn(
              "interactive-press inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium",
              showLocationPicker || location
                ? "bg-primary-muted text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-primary",
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            {t("addLocation")}
          </button>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          className="rounded-md"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isPending ? t("sending") : t("post")}
        </Button>
      </div>
    </form>
  );
}
