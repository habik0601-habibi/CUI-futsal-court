/* Who is the current user? Today: whoever the Demo panel selected. Replace with real auth (Supabase) later. */
(function () {
  CUI.session = {
    async getCurrentUser() {
      const id = CUI.storage.getSessionUserId();
      return id ? CUI.directoryService.getUser(id) : null;
    },
    /** Demo-only; remove with src/demo when real auth arrives. */
    setCurrentUser(id) { CUI.storage.setSessionUserId(id); }
  };
  CUI.services = {
    session: CUI.session,
    bookings: CUI.bookingService,
    directory: CUI.directoryService,
    bans: CUI.banService,
    blocks: CUI.blockService,
    audit: CUI.auditService
  };
})();
