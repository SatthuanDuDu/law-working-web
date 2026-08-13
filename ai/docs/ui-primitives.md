# UI primitives (workspace)

## Shared components
| File | Mục đích |
|------|----------|
| `src/components/layout/page-toolbar.tsx` | Filters trái / actions phải |
| `src/components/ui/multi-select-filter.tsx` | Multi-select + SortToggle tùy chọn |
| `src/components/ui/status-chip.tsx` + `src/lib/status-tokens.ts` | Chip trạng thái tonal (Material You) |
| `src/components/ui/empty-state.tsx` | Empty dashed box |
| `src/components/ui/table.tsx` | Table + sticky header + `TableEmptyRow` + `mobileFallback` |
| `src/components/ui/list-page-skeleton.tsx` | Skeleton dạng hàng |
| `src/app/(dashboard)/error.tsx` | Error boundary + Thử lại |

## Quy ước
- Status: **tonal nhạt**, không fill đậm trắng-trên-màu
- Radius list/control: ưu tiên `rounded-md` (token 8px), tránh `rounded-[5px]`
- List page: `PageToolbar` cho hàng lọc; empty → `EmptyState` hoặc `TableEmptyRow`
- Table rộng: trên mobile dùng `mobileFallback` / list cards, không chỉ cuộn ngang

## Loading
- `(dashboard)/loading.tsx` dùng `ListPageSkeleton`
- Có thêm `expenses/`, `wallet/`, `website/loading.tsx`
