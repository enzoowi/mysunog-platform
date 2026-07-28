import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserCheck, Eye, X, CheckCircle, ChevronDown } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

type PendingUser = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  residencyProofUrl?: string;
  createdAt: string;
  role: string;
};

export default function AdminVerifications() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [approving, setApproving] = useState<number | null>(null);
  // Track selected role per user (defaults to 'citizen')
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});

  async function fetchPending() {
    try {
      setLoading(true);
      const res = await api.get('/users/pending');
      setUsers(res.data);
      // Initialize each user's role selection to 'citizen'
      const defaultRoles: Record<number, string> = {};
      res.data.forEach((u: PendingUser) => { defaultRoles[u.id] = 'citizen'; });
      setSelectedRoles(defaultRoles);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchPending(); }, []);

  async function handleApprove(id: number) {
    setApproving(id);
    try {
      // If the selected role differs from citizen, update role first
      const chosenRole = selectedRoles[id] || 'citizen';
      if (chosenRole !== 'citizen') {
        await api.patch(`/users/${id}/role`, { role: chosenRole });
      }
      await api.patch(`/users/${id}/verify`);
      await fetchPending();
    } catch (err) { console.error(err); alert('Failed to approve user.'); }
    finally { setApproving(null); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-800">Account Verification Queue</h2>
        {users.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
            {users.length} pending
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Review the government IDs submitted by citizens registering for mySunog. Approve accounts to grant login access.
      </p>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {!loading && users.length === 0 && (
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-gray-400">
          <UserCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No pending registrations</p>
          <p className="text-sm mt-1">All citizen accounts have been verified.</p>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-white border rounded-xl p-5 shadow-sm flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {/* ID thumbnail */}
              <div className="flex-shrink-0">
                {u.residencyProofUrl ? (
                  <button
                    onClick={() => setLightboxUrl(u.residencyProofUrl?.startsWith('http') ? u.residencyProofUrl : `${BACKEND_URL}${u.residencyProofUrl}`)}
                    className="relative group block rounded-lg overflow-hidden border w-20 h-20"
                    title="View ID">
                    <img
                      src={u.residencyProofUrl?.startsWith('http') ? u.residencyProofUrl : `${BACKEND_URL}${u.residencyProofUrl}`}
                      alt="Government ID"
                      className="w-full h-full object-cover group-hover:opacity-80 transition"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition">
                      <Eye className="w-5 h-5 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="w-20 h-20 rounded-lg border bg-gray-100 flex items-center justify-center text-gray-400 text-xs text-center p-1">
                    No ID
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">
                  {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email}
                </p>
                <p className="text-xs text-gray-500 mt-1">{u.email}</p>
                <p className="text-xs text-gray-500 mt-1">Role: {u.role}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Registered: {new Date(u.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Approve section with role selector */}
            <div className="flex flex-col gap-2 self-center">
              {/* Role selector */}
              <div className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none absolute ml-2" />
                <select
                  value={selectedRoles[u.id] || 'citizen'}
                  onChange={(e) => setSelectedRoles((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  disabled={approving === u.id}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-orange-300 focus:outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="citizen">Citizen</option>
                  <option value="bfp_staff">BFP Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={() => handleApprove(u.id)}
                disabled={approving === u.id}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50">
                {approving === u.id ? 'Approving...' : <><CheckCircle className="w-4 h-4" /> Approve</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ID Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <button
            onClick={e => { e.stopPropagation(); setLightboxUrl(null); }}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full transition text-white">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="Government ID fullview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
