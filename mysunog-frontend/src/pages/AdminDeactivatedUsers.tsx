import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, UserX, RefreshCw, UserCheck, Search,
  CheckCircle, XCircle, Trash2,
} from 'lucide-react';

type DeactivatedUser = {
  id: number;
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: string;
  isVerified: boolean;
  deactivatedAt?: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  citizen:   { label: 'Citizen',   color: 'bg-blue-100 text-blue-700' },
  bfp_staff: { label: 'BFP Staff', color: 'bg-orange-100 text-orange-700' },
  admin:     { label: 'Admin',     color: 'bg-red-100 text-red-700' },
  volunteer: { label: 'Volunteer', color: 'bg-green-100 text-green-700' },
};

export default function AdminDeactivatedUsers() {
  const [users, setUsers] = useState<DeactivatedUser[]>([]);
  const [filtered, setFiltered] = useState<DeactivatedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get('/users/deactivated');
      setUsers(res.data);
      setFiltered(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q),
    ));
  }, [search, users]);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleReactivate(user: DeactivatedUser) {
    if (!window.confirm(`Reactivate account for ${user.email}? They will be able to log in again.`)) return;
    setReactivatingId(user.id);
    try {
      await api.patch(`/users/${user.id}/reactivate`);
      showToast('success', `${user.email} has been reactivated.`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to reactivate account.');
    } finally {
      setReactivatingId(null);
    }
  }

  async function handleDelete(user: DeactivatedUser) {
    if (!window.confirm(`Are you sure you want to completely remove the account for ${user.email}? This action cannot be undone.`)) return;
    setDeletingId(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      showToast('success', `${user.email} has been permanently deleted.`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to delete account.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Manage Users
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 p-2.5 rounded-xl">
            <UserX className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Deactivated Accounts</h2>
            <p className="text-sm text-gray-500">{users.length} deactivated account{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 border rounded-lg px-4 py-2 transition hover:border-orange-300"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 border-2 border-dashed rounded-xl">
          <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No deactivated accounts</p>
          <p className="text-sm mt-1">All accounts are currently active.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wide">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Deactivated On</th>
                  <th className="px-4 py-3.5">Registered</th>
                  <th className="px-4 py-3.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-red-50/30 transition">
                    {/* User info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-sm flex-shrink-0">
                          {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">
                            {user.firstName || user.lastName
                              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                              : '—'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${ROLE_LABELS[user.role]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[user.role]?.label || user.role}
                      </span>
                    </td>

                    {/* Deactivated date */}
                    <td className="px-4 py-4 text-xs text-red-500 font-medium">
                      {user.deactivatedAt
                        ? new Date(user.deactivatedAt).toLocaleDateString('en-PH', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* Registered date */}
                    <td className="px-4 py-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>

                    {/* Reactivate and Delete */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReactivate(user)}
                          disabled={reactivatingId === user.id || deletingId === user.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {reactivatingId === user.id ? 'Reactivating...' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id || reactivatingId === user.id}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingId === user.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
