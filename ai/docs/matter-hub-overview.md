# Matter hub — overview redesign

## Done
- Hub `/matters/[id]` hiển thị thẳng **tiến độ** + **lộ trình kế hoạch** (read-only timeline)
- Bỏ card điều hướng "Báo cáo vụ việc" và khối "Task liên quan"
- Bình luận cấp vụ việc chuyển về hub
- `/matters/[id]/report` → redirect về hub (mention/audit link cũ không 404)

## Layout
- Rail trái: `MatterInfoCard` + export PDF/Word
- Cột chính: `MatterPlanProgress` → `MatterPlanOverview` → `MatterAiSummary`
- Dưới: tài liệu + trao đổi
- Sửa kế hoạch chi tiết: `/matters/[id]/plan`

## Component
- `src/components/matters/matter-plan-overview.tsx` — progress bar + timeline chỉ xem

## Notes
- Task gắn vụ việc vẫn quản lý ở menu **Tasks**, không còn trên hub
- Timeline quá hạn: `dueAt < now && status !== DONE` → tone rose
