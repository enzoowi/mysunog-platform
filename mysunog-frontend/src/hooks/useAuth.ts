import { useEffect, useState } from 'react';
import { api } from '../services/api';

export type UserRole = 'bfp_staff' | 'admin' | null;

type AuthState = {
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  /** True for both bfp_staff and admin — anyone who is BFP personnel */
  isBfpPersonnel: boolean;
};

export function useAuth(): AuthState {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setRole(res.data.role as UserRole))
      .catch(() => {
        localStorage.removeItem('token');
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = role === 'admin';
  const isStaff = role === 'bfp_staff';
  const isBfpPersonnel = isAdmin || isStaff;

  return { role, loading, isAdmin, isStaff, isBfpPersonnel };
}
