/* Student portal controller: renders only, all data via CUI.services. */
document.addEventListener('DOMContentLoaded', async () => {
  const U = CUI.ui, T = CUI.time, C = CUI.config, esc = U.esc, S = CUI.services;
  const user = await U.guard('STUDENT');
  if (!user) return;

  let weekStart = T.weekStart(T.todayPK());
  if (!T.isOpenDay(T.todayPK())) weekStart = T.addDays(weekStart, 7);   // weekend: start from next week
  let activeDate = null;

  U.$('#app .page-sub').textContent = `${user.department.name} · ${user.rollNo || ''} — every booking needs department and sports centre approval.`;

  function slotHtml(s) {
    const lbl = T.fmtHour(s.hour);
    let cls = 'slot-' + s.state, sub = '', tag = 'div', attrs = '';
    switch (s.state) {
      case 'available': sub = 'Open'; tag = 'button'; attrs = `data-date="${s.date}" data-hour="${s.hour}" aria-label="Book ${T.fmtDate(s.date)} ${lbl}"`; break;
      case 'requested': sub = `${s.requests} request${s.requests > 1 ? 's' : ''} · open`; tag = 'button'; attrs = `data-date="${s.date}" data-hour="${s.hour}" aria-label="Request ${T.fmtDate(s.date)} ${lbl}"`; break;
      case 'booked': sub = 'Booked'; break;
      case 'past': sub = 'Past'; break;
      case 'beyond': sub = 'Not open yet'; break;
      case 'blocked': sub = 'Court closed'; break;
      default: sub = 'Closed';
    }
    if (s.mine) { cls += ' slot-mine'; sub = s.status === 'CONFIRMED' ? 'Your booking ✓' : 'Your request'; tag = 'div'; attrs = ''; }
    if (s.state === 'blocked' && s.blockReason) attrs += ` title="${esc(s.blockReason)}"`;
    return `<${tag} class="slot ${cls}" ${attrs} ${tag === 'button' ? 'type="button"' : ''}><strong>${lbl}</strong><small>${sub}</small></${tag}>`;
  }

  function renderCalendar(week) {
    const days = week.days;
    const end = days[4].date;
    U.$('#weekLabel').textContent = `${T.fmtShortDate(days[0].date)} – ${T.fmtShortDate(end)}`;
    U.$('#prevWeek').disabled = weekStart <= T.weekStart(week.today);
    U.$('#nextWeek').disabled = T.addDays(weekStart, 7) > week.latest;

    if (!activeDate || !days.some(d => d.date === activeDate)) activeDate = days.some(d => d.date === week.today) ? week.today : days[0].date;

    const hours = CUI.engine.hours();
    const grid = `<div class="week-grid">
      <div></div>${days.map(d => `<div class="wg-head ${d.date === week.today ? 'today' : ''}">${T.dayName(d.date, true)}<small>${T.fmtShortDate(d.date)}</small></div>`).join('')}
      ${hours.map(h => `<div class="wg-time">${T.fmtHour(h)}</div>${days.map(d => slotHtml(d.slots.find(s => s.hour === h))).join('')}`).join('')}
    </div>`;
    const day = days.find(d => d.date === activeDate);
    const slider = `<div class="day-slider">
      <div class="day-pills">${days.map(d => `<button class="day-pill ${d.date === activeDate ? 'active' : ''} ${d.date < week.today || d.date > week.latest ? 'dim' : ''}" data-day="${d.date}"><span>${T.dayName(d.date, true)}</span><strong>${Number(d.date.slice(8))}</strong></button>`).join('')}</div>
      <div class="slot-list">${day.slots.map(slotHtml).join('')}</div></div>`;
    U.$('#calendar').innerHTML = grid + slider;
  }

  async function renderUsage() {
    const u = await S.bookings.getUsage(user.id);
    U.$('#usage').innerHTML = `<span class="pill ${u.today >= u.maxDay ? 'full' : ''}">Today: ${u.today}/${u.maxDay}</span>
      <span class="pill ${u.week >= u.maxWeek ? 'full' : ''}">This week: ${u.week}/${u.maxWeek}</span>
      <span class="muted">Limits count pending and confirmed bookings.</span>`;
    U.$('#banBox').innerHTML = u.ban ? `<div class="alert alert-danger" role="alert"><strong>You are banned from booking</strong>
      Because of a no-show, you cannot make new bookings until <b>${esc(T.fmtDateTime(u.ban.endsAt))}</b> (PKT).</div>` : '';
  }

  const canCancel = b => ['PENDING_DEPARTMENT', 'PENDING_SPORTS_CENTRE', 'CONFIRMED'].includes(b.status) && T.slotStartMs(b.date, b.hour) > T.nowMs();

  async function renderMine() {
    const list = await S.bookings.listMyBookings(user.id);
    U.$('#myBookings').innerHTML = list.length ? `<div class="blist">${list.map(b => `
      <div class="bcard s-${b.status}">
        <div><h4>${esc(T.fmtDate(b.date))} · ${esc(T.fmtRange(b.hour))}</h4>
          <div class="meta">Ref ${esc(b.ref)} · requested ${esc(T.fmtDateTime(b.createdAt))}</div>
          <div class="state">${esc(U.statusDetail(b))}</div></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${U.badge(b.status)}${canCancel(b) ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Cancel booking</button>` : ''}</div></div>`).join('')}</div>` : U.empty('You have no bookings yet. Pick a slot in “Book a slot”.');
  }

  async function refresh() {
    const week = await S.bookings.getWeek(weekStart, user.id);
    renderCalendar(week);
    await Promise.all([renderUsage(), renderMine()]);
  }

  async function openBooking(date, hour) {
    const err = await S.bookings.checkRules(user.id, date, hour);
    const sum = `<div class="summary"><div><span>Date</span><strong>${esc(T.fmtDate(date))}</strong></div>
      <div><span>Time</span><strong>${esc(T.fmtRange(hour))}</strong></div>
      <div><span>Court</span><strong>${esc(C.courtName)}</strong></div>
      <div><span>Department</span><strong>${esc(user.department.name)}</strong></div></div>`;
    if (err) {
      U.modal({ title: 'Cannot book this slot', body: `${sum}<div class="alert alert-danger" role="alert"><strong>Booking blocked</strong>${esc(err.message)}</div>`, actions: [{ label: 'Close', kind: 'secondary' }] });
      return;
    }
    const m = U.modal({
      title: 'Request this slot',
      body: `${sum}<div class="alert alert-info">Your request will be sent to your <b>department sports head</b>, then to the <b>sports centre</b>. Other students can request the same slot. The heads decide whose request is approved, and only a <b>confirmed</b> booking locks the slot. If yours is not confirmed before the slot starts, it expires.</div>`,
      actions: [
        { label: 'Cancel', kind: 'secondary' },
        { label: 'Request this slot', kind: 'success', onClick: async close => {
          try {
            const b = await S.bookings.createBooking(user.id, date, hour);
            close();
            U.modal({ title: 'Request submitted', body: `<div class="summary"><div><span>Reference</span><strong>${esc(b.ref)}</strong></div><div><span>When</span><strong>${esc(U.fmtWhen(b))}</strong></div><div><span>Status</span><strong>${esc(U.statusDetail(b))}</strong></div></div><p class="muted">Track progress in “My bookings”.</p>`,
              actions: [{ label: 'View my bookings', kind: 'primary', onClick: c => { c(); U.tabsShow('mine'); } }] });
          } catch (e) {
            m.body.innerHTML = `${sum}<div class="alert alert-danger" role="alert"><strong>Booking blocked</strong>${esc(e.message)}</div>`;
          }
          await refresh();
        } }
      ]
    });
  }

  U.tabsShow = U.tabs();
  U.$('#myBookings').addEventListener('click', async e => {
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    const b = (await S.bookings.listMyBookings(user.id)).find(x => x.id === btn.dataset.cancel);
    if (!b) return;
    U.modal({
      title: 'Cancel this booking?',
      body: `<div class="summary"><div><span>When</span><strong>${esc(U.fmtWhen(b))}</strong></div><div><span>Status</span><strong>${esc(U.statusDetail(b))}</strong></div></div>
        <div class="alert alert-info">The slot will be released for other students. You can book again if your daily and weekly limits allow.</div>`,
      actions: [{ label: 'Keep booking', kind: 'secondary' }, { label: 'Cancel booking', kind: 'danger', onClick: async close => {
        try { await S.bookings.cancelBooking(user.id, b.id); close(); U.toast('Booking cancelled.', 'success'); } catch (err) { close(); U.toast(err.message, 'error'); }
        await refresh();
      } }]
    });
  });
  U.$('#calendar').addEventListener('click', e => {
    const slot = e.target.closest('button.slot-available, button.slot-requested');
    if (slot) return openBooking(slot.dataset.date, Number(slot.dataset.hour));
    const pill = e.target.closest('.day-pill');
    if (pill) { activeDate = pill.dataset.day; refresh(); }
  });
  U.$('#prevWeek').onclick = () => { weekStart = T.addDays(weekStart, -7); activeDate = null; refresh(); };
  U.$('#nextWeek').onclick = () => { weekStart = T.addDays(weekStart, 7); activeDate = null; refresh(); };
  U.autoRefresh(refresh);
  refresh();
});
