# Matter folder upload (local directory)

## Done
- Nút **Thêm thư mục** + kéo-thả folder/file trên `AttachmentPanel` (tab vụ việc hub và kế hoạch compact).
- Tên folder web = tên folder gốc trên máy; file trong cây local được **dồn phẳng** vào 1 `MatterFolder`.
- Sau upload: folder hiện ở thanh folder chung của vụ việc; file gắn `folderId` (+ `matterPlanStepId` nếu upload từ bước kế hoạch).

## Decisions
- Trùng tên folder → lỗi 409, không tự đổi tên.
- Vẫn bắt chọn nhãn tài liệu (1 lần cho cả batch).
- Không hỗ trợ cây thư mục lồng trên web (schema phẳng).

## Files
- `src/lib/browser-folder-files.ts`
- `src/components/attachments/attachment-panel.tsx`
- `src/components/attachments/attachment-upload-dialog.tsx`
- i18n `attachments.uploadFolder` / `dragDropFolderHint` / …
