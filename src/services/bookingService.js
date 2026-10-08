/* Booking data access + business actions. All methods are async so a Supabase implementation is a drop-in. */
(function () {
  const C = CUI.config, T = CUI.time, E = CUI.engine, K = CUI.core, SE = K.ServiceError;

  function sortDesc(a, b) { return (b.date + String(b.hour).padStart(2, '0')).localeCompare(a.date + String(a.hour).padStart(2, '0')); }

  CUI.bookingService = {
    /** Mon-Fri grid for the week starting at weekStart. viewer: user id (students) or null. */
    async getWeek(weekStart, viewerId) {
      const { state, now } = K.read();
      const viewer = viewerId ? K.userOf(state, viewerId) : null;
      const seeNames = viewer && viewer.role !== 'STUDENT';
      const days = [];
      for (let i = 0; i < 5; i++) {
        const date = T.addDays(weekStart, i);
        days.push({
          date,
          slots: E.hours().map(hour => {
            const st = E.slotState(state.bookings, date, hour, now, state.blocks);
            const bk = E.holder(state.bookings, date, hour);
            const mine = !!(bk && viewer && bk.studentId === viewer.id);
            return {
              date, hour, state: st, mine, blockReason: st === 'blocked' ? E.blockFor(state.blocks, date, hour).reason : null,
              status: bk ? bk.status : null,
              booking: bk && (mine || seeNames) ? K.enrich(state, bk) : null
            };
          })
        });
      }
      return { weekStart, days, today: T.todayPK(now), nowMs: now, latest: T.addDays(T.todayPK(now), C.maxDaysAhead) };
    },

    async getUsage(studentId) {
      const { state, now } = K.read();
      const today = T.todayPK(now);
      const u = E.usage(state.bookings, studentId, today);
      return { today: u.day.length, week: u.week.length, maxDay: C.maxPerDay, maxWeek: C.maxPerWeek, weekStart: u.weekStart, ban: E.activeBan(state.bans, studentId, now) };
    },

    /** Dry-run of the rules, so the UI can show the exact blocking rule before confirming. */
    async checkRules(studentId, date, hour) {
      const { state, now } = K.read();
      return E.checkBookingRules({ bookings: state.bookings, bans: state.bans, blocks: state.blocks, studentId, date, hour, nowMs: now });
    },

    async createBooking(studentId, date, hour) {
      const { state, now } = K.read();                       // re-read right before write = double-booking guard
      const student = K.userOf(state, studentId);
      if (!student || student.role !== 'STUDENT') throw new SE('FORBIDDEN', 'Only students can create bookings.');
      const fail = E.checkBookingRules({ bookings: state.bookings, bans: state.bans, blocks: state.blocks, studentId, date, hour, nowMs: now });
      if (fail) throw new SE(fail.code, fail.message);
      const id = K.nextId(state, 'booking', 'b');
      const b = {
        id, ref: 'FC-' + state.counters.booking, studentId, departmentId: student.departmentId, date, hour,
        status: 'PENDING_DEPARTMENT', createdAt: now, deptDecision: null, scDecision: null, rejectedAt: null
      };
      state.bookings.push(b);
      K.audit(state, studentId, 'BOOKING_CREATED', `${student.name} requested ${b.ref}: ${T.fmtDate(date)} ${T.fmtRange(hour)}`);
      K.write(state);
      return K.enrich(state, b);
    },

    async listMyBookings(studentId) {
      const { state } = K.read();
      return state.bookings.filter(b => b.studentId === studentId).sort(sortDesc).map(b => K.enrich(state, b));
    },

    async listForDepartment(actorId) {
      const { state } = K.read();
      const head = K.requireRole(state, actorId, 'DEPT_HEAD');
      return state.bookings.filter(b => b.departmentId === head.departmentId).sort(sortDesc).map(b => K.enrich(state, b));
    },

    /** filters: {from, to, departmentId, status, q} */
    async listAll(actorId, filters) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const f = filters || {};
      const q = (f.q || '').trim().toLowerCase();
      return state.bookings
        .filter(b => (!f.from || b.date >= f.from) && (!f.to || b.date <= f.to) && (!f.departmentId || b.departmentId === f.departmentId) && (!f.status || b.status === f.status))
        .map(b => K.enrich(state, b))
        .filter(b => !q || b.studentName.toLowerCase().includes(q) || (b.studentRoll || '').toLowerCase().includes(q) || b.ref.toLowerCase().includes(q))
        .sort(sortDesc);
    },

    async approve(actorId, bookingId) { return act(actorId, bookingId, 'approve'); },
    async reject(actorId, bookingId, reason) { return act(actorId, bookingId, 'reject', reason); },

    /** Student cancels own pending/confirmed booking any time before the slot starts. Frees the slot. */
    async cancelBooking(actorId, bookingId) {
      const { state, now } = K.read();
      const b = state.bookings.find(x => x.id === bookingId);
      if (!b || b.studentId !== actorId) throw new SE('FORBIDDEN', 'You can only cancel your own bookings.');
      if (!['PENDING_DEPARTMENT', 'PENDING_SPORTS_CENTRE', 'CONFIRMED'].includes(b.status)) throw new SE('INVALID_STATE', 'This booking can no longer be cancelled.');
      if (T.slotStartMs(b.date, b.hour) <= now) throw new SE('PAST_SLOT', 'The slot has already started and can no longer be cancelled.');
      const was = b.status;
      b.status = 'CANCELLED'; b.cancelledAt = now; b.cancelledBy = 'STUDENT';
      K.audit(state, actorId, 'BOOKING_CANCELLED', `Student cancelled ${b.ref} (${T.fmtDate(b.date)} ${T.fmtRange(b.hour)}, was ${E.statusText(was)})`);
      K.write(state);
      return K.enrich(state, b);
    },

    async markNoShow(actorId, bookingId) {
      const { state, now } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const b = state.bookings.find(x => x.id === bookingId);
      if (!b) throw new SE('NOT_FOUND', 'Booking not found.');
      if (b.status !== 'CONFIRMED') throw new SE('INVALID_STATE', 'Only CONFIRMED bookings can be marked as no-show.');
      if (T.slotEndMs(b.date, b.hour) > now) throw new SE('SLOT_NOT_FINISHED', 'A no-show can only be marked after the slot has finished.');
      b.status = 'NO_SHOW'; b.noShowMarkedAt = now;
      state.bans.push({ id: K.nextId(state, 'ban', 'ban'), studentId: b.studentId, bookingId: b.id, startsAt: now, endsAt: now + C.banDays * 86400000 });
      K.audit(state, actorId, 'NO_SHOW', `Marked ${b.ref} as no-show; ${K.userOf(state, b.studentId).name} banned until ${T.fmtDateTime(now + C.banDays * 86400000)}`);
      K.write(state);
      return K.enrich(state, b);
    }
  };

  function act(actorId, bookingId, kind, reason) {
    const { state, now } = K.read();
    const actor = K.userOf(state, actorId);
    const b = state.bookings.find(x => x.id === bookingId);
    if (!actor || !b) throw new SE('NOT_FOUND', 'Booking not found.');
    const isDept = actor.role === 'DEPT_HEAD' && b.status === 'PENDING_DEPARTMENT' && actor.departmentId === b.departmentId;
    const isSC = actor.role === 'SC_HEAD' && b.status === 'PENDING_SPORTS_CENTRE';
    if (!isDept && !isSC) {
      if (b.status === 'EXPIRED') throw new SE('EXPIRED', 'This booking has expired because its slot has already started.');
      throw new SE('FORBIDDEN', 'This booking is not waiting for your decision.');
    }
    const decision = { by: actor.id, at: now, reason: kind === 'reject' ? (reason || '').trim() || null : null };
    if (isDept) {
      b.deptDecision = decision;
      b.status = kind === 'approve' ? 'PENDING_SPORTS_CENTRE' : 'REJECTED';
      if (kind === 'reject') b.rejectedAt = 'DEPARTMENT';
    } else {
      b.scDecision = decision;
      b.status = kind === 'approve' ? 'CONFIRMED' : 'REJECTED';
      if (kind === 'reject') b.rejectedAt = 'SPORTS_CENTRE';
    }
    K.audit(state, actorId, (isDept ? 'DEPT_' : 'SC_') + (kind === 'approve' ? 'APPROVED' : 'REJECTED'), `${isDept ? 'Department' : 'Sports centre'} ${kind === 'approve' ? 'approved' : 'rejected'} ${b.ref}${decision.reason ? ' — ' + decision.reason : ''}`);
    K.write(state);
    return Promise.resolve(K.enrich(state, b));
  }
})();
