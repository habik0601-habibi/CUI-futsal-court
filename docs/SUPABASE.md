# Migrating to Supabase

Replace the implementations in `src/services/` (keep the method names and return shapes). UI code only calls `CUI.services.*` and `CUI.session`.

## Suggested tables
- `departments(id, name, code)`
- `profiles(id → auth.users, role STUDENT|DEPT_HEAD|SC_HEAD, name, email, department_id, roll_no)`; unique partial index: one `DEPT_HEAD` per `department_id`
- `bookings(id, ref, student_id, department_id, date, hour, status, created_at, dept_decision_by/at/reason, sc_decision_by/at/reason, rejected_at, no_show_marked_at)`
- `bans(id, student_id, booking_id, starts_at, ends_at)`

## Double-booking guard
```sql
create unique index one_holder_per_slot on bookings (date, hour)
  where status in ('PENDING_DEPARTMENT','PENDING_SPORTS_CENTRE','CONFIRMED','NO_SHOW');
```
Create bookings through an RPC / edge function that re-runs the rules in `engine.checkBookingRules` (ban, hours, 7-day window, daily/weekly limits) server-side.

## Expiry
Currently computed on read (`engine.applyExpiry`). In Supabase either keep it in the read query/view (`status = case when pending and slot_start <= now() then 'EXPIRED' ...`) or run a `pg_cron` job every few minutes.

## RLS sketch
- students: select/insert own bookings; select slot occupancy via a view without names
- dept heads: select/update bookings where `department_id = their department` and status `PENDING_DEPARTMENT`
- SC head: select/update all; insert bans

## Service → backend mapping
`bookingService.getWeek/getUsage/checkRules/createBooking/listMyBookings/listForDepartment/listAll/approve/reject/markNoShow`, `directoryService.*`, `banService.listActive`, `session.getCurrentUser`.
All times: store as `timestamptz`/UTC; the app displays Asia/Karachi (UTC+5).
