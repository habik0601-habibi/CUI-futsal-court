/* Landing page: link to the portal for the current demo user. */
document.addEventListener('DOMContentLoaded', async () => {
  const U = CUI.ui;
  const user = await CUI.session.getCurrentUser();
  const box = U.$('#homeActions');
  if (user) {
    U.$('#userChip').innerHTML = `<strong>${U.esc(user.name)}</strong><span>${U.esc(U.ROLE_LABEL[user.role])}</span>`;
    box.innerHTML = `<a class="btn btn-primary" href="${U.ROLE_HOME[user.role]}">Open my portal &rarr;</a>
      <span class="muted" style="margin-left:10px">Signed in (demo) as ${U.esc(user.name)}</span>`;
  } else {
    box.innerHTML = `<button class="btn btn-primary" id="pick">Choose a demo user to begin</button>
      <p class="muted" style="margin-top:10px">There is no login yet. Use the <strong>Demo mode</strong> panel (bottom-right) to act as a Student, Department Sports Head or Sports Centre Head.</p>`;
    U.$('#pick').onclick = () => CUI.demo.open();
  }
});
