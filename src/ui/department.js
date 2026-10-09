/* Department Sports Head controller. */
document.addEventListener('DOMContentLoaded', async () => {
  const U = CUI.ui, T = CUI.time, esc = U.esc, S = CUI.services;
  const user = await U.guard('DEPT_HEAD');
  if (!user) return;
  U.$('#deptSub').textContent = `${user.department.name} — first-level approval for your department's students only.`;

  function decisionText(b) {
    if (b.status === 'REJECTED') return b.rejectedAt === 'DEPARTMENT' ? 'Rejected by you' + (b.deptDecision && b.deptDecision.reason ? ` — “${b.deptDecision.reason}”` : '') : 'Rejected by sports centre';
    if (b.status === 'CANCELLED') return b.cancelledBy === 'ADMIN' ? 'Cancelled by sports centre (court closed)' : 'Cancelled by student';
    if (b.status === 'EXPIRED') return 'Expired before a decision was completed';
    if (b.status === 'PENDING_SPORTS_CENTRE') return 'You approved · awaiting sports centre';
    if (b.status === 'CONFIRMED') return 'Fully approved';
    if (b.status === 'NO_SHOW') return 'Student did not attend';
    return '';
  }

  async function run(fn, okMsg) {
    try { await fn(); U.toast(okMsg, 'success'); } catch (e) { U.toast(e.message, 'error'); }
    await refresh();
  }

  async function refresh() {
    const [all, bans] = await Promise.all([S.bookings.listForDepartment(user.id), S.bans.listActive(user.id)]);
    const pending = all.filter(b => b.status === 'PENDING_DEPARTMENT').sort((a, b) => (a.date + a.hour).localeCompare(b.date + b.hour));
    const history = all.filter(b => b.status !== 'PENDING_DEPARTMENT');
    const weekAgo = T.nowMs() - 7 * 86400000;

    U.$('#kpis').innerHTML = `
      <div class="kpi"><div class="v">${pending.length}</div><div class="l">Awaiting your decision</div></div>
      <div class="kpi"><div class="v">${all.filter(b => b.deptDecision && b.deptDecision.by && b.deptDecision.at > weekAgo && b.rejectedAt !== 'DEPARTMENT').length}</div><div class="l">Approved in last 7 days</div></div>
      <div class="kpi"><div class="v">${bans.length}</div><div class="l">Students currently banned</div></div>`;
    const cnt = U.$('#cnt-queue'); cnt.hidden = !pending.length; cnt.textContent = pending.length;

    U.$('#queue').innerHTML = pending.length ? U.groupBySlot(pending).map(g => {
      const rows = g.slice().sort((a, b) => a.createdAt - b.createdAt).map(b => `<div class="sg-row"><div class="sg-who"><strong>${esc(b.studentName)}</strong><span class="sub">${esc(b.studentRoll)} · requested ${esc(T.fmtDateTime(b.createdAt))}</span><span class="sub">Purpose: <strong>${esc(CUI.formView.purposeLabel(b.form) || '—')}</strong></span></div>
        <div class="actions" style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" data-form="${b.id}">View form</button><button class="btn btn-success btn-sm" data-ap="${b.id}">Approve</button><button class="btn btn-danger btn-sm" data-rj="${b.id}">Reject</button></div></div>`).join('');
      const total = g[0].competing + 1;
      const others = total - g.length;
      return U.slotGroup(g[0].date, g[0].hour, total, rows + (others > 0 ? `<div class="sg-row muted-row">${others} more request${others > 1 ? 's' : ''} for this slot from other students (visible to the Sports Centre).</div>` : ''));
    }).join('') : U.empty('No bookings are waiting for your approval.');

    U.$('#history').innerHTML = history.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Ref</th><th>Student</th><th>Slot</th><th>Status</th><th>Outcome</th><th></th></tr></thead><tbody>
      ${history.map(b => `<tr><td>${esc(b.ref)}</td><td><strong>${esc(b.studentName)}</strong><span class="sub">${esc(b.studentRoll)}</span></td>
        <td>${esc(T.fmtDate(b.date))}<span class="sub">${esc(T.fmtRange(b.hour))}</span></td><td>${U.badge(b.status)}</td><td>${esc(decisionText(b))}</td><td><button class="btn btn-secondary btn-sm" data-form="${b.id}">Form</button></td></tr>`).join('')}
      </tbody></table></div>` : U.empty('No history yet.');

    U.$('#bans').innerHTML = bans.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Student</th><th>Banned since</th><th>Ban ends</th></tr></thead><tbody>
      ${bans.map(x => `<tr><td><strong>${esc(x.student.name)}</strong><span class="sub">${esc(x.student.rollNo)}</span></td><td>${esc(T.fmtDateTime(x.startsAt))}</td><td>${esc(T.fmtDateTime(x.endsAt))}</td></tr>`).join('')}
      </tbody></table></div>` : U.empty('None of your students are currently banned.');
  }

  U.$('#queue').addEventListener('click', async e => {
    const ap = e.target.closest('[data-ap]'), rj = e.target.closest('[data-rj]');
    if (ap) { ap.disabled = true; run(() => S.bookings.approve(user.id, ap.dataset.ap), 'Approved — sent to sports centre.'); }
    if (rj) {
      const list = await S.bookings.listForDepartment(user.id);
      const b = list.find(x => x.id === rj.dataset.rj);
      if (b) U.rejectModal(b, reason => S.bookings.reject(user.id, b.id, reason).then(() => { U.toast('Booking rejected.', 'success'); return refresh(); }).catch(err => { U.toast(err.message, 'error'); return refresh(); }));
    }
  });

  CUI.formView.bind(user.id);
  U.tabs();
  U.autoRefresh(refresh);
  refresh();
});
