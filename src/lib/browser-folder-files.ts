/**
 * Collect File objects from a directory picker (`webkitdirectory`) or a
 * drag-and-drop that may include folders (`webkitGetAsEntry`).
 * Nested local paths are flattened; the top-level folder name is preserved.
 */

export type DroppedFolder = {
  name: string;
  files: File[];
};

export type DroppedPayload = {
  looseFiles: File[];
  folders: DroppedFolder[];
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    success: (file: File) => void,
    error?: (err: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (err: DOMException) => void,
    ) => void;
  };
};

function readAllDirectoryEntries(
  reader: NonNullable<FileSystemEntryLike["createReader"]> extends () => infer R
    ? R
    : never,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries(
        (entries) => {
          if (!entries.length) {
            resolve(all);
            return;
          }
          all.push(...entries);
          readBatch();
        },
        reject,
      );
    };
    readBatch();
  });
}

async function fileFromEntry(entry: FileSystemEntryLike): Promise<File | null> {
  if (!entry.isFile || !entry.file) return null;
  return new Promise((resolve, reject) => {
    entry.file!(
      (file) => resolve(file),
      (err) => reject(err),
    );
  });
}

async function collectFromDirectoryEntry(
  entry: FileSystemEntryLike,
): Promise<File[]> {
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    return file ? [file] : [];
  }
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const children = await readAllDirectoryEntries(reader);
  const nested = await Promise.all(
    children.map((child) => collectFromDirectoryEntry(child)),
  );
  return nested.flat();
}

/** Files from `<input webkitdirectory>` — group by top-level folder name. */
export function groupFilesFromDirectoryInput(fileList: FileList | File[]): DroppedFolder[] {
  const files = Array.from(fileList);
  const byRoot = new Map<string, File[]>();

  for (const file of files) {
    const relative =
      "webkitRelativePath" in file && typeof file.webkitRelativePath === "string"
        ? file.webkitRelativePath
        : "";
    const root = relative.split("/").filter(Boolean)[0] ?? file.name;
    const list = byRoot.get(root) ?? [];
    list.push(file);
    byRoot.set(root, list);
  }

  return [...byRoot.entries()].map(([name, folderFiles]) => ({
    name: name.slice(0, 80),
    files: folderFiles,
  }));
}

/**
 * Read DataTransfer from a drop event. Prefer entry API so empty folders and
 * directory structure are detected; fall back to `files` for plain file drops.
 */
export async function collectFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<DroppedPayload> {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const looseFiles: File[] = [];
  const folders: DroppedFolder[] = [];

  const entryItems = items.filter((item) => item.kind === "file");
  if (entryItems.length > 0) {
    for (const item of entryItems) {
      const getEntry = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null;
        }
      ).webkitGetAsEntry?.();
      if (!getEntry) {
        const file = item.getAsFile();
        if (file) looseFiles.push(file);
        continue;
      }
      if (getEntry.isDirectory) {
        const files = await collectFromDirectoryEntry(getEntry);
        if (files.length > 0) {
          folders.push({ name: getEntry.name.slice(0, 80), files });
        }
      } else if (getEntry.isFile) {
        const file = await fileFromEntry(getEntry);
        if (file) looseFiles.push(file);
      }
    }
    return { looseFiles, folders };
  }

  return {
    looseFiles: Array.from(dataTransfer.files ?? []),
    folders: [],
  };
}
