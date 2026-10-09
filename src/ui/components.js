/* Shared UI helpers: escaping, badges, toasts, modal, role guard. */
(function () {
  const T = CUI.time;
  const ROLE_LABEL = { STUDENT: 'Student', DEPT_HEAD: 'Department Sports Head', SC_HEAD: 'Sports Centre Head' };
  const ROLE_HOME = { STUDENT: 'student.html', DEPT_HEAD: 'department.html', SC_HEAD: 'sports-centre.html' };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const BADGE = {
    PENDING_DEPARTMENT: ['pending', 'Pending – department'],
    PENDING_SPORTS_CENTRE: ['pending-sc', 'Pending – sports centre'],
    CONFIRMED: ["confirmed", "Confirmed"], CANCELLED: ["cancelled", "Cancelled"], REJECTED: ['rejected', 'Rejected'], EXPIRED: ['expired', 'Expired'], NO_SHOW: ['noshow', 'No-show']
  };
  function badge(status) { const b = BADGE[status] || ['expired', status]; return `<span class="badge badge-${b[0]}">${esc(b[1])}</span>`; }

  /** Student-friendly explanation of where a booking is. */
  function statusDetail(b) {
    switch (b.status) {
      case 'PENDING_DEPARTMENT': return 'Waiting for department approval';
      case 'PENDING_SPORTS_CENTRE': return 'Waiting for sports centre approval';
      case 'CONFIRMED': return 'Confirmed';
      case 'REJECTED': {
        const step = b.rejectedAt === 'SPORTS_CENTRE' ? 'sports centre' : 'department';
        const d = b.rejectedAt === 'SPORTS_CENTRE' ? b.scDecision : b.deptDecision;
        return `Rejected by ${step}` + (d && d.reason ? ` — “${d.reason}”` : '');
      }
      case 'CANCELLED': return b.cancelledBy === 'ADMIN' ? `Cancelled by the sports centre — ${b.cancelReason || 'court closed'}` : 'Cancelled by you';
      case 'EXPIRED': return 'Expired — not confirmed before the slot started';
      case 'NO_SHOW': return `No-show — banned for ${CUI.config.banDays} days`;
      default: return b.status;
    }
  }

  function toast(msg, kind) {
    let host = $('#toastHost');
    if (!host) { host = document.createElement('div'); host.id = 'toastHost'; host.className = 'toast-host'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3800);
  }

  /** modal({title, body, actions:[{label, kind, onClick(close, btn)}]}) */
  function modal(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <div class="modal-head"><h3>${esc(opts.title)}</h3><button class="modal-x" aria-label="Close">&times;</button></div>
      <div class="modal-body">${opts.body || ''}</div>
      <div class="modal-foot"></div></div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('.modal-x', overlay).onclick = close;
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    const foot = $('.modal-foot', overlay);
    (opts.actions || [{ label: 'Close', kind: 'secondary' }]).forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-' + (a.kind || 'secondary');
      btn.textContent = a.label;
      btn.onclick = async () => {
        if (!a.onClick) return close();
        const label = btn.textContent; btn.disabled = true; btn.textContent = 'Please wait…';
        try { await a.onClick(close, btn); } finally { if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = label; } }
      };
      foot.appendChild(btn);
    });
    return { el: overlay, close, body: $('.modal-body', overlay) };
  }

  /** Asks for an optional rejection reason; onSubmit(reason) may throw to show an error toast. */
  function rejectModal(b, onSubmit) {
    const m = modal({
      title: 'Reject booking',
      body: `<div class="summary"><div><span>Student</span><strong>${esc(b.studentName)}</strong></div><div><span>When</span><strong>${esc(fmtWhen(b))}</strong></div></div>
        <label>Reason (shown to the student, optional)<textarea id="rejReason" maxlength="200" placeholder="e.g. Court reserved for a university event"></textarea></label>`,
      actions: [{ label: 'Cancel', kind: 'secondary' }, { label: 'Reject booking', kind: 'danger', onClick: async close => { await onSubmit($('#rejReason', m.el).value); close(); } }]
    });
  }

  /** Group bookings by slot (date+hour), earliest slot first. */
  function groupBySlot(list) {
    const map = new Map();
    list.forEach(b => { const k = b.date + '|' + b.hour; if (!map.has(k)) map.set(k, []); map.get(k).push(b); });
    return [...map.values()].sort((a, b) => (a[0].date + String(a[0].hour).padStart(2, '0')).localeCompare(b[0].date + String(b[0].hour).padStart(2, '0')));
  }

  /** A card for one slot: big time + date, a clear flag when several students want it, and the rows inside. */
  function slotGroup(date, hour, total, rowsHtml) {
    const contested = total > 1;
    return `<section class="sgroup ${contested ? 'contested' : ''}">
      <header class="sg-head">
        <div><div class="sg-time">${esc(T.fmtRange(hour))}</div><div class="sg-date">${esc(T.fmtDate(date))}</div></div>
        <div class="sg-flag ${contested ? 'hot' : ''}">${contested ? '⚠ ' + total + ' students requested this slot — choose one' : '1 request'}</div>
      </header><div class="sg-body">${rowsHtml}</div></section>`;
  }

  function empty(msg) { return `<div class="empty"><div class="empty-ic">∅</div><p>${esc(msg)}</p></div>`; }

  /** Ensures the logged-in demo user has the expected role; renders header chip. Returns user or null. */
  async function guard(role) {
    const user = await CUI.session.getCurrentUser();
    const chip = $('#userChip');
    if (user && chip) {
      chip.innerHTML = `<strong>${esc(user.name)}</strong><span>${esc(ROLE_LABEL[user.role])}${user.department ? ' · ' + esc(user.department.code) : ''}</span>`;
    }
    if (!user || user.role !== role) {
      const app = $('#app');
      app.innerHTML = `<div class="card gate"><h2>${user ? 'Wrong portal for this role' : 'No user selected'}</h2>
        <p>${user ? `You are signed in as <strong>${esc(ROLE_LABEL[user.role])}</strong>. This page is for <strong>${esc(ROLE_LABEL[role])}</strong>.` : 'There is no real login yet. Use the <strong>Demo mode</strong> panel (bottom-right) to choose a role and user.'}</p>
        <p class="muted">Open the demo panel and pick a ${esc(ROLE_LABEL[role])}, or <a href="${user ? ROLE_HOME[user.role] : 'index.html'}">${user ? 'go to your portal' : 'return home'}</a>.</p></div>`;
      if (window.CUI.demo) CUI.demo.open();
      return null;
    }
    return user;
  }

  /** Tab switching: buttons [data-tab] and panels #tab-<name> */
  function tabs(onChange) {
    const btns = $$('[data-tab]');
    function show(name) {
      btns.forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
      try { sessionStorage.setItem('cui.tab.' + location.pathname, name); } catch (e) { /* ignore */ }
      if (onChange) onChange(name);
    }
    btns.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    let first = btns[0].dataset.tab;
    try { const s = sessionStorage.getItem('cui.tab.' + location.pathname); if (s && btns.some(b => b.dataset.tab === s)) first = s; } catch (e) { /* ignore */ }
    show(first);
    return show;
  }

  function fmtWhen(b) { return `${T.fmtDate(b.date)} · ${T.fmtRange(b.hour)}`; }

  /** Refresh callback whenever another tab changes data, or the clock minute ticks. */
  function autoRefresh(fn) {
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith('cui.')) fn(); });
    setInterval(fn, 30000);
  }

  CUI.ui = { esc, $, $$, badge, statusDetail, toast, modal, rejectModal, groupBySlot, slotGroup, empty, guard, tabs, fmtWhen, autoRefresh, ROLE_LABEL, ROLE_HOME };
})();
