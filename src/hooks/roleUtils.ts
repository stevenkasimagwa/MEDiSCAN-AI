export function normalizeRole(role?: string | null) {
  if (!role) return null;
  return String(role).trim().toLowerCase();
}

// Be permissive: accept common admin variants and superadmin forms.
export function isAdmin(role?: string | null) {
  const r = normalizeRole(role);
  if (!r) return false;
  // common variants: 'admin', 'administrator', 'superadmin', 'super_admin', 'super-admin'
  return r === 'admin' || r === 'administrator' || r.includes('super') || r === 'root';
}

export function isDoctor(role?: string | null) {
  const r = normalizeRole(role);
  if (!r) return false;
  // accept 'doctor' and variants like 'physician'
  return r === 'doctor' || r.includes('doctor') || r.includes('physician');
}
