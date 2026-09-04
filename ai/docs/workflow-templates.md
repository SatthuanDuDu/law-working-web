# Workflow mẫu

## Đã làm
- Schema: `WorkflowTemplate`, `WorkflowTemplateStep`, `MatterPlanStep.description`
- Tab `/workflows` (Manager/Admin): CRUD mẫu + editor flow rail (accordion, insert giữa bước, Start/End)
- List-first: pipeline chips ngang trên mỗi workflow; tạo/sửa qua modal rộng
- Tạo vụ việc: chọn workflow optional → popup customize (cùng flow rail + ngày + người nhận) → seed `MatterPlanStep`
- API `GET /api/workflows` trả mẫu đang bật cho mọi user đăng nhập

## Quyết định
- Copy-on-create: sửa mẫu không ảnh hưởng vụ việc đã tạo
- Không FK matter → template
- Assignee bắt buộc trên popup áp dụng; work type / priority / location vẫn sửa sau ở `/plan`
- UI flow = vertical process rail trong canvas panel (Start Play / End Flag, insert zone có nhãn, accent bar khi expand) — không canvas/node graph; sequential only

## Files chính
- `src/lib/workflow-actions.ts`, `src/lib/workflow-types.ts`
- `src/app/(dashboard)/workflows/page.tsx`
- `src/components/workflows/workflow-flow-rail.tsx` — shared rail
- `src/components/workflows/workflow-pipeline-chips.tsx` — list preview
- `src/components/workflows/workflow-template-editor-modal.tsx`
- `src/components/workflows/workflow-templates-list.tsx`
- `src/components/workflows/workflow-apply-dialog.tsx`
- `src/components/matters/create-matter-modal.tsx`
