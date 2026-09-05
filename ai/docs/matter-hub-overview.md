# Matter hub — overview redesign

## Done
- Hub `/matters/[id]` hiển thị thẳng **tiến độ** + **lộ trình kế hoạch** (read-only timeline)
- Bỏ card điều hướng "Báo cáo vụ việc" và khối "Task liên quan"
- Bình luận cấp vụ việc chuyển về hub
- `/matters/[id]/report` → redirect về hub (mention/audit link cũ không 404)

## Layout
- Header dossier + pill nav (overview / plan / docs / comments)
- Cột chính (8): `MatterPlanProgress` → `MatterPlanOverview` → `MatterAiSummary`
- Rail phải (4): client + team + description (`MatterInfoCard`)
- Dưới: tài liệu + trao đổi
- Sửa kế hoạch chi tiết: `/matters/[id]/plan`

## Component
- `src/components/matters/matter-hub-header.tsx`
- `src/components/matters/matter-plan-overview.tsx` — progress bar + timeline chỉ xem
- `src/components/matters/matter-info-card.tsx` — sidebar dossier cards

## Notes
- Task gắn vụ việc vẫn quản lý ở menu **Tasks**, không còn trên hub
- Timeline quá hạn: `dueAt < now && status !== DONE` → tone rose
- Không timesheet / phí / AI copilot giả (xem `ai/docs/m3-nexus-matter-hub.md`)
