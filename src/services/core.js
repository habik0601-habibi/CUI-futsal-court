/* Shared service helpers. When migrating to Supabase, replace the services (not the UI). */
(function () {
  class ServiceError extends Error {
    constructor(code, message) { super(message); this.name = 'ServiceError'; this.code = code; }
  }

  /** Loads state, applies auto-expiry (computed on read), persists if changed. */
  function read() {
    const state = CUI.storage.load();
    const now = CUI.time.nowMs();
    if (CUI.engine.applyExpiry(state, now)) CUI.storage.save(state);
    return { state, now };
  }
  function write(state) { CUI.storage.save(state); }
  function nextId(state, key, prefix) { state.counters[key] = (state.counters[key] || 0) + 1; return prefix + state.counters[key]; }

  /** Append an audit entry. Call inside the same read→write cycle as the change it records. */
  function audit(state, actorId, action, summary) {
    const a = state.users.find(u => u.id === actorId);
    state.audit.push({
      id: nextId(state, 'audit', 'a'), at: CUI.time.nowMs(), actorId, actorName: a ? a.name : 'Unknown', actorRole: a ? a.role : null, action, summary
    });
  }

  function userOf(state, id) { return state.users.find(u => u.id === id) || null; }
  function deptOf(state, id) { return state.departments.find(d => d.id === id) || null; }

  /** Joins student / department names onto a booking for display. */
  function enrich(state, b) {
    const s = userOf(state, b.studentId), d = deptOf(state, b.departmentId);
    return {
      ...b,
      studentName: s ? s.name : 'Unknown', studentRoll: s ? s.rollNo : '', departmentName: d ? d.name : 'Unknown', departmentCode: d ? d.code : '',
      deptDecisionBy: b.deptDecision ? (userOf(state, b.deptDecision.by) || {}).name : null,
      scDecisionBy: b.scDecision ? (userOf(state, b.scDecision.by) || {}).name : null
    };
  }
  function requireRole(state, actorId, role) {
    const u = userOf(state, actorId);
    if (!u || u.role !== role) throw new ServiceError('FORBIDDEN', 'You do not have permission to perform this action.');
    return u;
  }

  CUI.core = { ServiceError, read, write, nextId, audit, userOf, deptOf, enrich, requireRole };
})();
