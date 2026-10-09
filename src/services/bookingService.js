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
            const confirmed = E.holder(state.bookings, date, hour);
            const reqs = E.requests(state.bookings, date, hour);
            const own = viewer && viewer.role === 'STUDENT' ? [confirmed, ...reqs].find(x => x && x.studentId === viewer.id) || null : null;
            // students see only their own entry; heads see everything
            const entries = (seeNames ? [confirmed, ...reqs].filter(Boolean) : own ? [own] : []).map(x => K.enrich(state, x));
            return {
              date, hour, state: st, mine: !!own, blockReason: st === 'blocked' ? E.blockFor(state.blocks, date, hour).reason : null,
              status: own ? own.status : confirmed ? confirmed.status : null,
              requests: reqs.length,                              // number of pending competing requests (no names)
              booking: entries[0] || null, entries
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

    async createBooking(studentId, date, hour, form) {
      const { state, now } = K.read();                       // re-read right before write = double-booking guard
      const student = K.userOf(state, studentId);
      if (!student || student.role !== 'STUDENT') throw new SE('FORBIDDEN', 'Only students can create bookings.');
      const fail = E.checkBookingRules({ bookings: state.bookings, bans: state.bans, blocks: state.blocks, studentId, date, hour, nowMs: now });
      if (fail) throw new SE(fail.code, fail.message);
      const check = CUI.bookingForm.validate(form);
      if (!check.ok) throw new SE('FORM_INVALID', check.errors.join(' '));
      const id = K.nextId(state, 'booking', 'b');
      const b = {
        id, ref: 'FC-' + state.counters.booking, studentId, departmentId: student.departmentId, date, hour,
        status: 'PENDING_DEPARTMENT', createdAt: now, deptDecision: null, scDecision: null, rejectedAt: null, form: check.form
      };
      state.bookings.push(b);
      K.audit(state, studentId, 'BOOKING_CREATED', `${student.name} requested ${b.ref}: ${T.fmtDate(date)} ${T.fmtRange(hour)} (${CUI.bookingForm.purposeLabel(check.form.purpose)})`);
      K.write(state);
      return K.enrich(state, b);
    },

    /** One booking incl. its form. Allowed for the owner, the department head of its department, and the Sports Centre head. */
    async getBooking(actorId, bookingId) {
      const { state } = K.read();
      const actor = K.userOf(state, actorId), b = state.bookings.find(x => x.id === bookingId);
      if (!actor || !b) throw new SE('NOT_FOUND', 'Booking not found.');
      const ok = actor.role === 'SC_HEAD' || (actor.role === 'STUDENT' && b.studentId === actor.id) || (actor.role === 'DEPT_HEAD' && b.departmentId === actor.departmentId);
      if (!ok) throw new SE('FORBIDDEN', 'You do not have permission to view this booking.');
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
        .map(b => b.competing ? { ...b, rivals: E.requests(state.bookings, b.date, b.hour).filter(x => x.id !== b.id).map(x => { const e = K.enrich(state, x); return { id: x.id, studentName: e.studentName, departmentCode: e.departmentCode, status: x.status }; }) } : { ...b, rivals: [] })
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
      if (kind === 'approve') {
        // The slot is now locked: every other pending request for it loses automatically.
        E.requests(state.bookings, b.date, b.hour).filter(x => x.id !== b.id).forEach(x => {
          x.status = 'REJECTED'; x.rejectedAt = 'SPORTS_CENTRE';
          x.scDecision = { by: actor.id, at: now, reason: 'This slot was given to another request.' };
          K.audit(state, actorId, 'SC_REJECTED', `Auto-rejected ${x.ref} (${K.userOf(state, x.studentId).name}): slot given to ${b.ref}`);
        });
      }
      if (kind === 'reject') b.rejectedAt = 'SPORTS_CENTRE';
    }
    K.audit(state, actorId, (isDept ? 'DEPT_' : 'SC_') + (kind === 'approve' ? 'APPROVED' : 'REJECTED'), `${isDept ? 'Department' : 'Sports centre'} ${kind === 'approve' ? 'approved' : 'rejected'} ${b.ref}${decision.reason ? ' — ' + decision.reason : ''}`);
    K.write(state);
    return Promise.resolve(K.enrich(state, b));
  }
})();
