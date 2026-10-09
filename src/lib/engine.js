/* Pure booking engine: no storage, no DOM. Reuses the old site's idea (slot list -> availability check) with the university rules. */
(function () {
  const C = CUI.config, T = CUI.time;
  const PENDING = ['PENDING_DEPARTMENT', 'PENDING_SPORTS_CENTRE'];
  const HOLDING = ['CONFIRMED', 'NO_SHOW'];                   // only these lock a slot; pending requests compete for it
  const COUNTING = [...PENDING, 'CONFIRMED', 'NO_SHOW'];      // statuses that count toward limits (NO_SHOW kept: student is banned anyway)

  const E = {
    PENDING, HOLDING, COUNTING,
    hours() { const a = []; for (let h = C.firstHour; h <= C.lastHour; h++) a.push(h); return a; },
    isHolding: b => HOLDING.includes(b.status),
    isPending: b => PENDING.includes(b.status),

    /** Auto-expiry: pending bookings whose slot has started become EXPIRED. Returns true if anything changed. */
    applyExpiry(state, nowMs) {
      let changed = false;
      state.bookings.forEach(b => {
        if (PENDING.includes(b.status) && T.slotStartMs(b.date, b.hour) <= nowMs) {
          b.status = 'EXPIRED'; b.expiredAt = nowMs; changed = true;
        }
      });
      return changed;
    },

    activeBan(bans, studentId, nowMs) {
      return bans.filter(x => x.studentId === studentId && !x.liftedAt && x.endsAt > nowMs).sort((a, b) => b.endsAt - a.endsAt)[0] || null;
    },

    /** Court closure covering this slot, or null. Block: {dateFrom, dateTo, hourFrom, hourTo (null = all day), reason} */
    blockFor(blocks, date, hour) {
      return (blocks || []).find(b => date >= b.dateFrom && date <= b.dateTo && (b.hourFrom == null || (hour >= b.hourFrom && hour <= b.hourTo))) || null;
    },

    /** Pending requests competing for a slot. */
    requests(bookings, date, hour) { return bookings.filter(b => b.date === date && b.hour === hour && PENDING.includes(b.status)); },

    holder(bookings, date, hour) { return bookings.find(b => b.date === date && b.hour === hour && HOLDING.includes(b.status)) || null; },

    /** Visible state of one slot. */
    slotState(bookings, date, hour, nowMs, blocks) {
      if (!T.isOpenDay(date)) return 'closed';
      const start = T.slotStartMs(date, hour);
      const bk = E.holder(bookings, date, hour);
      if (start <= nowMs) return 'past';
      if (date > T.addDays(T.todayPK(nowMs), C.maxDaysAhead)) return 'beyond';
      if (E.blockFor(blocks, date, hour)) return 'blocked';
      if (!bk) return E.requests(bookings, date, hour).length ? 'requested' : 'available';
      return 'booked';
    },

    usage(bookings, studentId, date) {
      const mine = bookings.filter(b => b.studentId === studentId && COUNTING.includes(b.status));
      const ws = T.weekStart(date), we = T.addDays(ws, 4);
      return {
        day: mine.filter(b => b.date === date),
        week: mine.filter(b => b.date >= ws && b.date <= we),
        weekStart: ws, weekEnd: we
      };
    },

    /** Returns null if OK, else {code, message}. Order matters: first failing rule is reported. */
    checkBookingRules({ bookings, bans, blocks, studentId, date, hour, nowMs }) {
      const ban = E.activeBan(bans, studentId, nowMs);
      if (ban) return { code: 'BANNED', message: `Rule: no-show ban. You are banned from booking until ${T.fmtDateTime(ban.endsAt)} (${C.banDays}-day ban after a missed confirmed booking).` };
      if (!E.hours().includes(hour)) return { code: 'INVALID_SLOT', message: 'That time is outside the court hours (8:00 AM – 5:00 PM).' };
      if (!T.isOpenDay(date)) return { code: 'CLOSED_DAY', message: 'Rule: opening days. The court is closed on weekends (open Monday–Friday, 8:00 AM – 5:00 PM).' };
      if (T.slotStartMs(date, hour) <= nowMs) return { code: 'PAST_SLOT', message: 'Rule: no past slots. This slot has already started or finished.' };
      const latest = T.addDays(T.todayPK(nowMs), C.maxDaysAhead);
      if (date > latest) return { code: 'OUTSIDE_WINDOW', message: `Rule: ${C.maxDaysAhead}-day booking window. You can only book up to ${C.maxDaysAhead} days ahead (latest bookable date: ${T.fmtDate(latest)}).` };
      const blk = E.blockFor(blocks, date, hour);
      if (blk) return { code: 'BLOCKED', message: `Rule: court closure. The court is closed for this slot${blk.reason ? ' (' + blk.reason + ')' : ''}.` };
      if (E.holder(bookings, date, hour)) return { code: 'SLOT_TAKEN', message: 'This slot has already been confirmed for another student. Please choose another slot.' };
      const u = E.usage(bookings, studentId, date);
      if (u.day.length >= C.maxPerDay) {
        const x = u.day[0];
        return { code: 'DAILY_LIMIT', message: `Rule: max ${C.maxPerDay} booking per day. You already have a booking on ${T.fmtDate(date)} (${T.fmtHour(x.hour)}, ${E.statusText(x.status)}).` };
      }
      if (u.week.length >= C.maxPerWeek) {
        const list = u.week.map(x => `${T.dayName(x.date, true)} ${T.fmtHour(x.hour)}`).join(' and ');
        return { code: 'WEEKLY_LIMIT', message: `Rule: max ${C.maxPerWeek} bookings per week (Mon–Fri). You already have ${u.week.length} for the week of ${T.fmtShortDate(u.weekStart)}: ${list}.` };
      }
      return null;
    },

    statusText(s) {
      return ({
        PENDING_DEPARTMENT: 'Waiting for department approval',
        PENDING_SPORTS_CENTRE: 'Waiting for sports centre approval',
        CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled', REJECTED: 'Rejected', EXPIRED: 'Expired', NO_SHOW: 'No-show'
      })[s] || s;
    }
  };
  CUI.engine = E;
})();
