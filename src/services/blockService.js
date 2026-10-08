/* Court closures ("blockers"): maintenance, exams, holidays, events. */
(function () {
  const T = CUI.time, E = CUI.engine, K = CUI.core, SE = K.ServiceError;

  CUI.blockService = {
    async list() { const { state } = K.read(); return state.blocks.slice().sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)); },

    /** blk: {dateFrom, dateTo, hourFrom|null, hourTo|null, reason}. Cancels affected upcoming bookings. Returns {cancelled}. */
    async add(actorId, blk) {
      const { state, now } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const reason = (blk.reason || '').trim();
      if (!blk.dateFrom || !blk.dateTo || blk.dateTo < blk.dateFrom) throw new SE('VALIDATION', 'Choose a valid date range.');
      if (!reason) throw new SE('VALIDATION', 'Please give a reason for the closure.');
      const allDay = blk.hourFrom == null || blk.hourFrom === '';
      const hf = allDay ? null : Number(blk.hourFrom), ht = allDay ? null : Number(blk.hourTo);
      if (!allDay && ht < hf) throw new SE('VALIDATION', 'End hour must not be before start hour.');
      const b = { id: K.nextId(state, 'block', 'blk'), dateFrom: blk.dateFrom, dateTo: blk.dateTo, hourFrom: hf, hourTo: ht, reason, createdBy: actorId, createdAt: now };
      state.blocks.push(b);
      let cancelled = 0;
      state.bookings.forEach(x => {
        if (['PENDING_DEPARTMENT', 'PENDING_SPORTS_CENTRE', 'CONFIRMED'].includes(x.status) && T.slotStartMs(x.date, x.hour) > now && E.blockFor([b], x.date, x.hour)) {
          x.status = 'CANCELLED'; x.cancelledAt = now; x.cancelledBy = 'ADMIN'; x.cancelReason = `Court closed: ${reason}`; cancelled++;
        }
      });
      K.audit(state, actorId, 'BLOCK_ADDED', `Closed court ${T.fmtShortDate(b.dateFrom)}${b.dateTo !== b.dateFrom ? '–' + T.fmtShortDate(b.dateTo) : ''} ${allDay ? '(all day)' : T.fmtHour(hf) + '–' + T.fmtHour(ht + 1)} — ${reason}; ${cancelled} booking(s) cancelled`);
      K.write(state);
      return { cancelled };
    },

    async remove(actorId, id) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const b = state.blocks.find(x => x.id === id);
      if (!b) throw new SE('NOT_FOUND', 'Closure not found.');
      state.blocks = state.blocks.filter(x => x.id !== id);
      K.audit(state, actorId, 'BLOCK_REMOVED', `Reopened court (${T.fmtShortDate(b.dateFrom)}–${T.fmtShortDate(b.dateTo)}, ${b.reason})`);
      K.write(state);
    }
  };
})();
