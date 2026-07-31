import { useEffect, useState } from 'react';
import { api } from '../services/api';

export type UserRole = 'bfp_staff' | 'fire_investigator' | 'admin' | null;

type AuthState = {
  role: UserRole;
  user: any;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  /** True for both bfp_staff, fire_investigator and admin — anyone who is BFP personnel */
  isBfpPersonnel: boolean;
};

export function useAuth(): AuthState {
  const [role, setRole] = useState<UserRole>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setRole(res.data.role as UserRole);
        setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setRole(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = role === 'admin';
  const isStaff = role === 'bfp_staff' || role === 'fire_investigator';
  const isBfpPersonnel = isAdmin || isStaff;

  return { role, user, loading, isAdmin, isStaff, isBfpPersonnel };
}
