/* ★ Edit departments / department heads / students here. Bookings are generated relative to "now" on first load (or after "Reset demo data"). */
(function () {
  const T = CUI.time;
  const DEPARTMENTS = [
    { id: 'd-cs', name: 'Computer Science', code: 'CS' },
    { id: 'd-ee', name: 'Electrical & Computer Engineering', code: 'ECE' },
    { id: 'd-mgt', name: 'Management Sciences', code: 'MGT' },
    { id: 'd-math', name: 'Mathematics', code: 'MATH' },
    { id: 'd-phy', name: 'Physics', code: 'PHY' }
  ];
  const HEADS = [
    ['h-cs', 'd-cs', 'Dr. Asad Mehmood'], ['h-ee', 'd-ee', 'Dr. Sana Iqbal'], ['h-mgt', 'd-mgt', 'Dr. Tariq Hussain'],
    ['h-math', 'd-math', 'Dr. Nadia Farooq'], ['h-phy', 'd-phy', 'Dr. Imran Shah']
  ];
  const STUDENTS = [
    ['s1', 'd-cs', 'Ali Raza', 'SP24-BCS-001'], ['s2', 'd-cs', 'Hamza Khan', 'SP24-BCS-014'], ['s3', 'd-cs', 'Ayesha Malik', 'SP24-BCS-027'],
    ['s4', 'd-ee', 'Usman Tariq', 'FA23-BEE-008'], ['s5', 'd-ee', 'Bilal Ahmed', 'FA23-BEE-019'], ['s6', 'd-ee', 'Maryam Noor', 'FA23-BEE-031'],
    ['s7', 'd-mgt', 'Zainab Fatima', 'SP24-BBA-005'], ['s8', 'd-mgt', 'Hassan Ali', 'SP24-BBA-016'], ['s9', 'd-mgt', 'Sara Yousaf', 'SP24-BBA-022'],
    ['s10', 'd-math', 'Omar Farooq', 'FA24-BSM-003'], ['s11', 'd-math', 'Hira Aslam', 'FA24-BSM-011'], ['s12', 'd-math', 'Daniyal Butt', 'FA24-BSM-020'],
    ['s13', 'd-phy', 'Faisal Mahmood', 'SP23-BPH-004'], ['s14', 'd-phy', 'Noor ul Ain', 'SP23-BPH-012'], ['s15', 'd-phy', 'Talha Javed', 'SP23-BPH-018']
  ];
  const slug = n => n.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

  function nextWeekday(date, n) { let d = date, left = n; while (left > 0) { d = T.addDays(d, 1); if (T.isOpenDay(d)) left--; } return d; }
  function prevWeekday(date, n) { let d = date, left = n; while (left > 0) { d = T.addDays(d, -1); if (T.isOpenDay(d)) left--; } return d; }

  CUI.seed = {
    DEPARTMENTS, HEADS, STUDENTS,
    build() {
      const now = T.nowMs(), today = T.todayPK(now);
      const users = [
        { id: 'sc1', role: 'SC_HEAD', name: 'Mr. Rashid Mehmood', email: 'sports.centre@university.example', departmentId: null },
        ...HEADS.map(([id, dep, name]) => ({ id, role: 'DEPT_HEAD', name, email: slug(name) + '@university.example', departmentId: dep })),
        ...STUDENTS.map(([id, dep, name, rollNo]) => ({ id, role: 'STUDENT', name, email: rollNo.toLowerCase() + '@student.example', departmentId: dep, rollNo }))
      ];
      const dep = id => users.find(u => u.id === id).departmentId;
      let n = 0;
      const mk = (studentId, date, hour, status, extra) => ({
        id: 'b' + (++n), ref: 'FC-' + (1000 + n), studentId, departmentId: dep(studentId), date, hour, status,
        createdAt: now - 3 * 3600000, deptDecision: null, scDecision: null, rejectedAt: null, ...extra
      });
      const dd = (by, at, reason) => ({ by, at, reason: reason || null });
      const f1 = nextWeekday(today, 1), f2 = nextWeekday(today, 2), f3 = nextWeekday(today, 3);
      const p1 = prevWeekday(today, 1), p2 = prevWeekday(today, 2), p3 = prevWeekday(today, 3);
      // Weekly-limit demo: s3 already has 2 bookings in one Mon-Fri week
      let base = nextWeekday(today, 1); if (T.dow(base) === 5) base = nextWeekday(base, 1);
      const bookings = [
        mk('s1', f1, 10, 'PENDING_DEPARTMENT'),
        mk('s2', f2, 11, 'PENDING_DEPARTMENT'),
        mk('s4', f1, 12, 'PENDING_SPORTS_CENTRE', { deptDecision: dd('h-ee', now - 3600000) }),
        mk('s7', f1, 9, 'CONFIRMED', { deptDecision: dd('h-mgt', now - 7200000), scDecision: dd('sc1', now - 3600000) }),
        mk('s5', p1, 14, 'CONFIRMED', { deptDecision: dd('h-ee', now - 9e7), scDecision: dd('sc1', now - 8e7) }),          // past confirmed -> no-show demo
        mk('s6', p2, 15, 'CONFIRMED', { deptDecision: dd('h-ee', now - 2e8), scDecision: dd('sc1', now - 19e7) }),         // past confirmed (attended)
        mk('s8', f3, 13, 'REJECTED', { deptDecision: dd('h-mgt', now - 3600000, 'Slot reserved for departmental practice.'), rejectedAt: 'DEPARTMENT' }),
        mk('s10', f2, 14, 'REJECTED', { deptDecision: dd('h-math', now - 7200000), scDecision: dd('sc1', now - 3600000, 'Court needed for maintenance.'), rejectedAt: 'SPORTS_CENTRE' }),
        mk('s11', p3, 10, 'EXPIRED', { expiredAt: now - 2e8 }),
        mk('s13', p3, 16, 'NO_SHOW', { deptDecision: dd('h-phy', now - 4e8), scDecision: dd('sc1', now - 39e7), noShowMarkedAt: now - 2 * 86400000 }),
        mk('s3', base, 15, 'PENDING_DEPARTMENT'),
        mk('s3', T.addDays(base, 1), 16, 'CONFIRMED', { deptDecision: dd('h-cs', now - 7200000), scDecision: dd('sc1', now - 3600000) })
      ];
      const bans = [{ id: 'ban1', studentId: 's13', bookingId: bookings.find(b => b.status === 'NO_SHOW').id, startsAt: now - 2 * 86400000, endsAt: now - 2 * 86400000 + CUI.config.banDays * 86400000 }];
      return { version: CUI.config.dataVersion, seededAt: now, departments: DEPARTMENTS.map(d => ({ ...d })), users, bookings, bans, blocks: [], audit: [], counters: { booking: n + 1000, ban: 2, dept: 100, user: 100 } };
    }
  };
})();
