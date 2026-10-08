# Go-Live Checklist — University Futsal Court Booking

Tick `[x]` as each item is finished. Status key: 🔵 needs university/IT answer · 🟢 can start now.

## 0. Questions for IT / university (answers decide the plan) 🔵
- [ ] Does the university have single sign-on (Microsoft / Google Workspace) we can use?
- [ ] How can we get the student list with department (API, database view, or CSV export)?
- [ ] Can we get a subdomain (e.g. futsal.university.edu.pk) and HTTPS?
- [ ] Who appoints / replaces department sports heads and the Sports Centre Head?
- [ ] Who owns and maintains the system after launch?
- [x] Official logo received and applied (name and colours still to confirm)

## 1. Backend and database (Supabase) 🟢
- [ ] Test Supabase project created (separate from live)
- [ ] Tables created: departments, profiles, bookings, bans (see docs/SUPABASE.md)
- [ ] One-department-one-head constraint added
- [ ] Unique index blocking double-booking added
- [ ] Booking rules enforced server-side (ban, hours, 7-day window, 1/day, 2/week)
- [ ] Approve / reject / no-show actions enforced server-side by role
- [ ] Auto-expiry runs server-side (on read or scheduled job)
- [ ] `src/services/*` rewritten to call Supabase (UI unchanged)
- [ ] Timestamps stored in UTC, displayed in Asia/Karachi
- [ ] Live Supabase project created and configured

## 2. Authentication and security
- [ ] Real login replaces the Demo mode switcher (SSO if available)
- [ ] Role comes from the database, not the browser
- [ ] Row-level security policies written for student / dept head / sports centre head
- [ ] RLS tested: a student cannot see or change others' data or act as a head
- [ ] Demo mode removed (`src/demo/`, script tags, demo.css)
- [ ] No secrets in frontend code (only public anon key)

## 3. Student data connection
- [ ] Data source agreed with IT (API / view / CSV)
- [ ] Mapping of login → student → department defined (email or roll number)
- [ ] Import (or sync) of students into `profiles` built and tested
- [ ] Department list matches the university's official list
- [ ] Department heads and Sports Centre Head accounts created
- [ ] Process for new / graduated students agreed (re-import schedule)

## 4. Hosting and deployment
- [ ] Hosting chosen (Cloudflare Pages / Netlify / Vercel)
- [ ] Test deployment working
- [ ] Domain / subdomain pointed, HTTPS active
- [ ] Production deployment working
- [ ] Rollback / redeploy process noted

## 5. Missing features
- [x] Cancellation: students can cancel own booking any time before the slot starts
- [x] Ban policy: Sports Centre Head can lift a ban early (no appeal flow)
- [x] Court closures / blocked dates (maintenance, exams, holidays, events)
- [x] Existing bookings in a closure are auto-cancelled
- [x] Audit log (who approved / rejected / marked no-show / lifted bans / closed court, and when)
- [ ] Backup / delegate approver when a head is away

## 6. Policy and compliance
- [ ] Data privacy and retention approved by the university
- [ ] Who can see what (roles) signed off
- [ ] Terms / rules page reviewed by the Sports Centre

## 7. Quality and rollout
- [ ] Automated tests for the booking rules
- [ ] Full flow retested end to end on live system (book → both approvals → no-show → ban)
- [ ] Mobile and accessibility check
- [x] Real logo applied
- [ ] Short user guides (student, department head, Sports Centre)
- [ ] Pilot with a few departments
- [ ] Feedback fixes applied
- [ ] Full launch
