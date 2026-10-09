/* The student booking form (modal). Date, slot, category and sports-office parts of the paper form are not asked: the system already knows them. */
(function () {
  const U = CUI.ui, T = CUI.time, FC = CUI.formContent, esc = U.esc;

  function teamFields(p, t) {
    return `<div class="fgrid">
      <label>Department<input name="${p}_department" value="${esc(t.department || '')}" maxlength="80"></label>
      <label>Semester<select name="${p}_semester"><option value="">Select…</option>${FC.semesters.map(s => `<option ${t.semester === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Captain's name<input name="${p}_captainName" value="${esc(t.captainName || '')}" maxlength="60"></label>
      <label>Captain's registration no.<input name="${p}_captainReg" value="${esc(t.captainReg || '')}" maxlength="30"></label>
      <label>Mobile no.<input name="${p}_mobile" type="tel" value="${esc(t.mobile || '')}" placeholder="03XX-XXXXXXX" maxlength="20"></label>
      <label>Email<input name="${p}_email" type="email" value="${esc(t.email || '')}" maxlength="80"></label>
    </div>`;
  }
  const playerRow = (i, p) => `<div class="prow"><span>${i}</span><input class="pn" placeholder="Player name" value="${esc((p && p.name) || '')}" maxlength="60"><input class="pr" placeholder="Registration no." value="${esc((p && p.reg) || '')}" maxlength="30"></div>`;
  function playerList(p, first) {
    let rows = '';
    for (let i = 1; i <= FC.defaultPlayerRows; i++) rows += playerRow(i, i === 1 ? first : null);
    return `<div class="plist" data-team="${p}">${rows}</div><button type="button" class="btn btn-secondary btn-sm" data-addplayer="${p}">+ Add player</button>`;
  }

  CUI.requestForm = {
    /** open({user, date, hour, onSubmit(form)}) — onSubmit may throw; its message is shown inside the form. */
    open({ user, date, hour, onSubmit }) {
      const captainA = { name: user.name, reg: user.rollNo };
      const body = `
        <div class="summary"><div><span>Date</span><strong>${esc(T.fmtDate(date))}</strong></div><div><span>Time</span><strong>${esc(T.fmtRange(hour))}</strong></div>
          <div><span>Court</span><strong>${esc(CUI.config.courtName)}</strong></div></div>
        <div class="alert alert-info">Other students may request the same slot. Your department head and the Sports Centre decide whose request is approved, and approvals act as signatures. Only a <b>confirmed</b> booking locks the slot.</div>
        <div id="formErrors" role="alert"></div>

        <div class="fsec"><h4>A. Booking details</h4>
          <div class="radios">${FC.purposes.map(([k, l]) => `<label class="radio"><input type="radio" name="purpose" value="${k}"> ${esc(l)}</label>`).join('')}</div></div>

        <div class="fsec"><h4>B. Team details</h4>
          <h5>Team A <span class="muted">(your team)</span></h5>
          ${teamFields('a', { department: user.department ? user.department.name : '', captainName: user.name, captainReg: user.rollNo || '', email: user.email || '' })}
          <h5>Team B <span class="muted">(required for a friendly match, otherwise leave empty)</span></h5>
          ${teamFields('b', {})}</div>

        <div class="fsec"><h4>C. Players' list</h4>
          <h5>Team A</h5>${playerList('a', captainA)}
          <h5>Team B</h5>${playerList('b', null)}
          <p class="muted" style="margin-top:8px">${esc(FC.playersNote)}</p></div>

        <div class="fsec"><h4>Rules &amp; instructions</h4>
          <details><summary>Read the rules and instructions</summary><ol class="rules">${FC.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol></details>
          <label class="check"><input type="checkbox" name="undertaking"> ${esc(FC.undertaking)}</label></div>`;

      const m = U.modal({
        title: 'Futsal court booking form', body, wide: true,
        actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Submit request', kind: 'success', onClick: async close => {
          const root = m.body, errBox = U.$('#formErrors', root);
          const val = n => (root.querySelector(`[name="${n}"]`) || {}).value || '';
          const team = p => ({
            department: val(p + '_department'), semester: val(p + '_semester'), captainName: val(p + '_captainName'), captainReg: val(p + '_captainReg'), mobile: val(p + '_mobile'), email: val(p + '_email'),
            players: U.$$(`.plist[data-team="${p}"] .prow`, root).map(r => ({ name: U.$('.pn', r).value, reg: U.$('.pr', r).value }))
          });
          const chosen = root.querySelector('input[name="purpose"]:checked');
          const res = CUI.bookingForm.validate({ purpose: chosen ? chosen.value : '', teamA: team('a'), teamB: team('b'), undertaking: root.querySelector('[name="undertaking"]').checked });
          const show = html => { errBox.innerHTML = html; m.el.querySelector('.modal').scrollTo({ top: 0, behavior: 'smooth' }); };
          if (!res.ok) return show(`<div class="alert alert-danger"><strong>Please fix the following</strong><ul>${res.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`);
          try { await onSubmit(res.form); close(); }
          catch (e) { show(`<div class="alert alert-danger"><strong>Request not submitted</strong>${esc(e.message)}</div>`); }
        } }]
      });
      m.body.addEventListener('click', e => {
        const add = e.target.closest('[data-addplayer]');
        if (!add) return;
        const list = U.$(`.plist[data-team="${add.dataset.addplayer}"]`, m.body), n = list.children.length;
        if (n >= FC.maxPlayers) return U.toast(`At most ${FC.maxPlayers} players per team.`, 'error');
        list.insertAdjacentHTML('beforeend', playerRow(n + 1, null));
      });
      return m;
    }
  };
})();
