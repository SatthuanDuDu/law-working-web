# M3 Nexus — Calendar month/week chrome

Restyle `/calendar` closer to Nexus mock structure, without scorecards or invented court/timesheet features.

## Shipped structure

### Shared chrome
- Page hero: accent bar + title + description + urgent badge (real HIGH/URGENT / due ≤2d in 7d window)
- Pill toggles: Tuần / Tháng, Của tôi / Tất cả
- Date nav strip + legend (task / plan / urgent)

### Week (mock parity)
- **Time grid** Mon–Sun × hours 07:00–20:00 (not the old vertical agenda list)
- Event cards positioned by due time; all-day / out-of-range hours in top strip
- Card duration default ~75m (no end time in data)

### Month (mock parity)
- Left rail: mini month picker, task/plan checkboxes, urgent list (real data)
- Dense month matrix; today circle; selected day ring + “Đang chọn”
- Chips: tonal + `HH:mm · title`
- Desktop day-focus flyout for selected day events

## Explicitly not shipped
- Scorecards / KPI row
- Court / attorney filters / iCal / timesheet / VIP / stock photos
- Fake event categories beyond task vs plan

## Files
- `src/components/calendar/calendar-month.tsx`
- `src/components/calendar/calendar-week-grid.tsx`
- `src/components/calendar/calendar-side-rail.tsx`
- i18n `calendar.*` keys
