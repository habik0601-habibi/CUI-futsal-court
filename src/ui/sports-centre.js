/* Sports Centre Head controller. */
document.addEventListener('DOMContentLoaded', async () => {
  const U = CUI.ui, T = CUI.time, esc = U.esc, S = CUI.services;
  const user = await U.guard('SC_HEAD');
  if (!user) return;
  let depts = [];

  const filters = () => ({ from: U.$('#fFrom').value, to: U.$('#fTo').value, departmentId: U.$('#fDept').value, status: U.$('#fStatus').value, q: U.$('#fQ').value });

  async function toastRun(fn, okMsg) {
    try { await fn(); U.toast(okMsg, 'success'); } catch (e) { U.toast(e.message, 'error'); }
    await refresh();
  }

  function outcome(b) {
    if (b.status === 'REJECTED') {
      const d = b.rejectedAt === 'SPORTS_CENTRE' ? b.scDecision : b.deptDecision;
      return `Rejected by ${b.rejectedAt === 'SPORTS_CENTRE' ? 'sports centre' : 'department'}` + (d && d.reason ? ` — “${d.reason}”` : '');
    }
    if (b.status === 'CANCELLED') return b.cancelledBy === 'ADMIN' ? (b.cancelReason || 'Cancelled by sports centre') : 'Cancelled by student';
    if (b.status === 'NO_SHOW') return 'Marked no-show · ' + T.fmtDateTime(b.noShowMarkedAt);
    return '';
  }

  async function renderAll() {
    const list = await S.bookings.listAll(user.id, filters());
    const now = T.nowMs();
    U.$('#all').innerHTML = list.length ? `<p class="muted" style="margin-bottom:8px">${list.length} booking(s)</p><div class="table-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Student</th><th>Department</th><th>Slot</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>
      ${list.map(b => {
        const canNoShow = b.status === 'CONFIRMED' && T.slotEndMs(b.date, b.hour) <= now;
        return `<tr><td>${esc(b.ref)}</td><td><strong>${esc(b.studentName)}</strong><span class="sub">${esc(b.studentRoll)}</span></td><td>${esc(b.departmentCode)}</td>
        <td>${esc(T.fmtDate(b.date))}<span class="sub">${esc(T.fmtRange(b.hour))}</span></td><td>${U.badge(b.status)}</td><td>${esc(outcome(b))}</td>
        <td><button class="btn btn-secondary btn-sm" data-form="${b.id}">Form</button> ${canNoShow ? `<button class="btn btn-danger btn-sm" data-ns="${b.id}">Mark no-show</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : U.empty('No bookings match these filters.');
  }

  async function renderClosures() {
    const list = await S.blocks.list();
    const today = T.todayPK();
    U.$('#closures').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Dates</th><th>Hours</th><th>Reason</th><th></th></tr></thead><tbody>
      ${list.map(b => `<tr><td>${esc(T.fmtDate(b.dateFrom))}${b.dateTo !== b.dateFrom ? '<span class="sub">to ' + esc(T.fmtDate(b.dateTo)) + '</span>' : ''}</td>
        <td>${b.hourFrom == null ? 'All day' : esc(T.fmtHour(b.hourFrom) + ' – ' + T.fmtHour(b.hourTo + 1))}</td><td>${esc(b.reason)}${b.dateTo < today ? ' <span class="sub">(past)</span>' : ''}</td>
        <td><button class="btn btn-danger btn-sm" data-unblock="${b.id}">Reopen</button></td></tr>`).join('')}</tbody></table></div>` : U.empty('No court closures.');
  }

  const ACTION_LABEL = { BOOKING_CREATED: 'Booking requested', BOOKING_CANCELLED: 'Booking cancelled', DEPT_APPROVED: 'Department approved', DEPT_REJECTED: 'Department rejected', SC_APPROVED: 'Sports centre approved', SC_REJECTED: 'Sports centre rejected',
    NO_SHOW: 'No-show marked', BAN_LIFTED: 'Ban lifted', BLOCK_ADDED: 'Court closed', BLOCK_REMOVED: 'Court reopened', DEPT_ADDED: 'Department added', DEPT_EDITED: 'Department edited', DEPT_DELETED: 'Department deleted', HEAD_SET: 'Sports head set' };

  async function renderAudit() {
    const sel = U.$('#aAction');
    if (sel.options.length === 1) Object.keys(ACTION_LABEL).forEach(k => sel.add(new Option(ACTION_LABEL[k], k)));
    const list = await S.audit.list(user.id, { q: U.$('#aQ').value, action: sel.value });
    U.$('#audit').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>When (PKT)</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${list.slice(0, 300).map(a => `<tr><td>${esc(T.fmtDateTime(a.at))}</td><td><strong>${esc(a.actorName)}</strong><span class="sub">${esc(U.ROLE_LABEL[a.actorRole] || '')}</span></td><td>${esc(ACTION_LABEL[a.action] || a.action)}</td><td>${esc(a.summary)}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No audit entries yet. Actions will appear here as they happen.');
  }

  /* ---- Court calendar (same grid as students, but tapping a slot shows who booked it) ---- */
  let weekStart = T.weekStart(T.todayPK()), activeDate = null, calWeek = null;
  if (!T.isOpenDay(T.todayPK())) weekStart = T.addDays(weekStart, 7);

  function calSlot(s) {
    const lbl = T.fmtHour(s.hour), es = s.entries || [];
    let cls = 'slot-' + s.state, sub;
    const conf = es.find(x => x.status === 'CONFIRMED' || x.status === 'NO_SHOW');
    if (conf) sub = esc(conf.studentName) + ' · ' + esc(conf.departmentCode);
    else if (es.length) sub = es.length > 1 ? es.length + ' requests' : esc(es[0].studentName) + ' · request';
    else sub = { available: 'Free', blocked: 'Closed', past: 'Past', beyond: 'Free' }[s.state] || '';
    if (s.state === 'past' && es.length) cls += ' slot-booked';
    return `<button type="button" class="slot ${cls}" style="cursor:pointer" data-date="${s.date}" data-hour="${s.hour}"><strong>${lbl}</strong><small>${sub}</small></button>`;
  }

  async function renderCalendar() {
    const week = calWeek = await S.bookings.getWeek(weekStart, user.id);
    const days = week.days;
    U.$('#weekLabel').textContent = `${T.fmtShortDate(days[0].date)} – ${T.fmtShortDate(days[4].date)}`;
    if (!activeDate || !days.some(d => d.date === activeDate)) activeDate = days.some(d => d.date === week.today) ? week.today : days[0].date;
    const hours = CUI.engine.hours();
    const grid = `<div class="week-grid"><div></div>${days.map(d => `<div class="wg-head ${d.date === week.today ? 'today' : ''}">${T.dayName(d.date, true)}<small>${T.fmtShortDate(d.date)}</small></div>`).join('')}
      ${hours.map(h => `<div class="wg-time">${T.fmtHour(h)}</div>${days.map(d => calSlot(d.slots.find(s => s.hour === h))).join('')}`).join('')}</div>`;
    const day = days.find(d => d.date === activeDate);
    const slider = `<div class="day-slider"><div class="day-pills">${days.map(d => `<button class="day-pill ${d.date === activeDate ? 'active' : ''}" data-day="${d.date}"><span>${T.dayName(d.date, true)}</span><strong>${Number(d.date.slice(8))}</strong></button>`).join('')}</div>
      <div class="slot-list">${day.slots.map(calSlot).join('')}</div></div>`;
    U.$('#calendar').innerHTML = grid + slider;
  }

  /** Approve a booking. If other requests compete for the slot, warn that they will be declined. */
  function approveFlow(b, others) {
    if (!others || !others.length) return toastRun(() => S.bookings.approve(user.id, b.id), 'Booking confirmed.');
    U.modal({
      title: 'Approve this request?',
      body: `<div class="summary"><div><span>Approving</span><strong>${esc(b.studentName)} (${esc(b.departmentCode || '')})</strong></div><div><span>Slot</span><strong>${esc(U.fmtWhen(b))}</strong></div></div>
        <div class="alert alert-warn"><strong>${others.length} other request${others.length > 1 ? 's' : ''} for this slot will be declined automatically:</strong>${others.map(o => esc(o.studentName) + ' (' + esc(o.departmentCode) + ')').join(', ')}</div>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Approve and decline others', kind: 'success', onClick: async close => { close(); await toastRun(() => S.bookings.approve(user.id, b.id), 'Booking confirmed. Other requests declined.'); } }]
    });
  }

  function slotDetails(date, hour) {
    const s = calWeek.days.find(d => d.date === date).slots.find(x => x.hour === hour);
    const es = s.entries || [], now = T.nowMs();
    const when = `<div class="summary"><div><span>Date</span><strong>${esc(T.fmtDate(date))}</strong></div><div><span>Time</span><strong>${esc(T.fmtRange(hour))}</strong></div></div>`;
    if (!es.length) {
      const msg = s.state === 'blocked' ? `Court closed: ${esc(s.blockReason || '')}` : s.state === 'past' ? 'Nobody booked or requested this slot.' : 'This slot is free. Nobody has requested it.';
      return U.modal({ title: s.state === 'blocked' ? 'Court closed' : 'Free slot', body: when + '<p>' + msg + '</p>' });
    }
    const dec = (label, d, by) => d ? `<div><span>${label}</span><strong>${esc(by || '')}<br><small>${esc(T.fmtDateTime(d.at))}</small></strong></div>` : '';
    const block = b => {
      const btns = [`<button class="btn btn-secondary btn-sm" data-form="${b.id}">View form</button>`];
      if (b.status === 'PENDING_SPORTS_CENTRE') btns.push(`<button class="btn btn-success btn-sm" data-do="approve" data-id="${b.id}">Approve</button><button class="btn btn-danger btn-sm" data-do="reject" data-id="${b.id}">Reject</button>`);
      if (b.status === 'CONFIRMED' && T.slotEndMs(b.date, b.hour) <= now) btns.push(`<button class="btn btn-danger btn-sm" data-do="noshow" data-id="${b.id}">Mark no-show</button>`);
      return `<div class="summary" style="margin-bottom:10px">
        <div><span>Student</span><strong>${esc(b.studentName)}</strong></div><div><span>Roll no.</span><strong>${esc(b.studentRoll)}</strong></div>
        <div><span>Department</span><strong>${esc(b.departmentName)}</strong></div><div><span>Reference</span><strong>${esc(b.ref)}</strong></div>
        <div><span>Status</span><strong>${U.badge(b.status)}</strong></div><div><span>Requested</span><strong>${esc(T.fmtDateTime(b.createdAt))}</strong></div>
        ${dec('Department approval', b.deptDecision, b.deptDecisionBy)}${dec('Sports centre decision', b.scDecision, b.scDecisionBy)}
        ${btns.length ? '<div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px">' + btns.join('') + '</div>' : ''}</div>`;
    };
    const pend = es.filter(x => x.status.startsWith('PENDING'));
    const head = pend.length > 1 ? `<div class="alert alert-info"><strong>${pend.length} competing requests</strong>Only one can be confirmed. Approving one declines the rest.</div>` : '';
    const m = U.modal({ title: es.length > 1 ? 'Requests for this slot' : 'Booking details', body: when + head + es.map(block).join('') });
    m.body.addEventListener('click', e => {
      const btn = e.target.closest('[data-do]');
      if (!btn) return;
      const b = es.find(x => x.id === btn.dataset.id);
      m.close();
      if (btn.dataset.do === 'approve') approveFlow(b, es.filter(x => x.id !== b.id && x.status.startsWith('PENDING')));
      if (btn.dataset.do === 'reject') U.rejectModal(b, reason => S.bookings.reject(user.id, b.id, reason).then(() => { U.toast('Booking rejected.', 'success'); return refresh(); }).catch(err => { U.toast(err.message, 'error'); return refresh(); }));
      if (btn.dataset.do === 'noshow') toastRun(() => S.bookings.markNoShow(user.id, b.id), 'Marked no-show. Student banned.');
    });
  }

  U.$('#calendar').addEventListener('click', e => {
    const slot = e.target.closest('.slot[data-date]');
    if (slot) return slotDetails(slot.dataset.date, Number(slot.dataset.hour));
    const pill = e.target.closest('.day-pill');
    if (pill) { activeDate = pill.dataset.day; renderCalendar(); }
  });
  U.$('#prevWeek').onclick = () => { weekStart = T.addDays(weekStart, -7); activeDate = null; renderCalendar(); };
  U.$('#nextWeek').onclick = () => { weekStart = T.addDays(weekStart, 7); activeDate = null; renderCalendar(); };
  U.$('#thisWeek').onclick = () => { weekStart = T.weekStart(T.todayPK()); if (!T.isOpenDay(T.todayPK())) weekStart = T.addDays(weekStart, 7); activeDate = null; renderCalendar(); };

  async function renderDepts() {
    depts = await S.directory.listDepartments();
    U.$('#depts').innerHTML = `<div class="dept-grid">${depts.map(d => `<div class="dept-card">
      <div class="code">${esc(d.code)}</div><h3>${esc(d.name)}</h3>
      <p class="muted" style="margin:6px 0 10px">Sports head: ${d.head ? `<strong>${esc(d.head.name)}</strong><br>${esc(d.head.email || '')}` : '<em>none assigned</em>'}<br>${d.studentCount} student(s)</p>
      <div class="actions" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" data-edit="${d.id}">Edit</button>
      <button class="btn btn-secondary btn-sm" data-head="${d.id}">${d.head ? 'Change head' : 'Assign head'}</button>
      <button class="btn btn-danger btn-sm" data-del="${d.id}">Delete</button></div></div>`).join('')}</div>`;
    const cur = U.$('#fDept').value;
    U.$('#fDept').innerHTML = '<option value="">All departments</option>' + depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    U.$('#fDept').value = cur;
  }

  async function refresh() {
    const [pend, bans] = await Promise.all([S.bookings.listAll(user.id, { status: 'PENDING_SPORTS_CENTRE' }), S.bans.listActive(user.id)]);
    const all = await S.bookings.listAll(user.id, {});
    const now = T.nowMs();
    pend.sort((a, b) => (a.date + a.hour).localeCompare(b.date + b.hour));
    const awaitingNoShow = all.filter(b => b.status === 'CONFIRMED' && T.slotEndMs(b.date, b.hour) <= now).length;
    U.$('#kpis').innerHTML = `
      <div class="kpi"><div class="v">${pend.length}</div><div class="l">Awaiting final approval</div></div>
      <div class="kpi"><div class="v">${all.filter(b => b.status === 'PENDING_DEPARTMENT').length}</div><div class="l">With departments</div></div>
      <div class="kpi"><div class="v">${all.filter(b => b.status === 'CONFIRMED' && T.slotEndMs(b.date, b.hour) > now).length}</div><div class="l">Upcoming confirmed</div></div>
      <div class="kpi"><div class="v">${awaitingNoShow}</div><div class="l">Past confirmed (attendance check)</div></div>
      <div class="kpi"><div class="v">${bans.length}</div><div class="l">Active bans</div></div>`;
    const cnt = U.$('#cnt-queue'); cnt.hidden = !pend.length; cnt.textContent = pend.length;

    U.$('#queue').innerHTML = pend.length ? U.groupBySlot(pend).map(g => {
      const mine = g.slice().sort((a, b) => a.createdAt - b.createdAt);
      const ids = new Set(mine.map(b => b.id));
      const withDept = g[0].rivals.filter(r => !ids.has(r.id));       // same slot, still waiting at department stage
      const rows = mine.map(b => `<div class="sg-row"><div class="sg-who"><strong>${esc(b.studentName)}</strong><span class="sub">${esc(b.studentRoll)} · ${esc(b.departmentName)}</span><span class="sub">Purpose: <strong>${esc(CUI.formView.purposeLabel(b.form) || '—')}</strong></span>
        <span class="sub">Department approved ${b.deptDecision ? esc(T.fmtDateTime(b.deptDecision.at)) : ''} by ${esc(b.deptDecisionBy || '')} · requested ${esc(T.fmtDateTime(b.createdAt))}</span></div>
        <div class="actions" style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" data-form="${b.id}">View form</button><button class="btn btn-success btn-sm" data-ap="${b.id}">Approve</button><button class="btn btn-danger btn-sm" data-rj="${b.id}">Reject</button></div></div>`).join('')
        + withDept.map(r => `<div class="sg-row muted-row"><div class="sg-who"><strong>${esc(r.studentName)}</strong> (${esc(r.departmentCode)})<span class="sub">Also requested — still waiting for department approval</span></div><span class="badge badge-pending">With department</span></div>`).join('');
      return U.slotGroup(g[0].date, g[0].hour, g[0].competing + 1, rows);
    }).join('') : U.empty('No bookings are waiting for final approval.');

    U.$('#bans').innerHTML = bans.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Student</th><th>Department</th><th>Banned since</th><th>Ban ends</th><th></th></tr></thead><tbody>
      ${bans.map(x => `<tr><td><strong>${esc(x.student.name)}</strong><span class="sub">${esc(x.student.rollNo)}</span></td><td>${esc(x.departmentName)}</td><td>${esc(T.fmtDateTime(x.startsAt))}</td><td>${esc(T.fmtDateTime(x.endsAt))}</td><td><button class="btn btn-secondary btn-sm" data-lift="${x.id}">Lift ban</button></td></tr>`).join('')}
      </tbody></table></div>` : U.empty('No active bans.');

    await Promise.all([renderAll(), renderDepts(), renderClosures(), renderAudit(), renderCalendar()]);
  }

  function deptForm(d) {
    return U.modal({
      title: d ? 'Edit department' : 'Add department',
      body: `<label>Name<input id="dName" value="${esc(d ? d.name : '')}" maxlength="60"></label><label>Code<input id="dCode" value="${esc(d ? d.code : '')}" maxlength="8"></label>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Save', kind: 'primary', onClick: async close => {
        try { await S.directory.saveDepartment(user.id, { id: d && d.id, name: U.$('#dName').value, code: U.$('#dCode').value }); close(); U.toast('Department saved.', 'success'); await refresh(); }
        catch (e) { U.toast(e.message, 'error'); }
      } }]
    });
  }
  function headForm(d) {
    return U.modal({
      title: `Sports head — ${d.name}`,
      body: `<label>Full name<input id="hName" value="${esc(d.head ? d.head.name : '')}" maxlength="60"></label><label>Email<input id="hEmail" type="email" value="${esc(d.head ? d.head.email : '')}"></label>
        <p class="muted">Each department has exactly one sports head. Saving replaces the current head.</p>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Save', kind: 'primary', onClick: async close => {
        try { await S.directory.setDepartmentHead(user.id, d.id, { name: U.$('#hName').value, email: U.$('#hEmail').value }); close(); U.toast('Department head saved.', 'success'); await refresh(); }
        catch (e) { U.toast(e.message, 'error'); }
      } }]
    });
  }

  U.$('#queue').addEventListener('click', async e => {
    const ap = e.target.closest('[data-ap]'), rj = e.target.closest('[data-rj]');
    if (ap) {
      const b = (await S.bookings.listAll(user.id, {})).find(x => x.id === ap.dataset.ap);
      if (b) approveFlow(b, b.rivals);
    }
    if (rj) {
      const b = (await S.bookings.listAll(user.id, {})).find(x => x.id === rj.dataset.rj);
      if (b) U.rejectModal(b, reason => S.bookings.reject(user.id, b.id, reason).then(() => { U.toast('Booking rejected.', 'success'); return refresh(); }).catch(err => { U.toast(err.message, 'error'); return refresh(); }));
    }
  });
  U.$('#all').addEventListener('click', async e => {
    const ns = e.target.closest('[data-ns]');
    if (!ns) return;
    const b = (await S.bookings.listAll(user.id, {})).find(x => x.id === ns.dataset.ns);
    if (!b) return;
    U.modal({
      title: 'Mark as no-show',
      body: `<div class="summary"><div><span>Student</span><strong>${esc(b.studentName)}</strong></div><div><span>Slot</span><strong>${esc(U.fmtWhen(b))}</strong></div></div>
        <div class="alert alert-warn"><strong>This bans the student for ${CUI.config.banDays} days</strong>from the moment you confirm.</div>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Mark no-show & ban', kind: 'danger', onClick: async close => { close(); await toastRun(() => S.bookings.markNoShow(user.id, b.id), 'Marked no-show. Student banned.'); } }]
    });
  });
  U.$('#depts').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), hd = e.target.closest('[data-head]'), dl = e.target.closest('[data-del]');
    if (ed) deptForm(depts.find(d => d.id === ed.dataset.edit));
    if (hd) headForm(depts.find(d => d.id === hd.dataset.head));
    if (dl) {
      const d = depts.find(x => x.id === dl.dataset.del);
      U.modal({ title: 'Delete department', body: `<p>Delete <strong>${esc(d.name)}</strong> and its sports head? This only works for departments with no students or booking history.</p>`,
        actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Delete', kind: 'danger', onClick: async close => { close(); await toastRun(() => S.directory.deleteDepartment(user.id, d.id), 'Department deleted.'); } }] });
    }
  });
  U.$('#addDept').onclick = () => deptForm(null);
  U.$('#bans').addEventListener('click', async e => {
    const lf = e.target.closest('[data-lift]');
    if (!lf) return;
    const x = (await S.bans.listActive(user.id)).find(b => b.id === lf.dataset.lift);
    if (!x) return;
    const m = U.modal({
      title: 'Lift ban early',
      body: `<div class="summary"><div><span>Student</span><strong>${esc(x.student.name)}</strong></div><div><span>Ban ends</span><strong>${esc(T.fmtDateTime(x.endsAt))}</strong></div></div>
        <label>Reason (recorded in the audit log)<textarea id="liftReason" maxlength="200"></textarea></label>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Lift ban now', kind: 'primary', onClick: async close => { const reason = U.$('#liftReason', m.el).value; close(); await toastRun(() => S.bans.lift(user.id, x.id, reason), 'Ban lifted.'); } }]
    });
  });
  U.$('#closures').addEventListener('click', e => {
    const ub = e.target.closest('[data-unblock]');
    if (ub) toastRun(() => S.blocks.remove(user.id, ub.dataset.unblock), 'Court reopened.');
  });
  U.$('#addBlock').onclick = () => {
    const today = T.todayPK();
    const hourOpts = CUI.engine.hours().map(h => `<option value="${h}">${T.fmtHour(h)}</option>`).join('');
    const m = U.modal({
      title: 'Close the court',
      body: `<label>From date<input type="date" id="bFrom" value="${today}" min="${today}"></label><label>To date<input type="date" id="bTo" value="${today}" min="${today}"></label>
        <label>Hours<select id="bMode"><option value="all">All day</option><option value="range">Specific hours</option></select></label>
        <div id="bHours" hidden><label>First closed slot<select id="bHF">${hourOpts}</select></label><label>Last closed slot<select id="bHT">${hourOpts}</select></label></div>
        <label>Reason (shown to students)<input id="bReason" maxlength="80" placeholder="e.g. Floor maintenance"></label>
        <div class="alert alert-warn">Upcoming bookings inside the closure will be cancelled.</div>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Close court', kind: 'danger', onClick: async close => {
        const range = U.$('#bMode', m.el).value === 'range';
        try {
          const r = await S.blocks.add(user.id, { dateFrom: U.$('#bFrom', m.el).value, dateTo: U.$('#bTo', m.el).value, hourFrom: range ? U.$('#bHF', m.el).value : null, hourTo: range ? U.$('#bHT', m.el).value : null, reason: U.$('#bReason', m.el).value });
          close(); U.toast(`Court closed. ${r.cancelled} booking(s) cancelled.`, 'success'); await refresh();
        } catch (err) { U.toast(err.message, 'error'); }
      } }]
    });
    U.$('#bMode', m.el).onchange = e => { U.$('#bHours', m.el).hidden = e.target.value !== 'range'; };
    U.$('#bHT', m.el).value = CUI.engine.hours().slice(-1)[0];
  };
  U.$('#aQ').addEventListener('input', renderAudit);
  U.$('#aAction').addEventListener('change', renderAudit);
  ['fFrom', 'fTo', 'fDept', 'fStatus'].forEach(id => U.$('#' + id).addEventListener('change', renderAll));
  U.$('#fQ').addEventListener('input', renderAll);
  U.$('#fClear').onclick = () => { ['fFrom', 'fTo', 'fDept', 'fStatus', 'fQ'].forEach(id => { U.$('#' + id).value = ''; }); renderAll(); };

  CUI.formView.bind(user.id);
  U.tabs();
  U.autoRefresh(refresh);
  refresh();
});
