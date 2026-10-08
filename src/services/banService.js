/* Ban queries. Bans are created by bookingService.markNoShow. */
(function () {
  const K = CUI.core, SE = K.ServiceError;

  CUI.banService = {
    /** SC head: all active bans. Dept head: bans of own department's students only. */
    async listActive(actorId) {
      const { state, now } = K.read();
      const actor = K.userOf(state, actorId);
      if (!actor || actor.role === 'STUDENT') throw new SE('FORBIDDEN', 'You do not have permission to view bans.');
      return state.bans
        .filter(x => !x.liftedAt && x.endsAt > now)
        .map(x => ({ ...x, student: K.userOf(state, x.studentId), booking: state.bookings.find(b => b.id === x.bookingId) || null }))
        .filter(x => x.student && (actor.role === 'SC_HEAD' || x.student.departmentId === actor.departmentId))
        .map(x => ({ ...x, departmentName: (K.deptOf(state, x.student.departmentId) || {}).name }))
        .sort((a, b) => a.endsAt - b.endsAt);
    },
    /** SC head only: lift a ban early. */
    async lift(actorId, banId, reason) {
      const { state, now } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const x = state.bans.find(b => b.id === banId);
      if (!x || x.liftedAt || x.endsAt <= now) throw new SE('NOT_FOUND', 'This ban is not active.');
      x.liftedAt = now; x.liftedBy = actorId; x.liftReason = (reason || '').trim() || null;
      const s = K.userOf(state, x.studentId);
      K.audit(state, actorId, 'BAN_LIFTED', `Lifted ban of ${s ? s.name : 'student'} early${x.liftReason ? ' — ' + x.liftReason : ''}`);
      K.write(state);
    }
  };
})();
