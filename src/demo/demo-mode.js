/* ============================================================
   DEMO MODE — isolated. Remove this file (and its <script> tag
   + demo.css link on each page) once real authentication exists.
   Provides: role/user switcher, demo clock, reset data.
   ============================================================ */
(function () {
  const U = CUI.ui, T = CUI.time, esc = U.esc;
  let panel, fab;

  async function build() {
    fab = document.createElement('button');
    fab.className = 'demo-fab'; fab.textContent = 'DEMO MODE'; fab.title = 'Open demo controls (no real authentication)';
    panel = document.createElement('div');
    panel.className = 'demo-panel'; panel.hidden = true;
    document.body.append(fab, panel);
    fab.onclick = () => (panel.hidden ? open() : close());
    await render();
  }

  async function render() {
    const users = await CUI.directoryService.listUsers();
    const depts = await CUI.directoryService.listDepartments();
    const cur = await CUI.session.getCurrentUser();
    const role = cur ? cur.role : 'STUDENT';
    const now = T.nowMs();
    const offset = CUI.storage.getClockOffset();

    const optGroups = r => {
      if (r === 'SC_HEAD') return users.filter(u => u.role === r).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
      return depts.map(d => {
        const list = users.filter(u => u.role === r && u.departmentId === d.id);
        return list.length ? `<optgroup label="${esc(d.name)}">${list.map(u => `<option value="${u.id}">${esc(u.name)}${u.rollNo ? ' (' + esc(u.rollNo) + ')' : ''}</option>`).join('')}</optgroup>` : '';
      }).join('');
    };

    panel.innerHTML = `
      <div class="demo-head"><strong>Demo mode</strong><span>No real authentication — testing only</span><button class="demo-x" aria-label="Close">&times;</button></div>
      <label>Role
        <select id="dmRole">${Object.keys(U.ROLE_LABEL).map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${U.ROLE_LABEL[r]}</option>`).join('')}</select></label>
      <label>User <select id="dmUser">${optGroups(role)}</select></label>
      <button class="btn btn-primary btn-block" id="dmGo">Switch &amp; open portal</button>
      <hr>
      <div class="demo-clock"><div>Court time (PKT)<strong>${esc(T.fmtDateTime(now))}</strong>${offset ? `<em>shifted ${Math.round(offset / 3600000 * 10) / 10} h from real time</em>` : '<em>real time</em>'}</div></div>
      <div class="demo-row">
        <button class="btn btn-secondary btn-sm" data-shift="1">+1 hour</button>
        <button class="btn btn-secondary btn-sm" data-shift="24">+1 day</button>
        <button class="btn btn-secondary btn-sm" data-shift="-1">−1 hour</button>
      </div>
      <label>Jump to (PKT)<input type="datetime-local" id="dmClock" value="${T.toLocalInput(now)}"></label>
      <div class="demo-row"><button class="btn btn-secondary btn-sm" id="dmSet">Set clock</button><button class="btn btn-secondary btn-sm" id="dmReal">Real time</button></div>
      <hr>
      <button class="btn btn-danger btn-block btn-sm" id="dmReset">Reset demo data</button>`;

    const $ = s => panel.querySelector(s);
    $('.demo-x').onclick = close;
    $('#dmRole').onchange = e => { $('#dmUser').innerHTML = optGroups(e.target.value); };
    if (cur) $('#dmUser').value = cur.id;
    $('#dmGo').onclick = () => { const id = $('#dmUser').value; CUI.session.setCurrentUser(id); const u = users.find(x => x.id === id); location.href = U.ROLE_HOME[u.role]; };
    panel.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { CUI.storage.setClockOffset(CUI.storage.getClockOffset() + Number(b.dataset.shift) * 3600000); location.reload(); });
    $('#dmSet').onclick = () => { const v = $('#dmClock').value; if (!v) return; CUI.storage.setClockOffset(T.fromLocalInput(v) - Date.now()); location.reload(); };
    $('#dmReal').onclick = () => { CUI.storage.setClockOffset(0); location.reload(); };
    $('#dmReset').onclick = () => { if (confirm('Reset all demo data (bookings, bans, departments) and the demo clock?')) { CUI.storage.reset(); location.reload(); } };
  }

  function open() { if (!panel) return; render().then(() => { panel.hidden = false; }); }
  function close() { panel.hidden = true; }

  CUI.demo = { open, close };
  document.addEventListener('DOMContentLoaded', build);
})();
