# PLAN — Luật Work Manager

Quy tắc: một slice = một việc end-to-end nhỏ. Chỉ một slice active.

## Active
- [ ] Slice: Context hygiene — chốt PRD/PLAN này + duyệt baseline rules hiện có (không code feature mới)

## Next
- [ ] Slice: Dashboard Tổng quan — giữ baseline KPI/grid; mọi thử UI (liquid glass…) chỉ scope `/dashboard` + tôn trọng `prefers-reduced-motion`
- [ ] Slice: Deadline jobs / nhắc hạn — verify job + UX danh sách hạn sắp tới
- [ ] Slice: Deploy/docs sync — `DEPLOY` / `.env.example` khớp VPS (DOMAIN, AUTH_URL)

## Done
- [x] Core product: auth, matters, tasks, docs, dashboard (đã ship trước khi scaffold `ai/`)
- [x] Project rules Material You + verify-before-handoff
