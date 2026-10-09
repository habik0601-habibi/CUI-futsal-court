/* Read-only view of a submitted booking form, for students (own), department heads and the Sports Centre. */
(function () {
  const U = CUI.ui, T = CUI.time, esc = U.esc;
  const row = (l, v) => `<div><span>${l}</span><strong>${esc(v || '—')}</strong></div>`;

  function team(label, t) {
    if (!t) return `<h5>${label}</h5><p class="muted">No second team.</p>`;
    return `<h5>${label}</h5><div class="summary">${row('Department', t.department)}${row('Semester', t.semester)}${row('Captain', t.captainName)}${row('Registration no.', t.captainReg)}${row('Mobile', t.mobile)}${row('Email', t.email)}</div>
      <ol class="players">${t.players.map(p => `<li>${esc(p.name)} <span class="muted">· ${esc(p.reg)}</span></li>`).join('')}</ol>`;
  }

  function html(form) {
    if (!form) return '<p class="muted">No request form is on file for this booking.</p>';
    return `<div class="summary">${row('Purpose', CUI.bookingForm.purposeLabel(form.purpose))}${row('Undertaking', form.undertaking ? 'Accepted ✓' : 'Not accepted')}</div>${team('Team A', form.teamA)}${team('Team B', form.teamB)}`;
  }

  function show(b) {
    U.modal({
      title: `Booking form — ${b.ref}`, wide: true,
      body: `<div class="summary">${row('Student', `${b.studentName} (${b.studentRoll})`)}${row('Department', b.departmentName)}${row('Slot', U.fmtWhen(b))}</div>${html(b.form)}`
    });
  }

  /** Any element with data-form="<bookingId>" opens the form for that booking. */
  function bind(actorId) {
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-form]');
      if (!btn) return;
      try { show(await CUI.bookingService.getBooking(actorId, btn.dataset.form)); } catch (err) { U.toast(err.message, 'error'); }
    });
  }

  CUI.formView = { html, show, bind, purposeLabel: f => (f ? CUI.bookingForm.purposeLabel(f.purpose) : '') };
})();
