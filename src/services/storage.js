/* The ONLY file that touches localStorage. Replace the services layer for Supabase; UI never sees this. */
(function () {
  const C = CUI.config;
  const SESSION_KEY = 'cui.demo.session';
  const CLOCK_KEY = 'cui.demo.clockOffset';
  let memory = null; // fallback if localStorage is unavailable

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  CUI.storage = {
    load() {
      if (memory) return memory;
      const raw = safeGet(C.storageKey);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s && s.version === C.dataVersion) {
            s.blocks = s.blocks || []; s.audit = s.audit || [];   // added after v1 data was first saved
            return s;
          }
        } catch (e) { /* fall through to reseed */ }
      }
      const s = CUI.seed.build();
      this.save(s);
      return s;
    },
    save(state) {
      const raw = JSON.stringify(state);
      safeSet(C.storageKey, raw);
      if (safeGet(C.storageKey) !== raw) memory = state;
    },
    reset() {
      memory = null;
      safeDel(C.storageKey);
      safeDel(CLOCK_KEY);
      this.save(CUI.seed.build());
    },
    getSessionUserId() { return safeGet(SESSION_KEY); },
    setSessionUserId(id) { id ? safeSet(SESSION_KEY, id) : safeDel(SESSION_KEY); },
    getClockOffset() { return parseInt(safeGet(CLOCK_KEY) || '0', 10) || 0; },
    setClockOffset(ms) { ms ? safeSet(CLOCK_KEY, String(ms)) : safeDel(CLOCK_KEY); }
  };
})();
