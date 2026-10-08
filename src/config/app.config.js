/* Central configuration. Edit here, not in the engine. */
window.CUI = window.CUI || {};
CUI.config = {
  appName: 'University Futsal Court Booking',
  courtName: 'University Futsal Court',
  timezone: 'Asia/Karachi',
  utcOffsetHours: 5,            // Pakistan has no DST, fixed UTC+05:00
  openDays: [1, 2, 3, 4, 5],    // Mon..Fri (0 = Sunday)
  firstHour: 8,                 // 8:00 AM
  lastHour: 16,                 // last slot 4-5 PM (court closes 5:00 PM)
  slotMinutes: 60,
  maxPerDay: 1,
  maxPerWeek: 2,
  maxDaysAhead: 7,
  banDays: 14,
  storageKey: 'cui.futsal.v1',
  dataVersion: 1
};
