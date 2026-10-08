/* Asia/Karachi (UTC+05:00, no DST) helpers. All dates are 'YYYY-MM-DD' strings in PKT. */
(function () {
  const C = CUI.config;
  const OFFSET = C.utcOffsetHours * 3600000;
  const DAY = 86400000;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = n => String(n).padStart(2, '0');

  function parse(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return { y, m, d }; }
  function utcMidnight(dateStr) { const { y, m, d } = parse(dateStr); return Date.UTC(y, m - 1, d); }

  const T = {
    nowMs() { return Date.now() + CUI.storage.getClockOffset(); },
    /** wall-clock parts in PKT for a timestamp */
    parts(ms) {
      const d = new Date(ms + OFFSET);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() };
    },
    todayPK(ms) { const p = T.parts(ms == null ? T.nowMs() : ms); return `${p.y}-${p2(p.m)}-${p2(p.d)}`; },
    dow(dateStr) { return new Date(utcMidnight(dateStr)).getUTCDay(); },
    addDays(dateStr, n) { const d = new Date(utcMidnight(dateStr) + n * DAY); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; },
    /** Monday of the Mon-Fri week containing dateStr (weekend -> the Monday before) */
    weekStart(dateStr) { const dw = T.dow(dateStr); return T.addDays(dateStr, -((dw + 6) % 7)); },
    isOpenDay(dateStr) { return C.openDays.includes(T.dow(dateStr)); },
    slotStartMs(dateStr, hour) { const { y, m, d } = parse(dateStr); return Date.UTC(y, m - 1, d, hour) - OFFSET; },
    slotEndMs(dateStr, hour) { return T.slotStartMs(dateStr, hour) + C.slotMinutes * 60000; },
    /** PKT 'YYYY-MM-DDTHH:mm' (datetime-local) -> ms */
    fromLocalInput(v) { const [dt, tm] = v.split('T'); const { y, m, d } = parse(dt); const [h, mi] = tm.split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi) - OFFSET; },
    toLocalInput(ms) { const p = T.parts(ms); return `${p.y}-${p2(p.m)}-${p2(p.d)}T${p2(p.h)}:${p2(p.min)}`; },
    dayName(dateStr, short) { const n = DAYS[T.dow(dateStr)]; return short ? n.slice(0, 3) : n; },
    fmtDate(dateStr) { const { y, m, d } = parse(dateStr); return `${T.dayName(dateStr, true)}, ${d} ${MONTHS[m - 1]} ${y}`; },
    fmtShortDate(dateStr) { const { m, d } = parse(dateStr); return `${d} ${MONTHS[m - 1]}`; },
    fmtHour(h) { const hr = h % 12 || 12; return `${hr}:00 ${h >= 12 ? 'PM' : 'AM'}`; },
    fmtRange(h) { const a = h % 12 || 12, b = (h + 1) % 12 || 12; return `${a}:00 ${h >= 12 ? 'PM' : 'AM'} – ${b}:00 ${h + 1 >= 12 ? 'PM' : 'AM'}`; },
    fmtDateTime(ms) { const p = T.parts(ms); const hr = p.h % 12 || 12; return `${p.d} ${MONTHS[p.m - 1]} ${p.y}, ${hr}:${p2(p.min)} ${p.h >= 12 ? 'PM' : 'AM'}`; }
  };
  CUI.time = T;
})();
