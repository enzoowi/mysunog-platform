import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ShieldAlert, Flame, LogIn, Eye, EyeOff, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function Login() {
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    // Forgot password state
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSubmitted, setForgotSubmitted] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const navigate = useNavigate();

    // OTP state
    const [showOtpScreen, setShowOtpScreen] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [pendingUserId, setPendingUserId] = useState<number | null>(null);

    async function handleLoginSuccess(token: string) {
        localStorage.setItem('token', token);
        const me = await api.get('/auth/me');
        if (me.data.role === 'admin' || me.data.role === 'bfp_staff' || me.data.role === 'fire_investigator') {
            navigate('/admin/dashboard', { replace: true });
        } else {
            navigate('/');
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password });
            
            if (res.data.requiresOtp) {
                setPendingUserId(res.data.userId);
                setShowOtpScreen(true);
            } else {
                await handleLoginSuccess(res.data.access_token);
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message;
            if (err.response?.status === 403) {
                setError('Your account has been deactivated. Please contact the BFP administrator.');
            } else {
                setError(msg || 'Authentication failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleForgotSubmit(e: React.FormEvent) {
        e.preventDefault();
        setForgotLoading(true);
        try {
            await api.post('/users/forgot-password', { email: forgotEmail });
            setForgotSubmitted(true);
        } catch {
            setForgotSubmitted(true); // Still show success to prevent email enumeration
        } finally {
            setForgotLoading(false);
        }
    }

    async function handleOtpSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/verify-otp', { userId: pendingUserId, code: otpCode });
            await handleLoginSuccess(res.data.access_token);
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message;
            setError(msg || 'Invalid or expired OTP code. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute inset-0 bg-slate-800 z-0">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500 via-red-900 to-transparent"></div>
            </div>

            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-2xl z-10 border border-gray-100 relative">
                <div className="flex flex-col items-center">
                    <div className="bg-orange-100 p-3 rounded-full mb-4">
                        <Flame className="w-10 h-10 text-orange-600" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                        {showOtpScreen ? 'Enter OTP' : isForgotPassword ? 'Reset Password' : 'Welcome Back'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {showOtpScreen
                            ? 'A 6-digit code has been sent to your registered mobile number.'
                            : isForgotPassword
                                ? 'Enter your email and an admin will send you a temporary password.'
                                : 'Sign in to access your dashboard.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {showOtpScreen ? (
                    <form className="mt-8 space-y-6" onSubmit={handleOtpSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit OTP Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                    className="appearance-none block w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold border border-gray-300 rounded-xl shadow-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                                    placeholder="••••••"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowOtpScreen(false); setOtpCode(''); setError(''); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 hover:underline font-medium transition mt-1"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otpCode.length !== 6}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Verifying...' : <><CheckCircle className="w-4 h-4 mr-2" /> Verify OTP</>}
                        </button>
                    </form>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors sm:text-sm"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-orange-500 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Forgot password link */}
                            {!isForgotPassword && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { setIsForgotPassword(true); setError(''); setForgotSubmitted(false); setForgotEmail(''); }}
                                        className="text-xs text-orange-600 hover:text-orange-700 hover:underline font-medium transition mt-1"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing in...' : <><LogIn className="w-4 h-4 mr-2" /> Sign In</>}
                        </button>
                    </form>
                )}

                {/* ── Forgot Password Panel ── */}
                {isForgotPassword && (
                    <div className="mt-4 border border-orange-200 bg-orange-50 rounded-xl p-5">
                        {!forgotSubmitted ? (
                            <form onSubmit={handleForgotSubmit} className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Mail className="w-5 h-5 text-orange-500" />
                                    <p className="font-semibold text-sm text-gray-800">Forgot your password?</p>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Enter the email address linked to your account. An administrator will review your request. Please contact your administrator to receive your temporary password.
                                </p>
                                <input
                                    type="email"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotPassword(false)}
                                        className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-1"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-60"
                                    >
                                        {forgotLoading ? 'Submitting...' : 'Submit Request'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="text-center py-2">
                                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                                <p className="font-semibold text-gray-800 mb-1">Request Submitted!</p>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    If your email is registered, your request has been logged. Please contact your administrator to receive your temporary password.
                                </p>
                                <button
                                    onClick={() => { setIsForgotPassword(false); setForgotSubmitted(false); }}
                                    className="mt-4 text-sm text-orange-600 hover:underline font-medium"
                                >
                                    ← Back to Sign In
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}