/* Departments, department heads, users. */
(function () {
  const K = CUI.core, SE = K.ServiceError;

  CUI.directoryService = {
    async listDepartments() {
      const { state } = K.read();
      return state.departments.map(d => {
        const head = state.users.find(u => u.role === 'DEPT_HEAD' && u.departmentId === d.id) || null;
        return { ...d, head, studentCount: state.users.filter(u => u.role === 'STUDENT' && u.departmentId === d.id).length };
      });
    },
    async listUsers(role) { const { state } = K.read(); return state.users.filter(u => !role || u.role === role).map(u => ({ ...u })); },
    async getUser(id) { const { state } = K.read(); const u = K.userOf(state, id); return u ? { ...u, department: K.deptOf(state, u.departmentId) } : null; },

    async saveDepartment(actorId, { id, name, code }) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      name = (name || '').trim(); code = (code || '').trim().toUpperCase();
      if (!name || !code) throw new SE('VALIDATION', 'Department name and code are required.');
      if (state.departments.some(d => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) throw new SE('DUPLICATE', 'A department with this name already exists.');
      if (id) { const d = K.deptOf(state, id); d.name = name; d.code = code; K.audit(state, actorId, 'DEPT_EDITED', `Edited department ${name}`); }
      else { state.departments.push({ id: K.nextId(state, 'dept', 'd-'), name, code }); K.audit(state, actorId, 'DEPT_ADDED', `Added department ${name}`); }
      K.write(state);
    },
    async deleteDepartment(actorId, id) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      if (state.users.some(u => u.role === 'STUDENT' && u.departmentId === id)) throw new SE('IN_USE', 'This department still has students and cannot be deleted.');
      if (state.bookings.some(b => b.departmentId === id)) throw new SE('IN_USE', 'This department has booking history and cannot be deleted.');
      K.audit(state, actorId, 'DEPT_DELETED', `Deleted department ${(K.deptOf(state, id) || {}).name}`);
      state.departments = state.departments.filter(d => d.id !== id);
      state.users = state.users.filter(u => !(u.role === 'DEPT_HEAD' && u.departmentId === id));
      K.write(state);
    },
    /** Assign or replace the (single) sports head of a department. */
    async setDepartmentHead(actorId, departmentId, { name, email }) {
      const { state } = K.read();
      K.requireRole(state, actorId, 'SC_HEAD');
      name = (name || '').trim(); email = (email || '').trim();
      if (!name) throw new SE('VALIDATION', 'Head name is required.');
      let head = state.users.find(u => u.role === 'DEPT_HEAD' && u.departmentId === departmentId);
      if (head) { head.name = name; head.email = email; }
      else state.users.push({ id: K.nextId(state, 'user', 'h-'), role: 'DEPT_HEAD', name, email, departmentId });
      K.audit(state, actorId, 'HEAD_SET', `Set sports head of ${(K.deptOf(state, departmentId) || {}).name} to ${name}`);
      K.write(state);
    }
  };
})();
