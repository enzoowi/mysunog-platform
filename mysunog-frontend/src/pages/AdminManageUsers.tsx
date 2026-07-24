import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Search, RefreshCw, KeyRound, AlertCircle,
  CheckCircle, XCircle, Shield, User, ChevronDown, UserX, Plus,
} from 'lucide-react';

type UserRecord = {
  id: number;
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: string;
  isVerified: boolean;
  isVolunteer: boolean;
  barangay?: string;
  phone?: string;
  passwordResetRequested: boolean;
  passwordResetRequestedAt?: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  bfp_staff: { label: 'BFP Staff', color: 'bg-orange-100 text-orange-700' },
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
};

export default function AdminManageUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filtered, setFiltered] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'bfp_staff',
  });

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get('/users/all');
      setUsers(res.data);
      setFiltered(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    let result = users;
    if (roleFilter !== 'all') result = result.filter((u) => u.role === roleFilter);
    if (verifiedFilter === 'verified') result = result.filter((u) => u.isVerified);
    if (verifiedFilter === 'unverified') result = result.filter((u) => !u.isVerified);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        u.email.toLowerCase().includes(q) ||
        `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q),
      );
    }
    setFiltered(result);
  }, [search, roleFilter, verifiedFilter, users]);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleResetPassword(user: UserRecord) {
    if (!window.confirm(`Reset password for ${user.email}? A temporary password will be emailed to them.`)) return;
    setResettingId(user.id);
    try {
      await api.post(`/users/${user.id}/reset-password`);
      showToast('success', `Temporary password sent to ${user.email}`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to reset password. Please try again.');
    } finally {
      setResettingId(null);
    }
  }

  async function handleDeactivate(user: UserRecord) {
    if (!window.confirm(`Deactivate account for ${user.email}? They will no longer be able to log in.`)) return;
    setDeactivatingId(user.id);
    try {
      await api.patch(`/users/${user.id}/deactivate`);
      showToast('success', `${user.email} has been deactivated.`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to deactivate account.');
    } finally {
      setDeactivatingId(null);
    }
  }

  async function handleRoleChange(user: UserRecord, newRole: string) {
    if (newRole === user.role) return;
    setUpdatingRoleId(user.id);
    try {
      await api.patch(`/users/${user.id}/role`, { role: newRole });
      showToast('success', `${user.email} is now ${ROLE_LABELS[newRole]?.label || newRole}`);
      fetchUsers();
    } catch {
      showToast('error', 'Failed to update role.');
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      await api.post('/users/admin-create', newUser);
      showToast('success', 'User created successfully');
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'bfp_staff' });
      fetchUsers();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  }

  const pendingResetCount = users.filter((u) => u.passwordResetRequested).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 p-2.5 rounded-xl">
            <Users className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Users</h2>
            <p className="text-sm text-gray-500">{users.length} active accounts</p>
          </div>
          {pendingResetCount > 0 && (
            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingResetCount} password reset request{pendingResetCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/deactivated-users"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 border rounded-lg px-4 py-2 transition hover:border-red-300"
          >
            <UserX className="w-4 h-4" /> Deactivated Accounts
          </Link>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 border rounded-lg px-4 py-2 transition hover:border-orange-300"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 text-sm text-white bg-orange-600 hover:bg-orange-700 rounded-lg px-4 py-2 transition"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        >
          <option value="all">All Roles</option>
          <option value="bfp_staff">BFP Staff</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          className="border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">Add New User</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                  <input required type="text" value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input required type="text" value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Temporary Password</label>
                <input required type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500">
                  <option value="bfp_staff">BFP Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={isCreating} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50">
                  {isCreating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <User className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500 uppercase text-xs tracking-wide">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Joined</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b last:border-0 hover:bg-gray-50 transition ${user.passwordResetRequested ? 'bg-amber-50' : ''}`}
                  >
                    {/* User info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                          {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {user.firstName || user.lastName
                              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                              : '—'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.passwordResetRequested && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium mt-0.5">
                              <AlertCircle className="w-3 h-3" /> Password reset requested
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role selector */}
                    <td className="px-4 py-4">
                      <div className="relative inline-flex items-center">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          disabled={updatingRoleId === user.id}
                          className={`appearance-none pr-7 pl-2 py-1.5 rounded-lg text-xs font-semibold border-0 outline-none cursor-pointer transition disabled:opacity-50 ${ROLE_LABELS[user.role]?.color || 'bg-gray-100 text-gray-700'}`}
                        >
                          <option value="bfp_staff">BFP Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 w-3 h-3 pointer-events-none opacity-60" />
                      </div>
                    </td>



                    {/* Joined date */}
                    <td className="px-4 py-4 text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={resettingId === user.id}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50 ${user.passwordResetRequested
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-700'
                            }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {resettingId === user.id ? 'Sending...' : 'Reset Password'}
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeactivate(user)}
                            disabled={deactivatingId === user.id}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition disabled:opacity-50"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            {deactivatingId === user.id ? 'Deactivating...' : 'Deactivate'}
                          </button>
                        )}
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
