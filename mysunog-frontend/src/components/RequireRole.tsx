import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { UserRole } from '../hooks/useAuth';

type Props = {
  /** Roles that are allowed to view this page */
  allowedRoles: UserRole[];
  children: React.ReactNode;
  /** Where to redirect unauthorized users (default: '/') */
  redirectTo?: string;
};

/**
 * Wrap a page component with RequireRole to enforce role-based access.
 * Redirects to `redirectTo` if the current user's role is not in `allowedRoles`.
 *
 * @example
 * <RequireRole allowedRoles={['bfp_staff', 'admin']}>
 *   <Reports />
 * </RequireRole>
 */
export default function RequireRole({ allowedRoles, children, redirectTo = '/' }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate(redirectTo, { replace: true });
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        const role: UserRole = res.data.role;
        if (allowedRoles.includes(role)) {
          setAuthorized(true);
        } else {
          navigate(redirectTo, { replace: true });
        }
      })
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
