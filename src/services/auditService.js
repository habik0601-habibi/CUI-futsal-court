/* Read-only audit trail (entries are written by the other services). */
(function () {
  const K = CUI.core;
  CUI.auditService = {
    /** SC head only. filters: {action, q}. Newest first. */
    async list(actorId, filters) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      const f = filters || {}, q = (f.q || '').trim().toLowerCase();
      return state.audit.filter(a => (!f.action || a.action === f.action) && (!q || (a.summary + ' ' + a.actorName).toLowerCase().includes(q))).sort((a, b) => b.at - a.at);
    }
  };
})();
