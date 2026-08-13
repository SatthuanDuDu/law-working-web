# To-do (checklist cá nhân)

## Mục tiêu
Checklist riêng tư cho từng nhân viên — tách khỏi hệ giao việc (`Task`). Panel phải kiểu Gmail Tasks, tên **To-do**.

## Model
- `PersonalTodo` + `PersonalTodoItem` trong `prisma/schema.prisma`
- `ownerId` bắt buộc; `matterId` tùy chọn
- `dueDate` + `hasTime` (ngày hoặc ngày+giờ)
- `recurrence`: `NONE | DAILY | WEEKLY | MONTHLY`
- `recurrenceDays`: thứ ISO 1=Mon … 7=Sun (khi WEEKLY)
- `reminderSentAt` cho cron nhắc hạn

## Riêng tư (bắt buộc)
- Mọi server action lọc `ownerId = session.user.id`
- Admin/Manager **không** xem được todo của người khác
- **Không** ghi `AuditLog`

## UI
- Nút checklist trên header; desktop đẩy `main` (width animate); mobile sheet trượt
- Composer: tiêu đề, chi tiết, chip Hôm nay/Ngày mai, lịch/giờ/lặp lại
- Tick hoàn thành: ẩn khỏi list; nếu đang lặp → tạo bản sao hạn lần sau
- `/my-work` redirect → `/tasks`
- Widget dashboard mở panel

## Nhắc hạn
- Cron hourly `generateDeadlineReminders` thêm `PERSONAL_TODO_DUE` (owner, link `/dashboard?todo=1`)
- Urgent stack: To-do có giờ, trong ±2 giờ tới hạn

## Không làm
- Không merge với `Task`
- Không time-range từ–đến; không yearly / every-N
