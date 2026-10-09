/* Pure validation/cleaning of the student booking form. Used by the UI (inline errors) and again by the booking service. */
(function () {
  const FC = CUI.formContent;
  const clean = s => String(s == null ? '' : s).trim();
  const phoneOk = v => { const d = String(v || '').replace(/[^\d]/g, ''); return d.length >= 10 && d.length <= 13; };
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function cleanTeam(t) {
    t = t || {};
    return {
      department: clean(t.department), semester: clean(t.semester), captainName: clean(t.captainName), captainReg: clean(t.captainReg),
      mobile: clean(t.mobile), email: clean(t.email),
      players: (t.players || []).map(p => ({ name: clean(p.name), reg: clean(p.reg) })).filter(p => p.name || p.reg)
    };
  }
  const touched = t => !!(t.department || t.semester || t.captainName || t.captainReg || t.mobile || t.email || t.players.length);

  function validateTeam(label, t, errors) {
    if (!t.department) errors.push(`${label}: department is required.`);
    if (!t.semester) errors.push(`${label}: semester is required.`);
    if (!t.captainName) errors.push(`${label}: captain's name is required.`);
    if (!t.captainReg) errors.push(`${label}: captain's registration number is required.`);
    if (!phoneOk(t.mobile)) errors.push(`${label}: enter a valid mobile number.`);
    if (!emailOk(t.email)) errors.push(`${label}: enter a valid email address.`);
    if (!t.players.length) errors.push(`${label}: list at least one player.`);
    if (t.players.length > FC.maxPlayers) errors.push(`${label}: at most ${FC.maxPlayers} players.`);
    t.players.forEach((p, i) => { if (!p.name || !p.reg) errors.push(`${label}: player ${i + 1} needs both a name and a registration number.`); });
  }

  /** raw: {purpose, teamA, teamB, undertaking}. Returns {ok, errors[], form}. Team B is required for friendly matches, optional otherwise. */
  CUI.bookingForm = {
    validate(raw) {
      raw = raw || {};
      const errors = [];
      if (!FC.purposes.some(p => p[0] === raw.purpose)) errors.push('Choose the purpose of booking.');
      const a = cleanTeam(raw.teamA);
      validateTeam('Team A', a, errors);
      let b = cleanTeam(raw.teamB);
      if (raw.purpose === 'FRIENDLY' || touched(b)) validateTeam('Team B', b, errors); else b = null;
      if (!raw.undertaking) errors.push('Please accept the undertaking.');
      return { ok: !errors.length, errors, form: { purpose: raw.purpose, teamA: a, teamB: b, undertaking: true } };
    },
    purposeLabel(code) { const p = FC.purposes.find(x => x[0] === code); return p ? p[1] : ''; }
  };
})();
