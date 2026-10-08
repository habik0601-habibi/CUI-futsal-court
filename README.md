# University Futsal Court Booking (frontend only)

Static HTML + CSS + vanilla JS (same stack as the old Futsal Connect site). No build step.

## Run
Open `index.html` directly, or serve the folder: `python -m http.server 8765` → http://localhost:8765

## Demo mode
There is no authentication. Click the purple **DEMO MODE** button (bottom-right) to pick a role and user, shift the court clock (PKT) and reset data. Everything for it lives in `src/demo/demo-mode.js` + `assets/css/demo.css`. To remove: delete those, the `demo-mode.js` script tag on each page, and implement `src/services/session.js` with real auth.

## Where things are
| Path | Purpose |
|---|---|
| `src/config/app.config.js` | court hours, limits (1/day, 2/week, 7 days, 14-day ban), timezone |
| `src/data/seed.js` | **departments, heads, students**, seed bookings — edit here |
| `src/lib/engine.js` | pure rules: slot states, expiry, limit checks |
| `src/services/*` | the only data layer (localStorage via `storage.js`). Replace with Supabase; UI untouched |
| `src/ui/*` | page controllers (render only) |

See `docs/SUPABASE.md` for the migration notes.
