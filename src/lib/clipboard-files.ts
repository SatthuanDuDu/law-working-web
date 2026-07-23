/** Normalize clipboard screenshot blobs that often arrive as untitled "image.png". */
export function namedClipboardFile(file: File) {
  const trimmed = file.name?.trim() ?? "";
  if (
    trimmed &&
    trimmed !== "image.png" &&
    trimmed !== "image.jpg" &&
    trimmed !== "image.jpeg"
  ) {
    return file;
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : file.type === "image/heic" || file.type === "image/heif"
              ? "heic"
              : trimmed.includes(".")
                ? trimmed.split(".").pop() || "bin"
                : "png";
  return new File([file], `paste-${Date.now()}.${ext}`, {
    type: file.type || "image/png",
  });
}

function isLikelyClipboardImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (!file.type && /^image\.(png|jpe?g|gif|webp)$/i.test(file.name || "")) {
    return true;
  }
  return false;
}

/**
 * Collect pasteable files from a clipboard DataTransfer.
 * Checks both `files` and `items` — browsers differ (esp. Safari / screenshot paste).
 */
export function extractClipboardFiles(
  clipboardData: DataTransfer | null | undefined,
  options?: { imagesOnly?: boolean },
): File[] {
  if (!clipboardData) return [];
  const imagesOnly = options?.imagesOnly ?? false;
  const out: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null | undefined) => {
    if (!file || file.size <= 0) return;
    if (imagesOnly && !isLikelyClipboardImage(file)) return;
    const key = `${file.type}:${file.size}:${file.name}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(namedClipboardFile(file));
  };

  if (clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      push(file);
    }
  }

  if (clipboardData.items?.length) {
    for (const item of Array.from(clipboardData.items)) {
      const looksLikeFile =
        item.kind === "file" || item.type.startsWith("image/");
      if (!looksLikeFile) continue;
      push(item.getAsFile());
    }
  }

  if (imagesOnly) {
    return out.filter(isLikelyClipboardImage);
  }
  return out;
}

export function clipboardHasImageType(
  clipboardData: DataTransfer | null | undefined,
): boolean {
  if (!clipboardData) return false;
  if (Array.from(clipboardData.types ?? []).some((t) => t.startsWith("image/"))) {
    return true;
  }
  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.type.startsWith("image/")) return true;
  }
  return false;
}

/** Async Clipboard API fallback (often works when paste DataTransfer is empty). */
export async function readImagesFromClipboardApi(): Promise<File[]> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return [];
  }
  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith("image/")) continue;
        const blob = await item.getType(type);
        const ext = type.split("/")[1] || "png";
        files.push(
          namedClipboardFile(
            new File([blob], `paste-${Date.now()}.${ext}`, { type }),
          ),
        );
      }
    }
    return files;
  } catch {
    return [];
  }
}

/** True when paste payload looks image-oriented but yielded no File (e.g. Finder copy). */
export function clipboardLooksLikeBlockedImagePaste(
  clipboardData: DataTransfer | null | undefined,
): boolean {
  if (!clipboardData) return false;
  if (extractClipboardFiles(clipboardData, { imagesOnly: true }).length > 0) {
    return false;
  }
  const types = Array.from(clipboardData.types ?? []);
  if (types.some((t) => /Files|text\/uri-list|public\.file/i.test(t))) {
    return true;
  }
  return clipboardHasImageType(clipboardData);
}
