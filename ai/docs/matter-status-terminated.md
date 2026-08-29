# Matter status: Chấm dứt (TERMINATED)

## Done
- Prisma enum `MatterStatus.TERMINATED`
- UI picker + bulk + dashboard chart order
- i18n: `CLOSED` → **Hoàn thành** / Completed; `TERMINATED` → **Chấm dứt** / Terminated
- **Khóa sửa + tắt reminder** giống Lưu trữ (`isMatterEditLocked`)

## Behavior
| Status | Dashboard “vụ đang mở” | Sửa nội dung / upload | Reminder task/plan | Mở lại status |
|--------|-------------------------|------------------------|--------------------|---------------|
| Mới / Đang xử lý / **Tạm dừng** | Có | Có | Có | — |
| **Hoàn thành** | Không | Có | Có | Ai có quyền sửa |
| **Chấm dứt** | Không | **Không** | **Không** | **Admin** → Đang xử lý |
| **Lưu trữ** | Không | **Không** | **Không** | **Admin** → Đang xử lý |

## When to use
- **Tạm dừng** — khách tạm im, có thể quay lại
- **Hoàn thành** — vụ kết thúc đúng nghĩa (xong việc); vẫn xem/sửa tài liệu nếu cần
- **Chấm dứt** — dừng giữa chừng (khách bỏ / hủy); khóa như lưu trữ, Admin mới mở lại
- **Lưu trữ** — cất kho lâu dài (Admin)

## Code
- `src/lib/matter-status.ts` — `isMatterEditLocked` / `MATTER_EDIT_LOCKED_STATUSES`
- `assertMatterNotArchived` cũng chặn `TERMINATED`
