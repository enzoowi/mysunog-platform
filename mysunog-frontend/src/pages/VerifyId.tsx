import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Flame, Upload, CheckCircle, ShieldAlert } from 'lucide-react';

export default function VerifyId() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';

  const [idFile, setIdFile] = useState<File | null>(null);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idFile) { setError('Please select your government ID image.'); return; }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('firstName', firstName);
      if (middleName) formData.append('middleName', middleName);
      formData.append('lastName', lastName);
      formData.append('idFile', idFile);
      await api.post('/auth/complete-google-registration', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit ID. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ID Submitted!</h2>
          <p className="text-gray-600 mb-4">
            Your government ID has been received. A BFP administrator will review your registration and approve your account shortly.
          </p>
          <p className="text-sm text-gray-400 mb-6">You will be able to log in once your account has been verified.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold transition">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-orange-100 p-3 rounded-full mb-3">
            <Flame className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 text-center">Verify Your Residency</h2>
          <p className="text-sm text-gray-500 text-center mt-2">
            mySunog is exclusively for residents of Malvar, Batangas. Please upload a valid government ID showing your address.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm text-blue-700">
          Signing in as: <strong>{email}</strong>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border-l-4 border-red-500 p-3 rounded-md mb-4">
            <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="appearance-none block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
                placeholder="Juan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="appearance-none block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
                placeholder="Dela Cruz"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name <span className="text-gray-400 text-xs font-normal">(Optional)</span></label>
            <input
              type="text"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className="appearance-none block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
              placeholder="Santos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Government ID <span className="text-red-500">*</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:bg-gray-50 transition">
              {preview ? (
                <img src={preview} alt="ID Preview" className="max-h-40 object-contain rounded-lg border" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Click to upload your government ID</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, or PDF accepted</p>
                </>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {idFile && (
              <p className="text-xs text-green-700 mt-2 font-medium">✓ {idFile.name} selected</p>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Accepted IDs: PhilSys ID, Postal ID, Voter's ID, Driver's License, Barangay certificate, or any government-issued ID with your Malvar address.
          </p>

          <button
            type="submit"
            disabled={loading || !idFile}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
}
