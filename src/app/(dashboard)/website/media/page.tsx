import {
  MediaLibraryClient,
  type MediaLibraryItem,
} from "@/components/website-cms/media-library-client";
import { cmsDb } from "@/lib/cms-db";
import { requireRole } from "@/lib/session";

export default async function WebsiteMediaPage() {
  await requireRole(["ADMIN", "MANAGER"]);

  const rows = await cmsDb.media.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const initialItems: MediaLibraryItem[] = rows.map((row) => ({
    id: row.id,
    storageKey: row.storageKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    alt: row.alt,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Thư viện ảnh</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quản lý ảnh dùng trên website — tải lên, chỉnh alt, xoá.
        </p>
      </div>
      <MediaLibraryClient initialItems={initialItems} />
    </div>
  );
}
