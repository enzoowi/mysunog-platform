import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { ArrowLeft, KeyRound, Eye, EyeOff, CheckCircle, ShieldAlert } from 'lucide-react';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/users/change-password', { currentPassword, newPassword });
      setSuccess('Password changed successfully! Please use your new password next time you log in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(msg || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strengthScore = (() => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strengthScore];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500', 'bg-emerald-500'][strengthScore];

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="bg-white border rounded-2xl shadow-sm p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-orange-100 p-2.5 rounded-xl">
            <KeyRound className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-500">Keep your account secure with a strong password</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3 mb-5">
            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg flex items-start gap-3 mb-5">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700 font-medium">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                placeholder="Enter your current password"
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-orange-500 transition">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                placeholder="At least 8 characters"
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowNew((p) => !p)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-orange-500 transition">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strengthScore ? strengthColor : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">Strength: <span className="font-medium">{strengthLabel}</span></p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 pr-11 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-400 focus:border-red-400'
                    : 'border-gray-300 focus:border-orange-500'
                }`}
                placeholder="Re-enter your new password"
              />
              <button type="button" tabIndex={-1}
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-orange-500 transition">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Changing...' : <><KeyRound className="w-4 h-4" /> Change Password</>}
          </button>
        </form>

        {/* Tips */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Password Tips</p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Use at least 8 characters</li>
            <li>• Mix uppercase, lowercase, numbers, and symbols</li>
            <li>• Avoid using your name or birthday</li>
            <li>• Don't reuse passwords from other accounts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
