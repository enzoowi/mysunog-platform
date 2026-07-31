import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from './services/api';
import { Flame, Bell, LogOut, User, X, AlertTriangle, ChevronDown, Clock } from 'lucide-react';
import EmergencyRouteMap from './components/EmergencyRouteMap';

import Home from './pages/Home';
import ChatbotWidget from './components/ChatbotWidget';
import RequireRole from './components/RequireRole';
import bfpLogo from './assets/images/bfp-logo.jpg';

import Login from './pages/Login';
import Notifications from './pages/Notifications';
import IncidentCreate from './pages/IncidentCreate';
import IncidentList from './pages/IncidentList';
import IncidentDashboard from './pages/IncidentDashboard';
import IncidentMap from './pages/IncidentMap';
import AdminAlerts from './pages/AdminAlerts';
import AdminEducation from './pages/AdminEducation';
import Reports from './pages/Reports';
import AdminDashboard from './pages/AdminDashboard';
import AdminSiteImages from './pages/AdminSiteImages';
import AdminHotlines from './pages/AdminHotlines';
import AdminServices from './pages/AdminServices';
import AdminMapAssets from './pages/AdminMapAssets';
import AdminIncidentMap from './pages/AdminIncidentMap';
import AIDetection from './pages/AIDetection';
import DetectionMap from './pages/DetectionMap';
import FireRiskMap from './pages/FireRiskMap';
import ChangePassword from './pages/ChangePassword';
import AdminManageUsers from './pages/AdminManageUsers';
import AdminDeactivatedUsers from './pages/AdminDeactivatedUsers';
import AiIncidentDetail from './pages/AiIncidentDetail';

export default function App() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fireAlertToast, setFireAlertToast] = useState<{
    title: string;
    message: string;
    link?: string | null;
    detectionType?: string;
    confidence?: number;
    severity?: string;
    cameraSource?: string;
    latitude?: number;
    longitude?: number;
    rawDetections?: any[];
  } | null>(null);
  const [aiAdviceModal, setAiAdviceModal] = useState(false);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [aiAdviceContent, setAiAdviceContent] = useState('');
  const [aiAdviceContext, setAiAdviceContext] = useState<{ title: string; message: string; latitude?: number; longitude?: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const profileRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Ref that mirrors userRole state so the socket closure always reads the latest value
  const userRoleRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Request browser notification permission for admin/bfp_staff
  useEffect(() => {
    if ((userRole === 'admin' || userRole === 'bfp_staff' || userRole === 'fire_investigator') && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [userRole]);

  /** Send a browser-native notification + play alert sound so background tabs still alert. */
  const sendBrowserNotification = useCallback((title: string, body: string) => {
    // Native browser notification (works when tab is in background)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: '/bfp-logo.jpg',
          tag: 'fire-alert', // prevents duplicate notifications stacking
          requireInteraction: true,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* ignore mobile/permission errors */ }
    }
    // Audio alert beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => { osc.disconnect(); gain.disconnect(); ctx.close(); }, 500);
    } catch { /* AudioContext may not be available */ }
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll spy logic
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['alerts', 'education', 'services', 'map', 'hotlines'];
      let current = '';
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Adjust threshold based on typical header heights
          if (rect.top <= 200 && rect.bottom >= 200) {
            current = section;
          }
        }
      }
      if (current !== activeTab) setActiveTab(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // Scroll to hash when necessary
  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const id = location.hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          const y = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location]);

  const handleNavClick = (hash: string) => {
    setMenuOpen(false);
    if (location.pathname === '/') {
      const id = hash.replace('/#', '').replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        // add a small offset so it doesn't get covered by the sticky navbar
        const y = element.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    } else {
      navigate(hash);
    }
  };

  async function fetchUnreadCount() {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setUnreadCount(0); return; }
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch { setUnreadCount(0); }
  }

  async function fetchUserEmail() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUserEmail(null);
        setUserRole(null);
        userRoleRef.current = null;
        return;
      }
      const res = await api.get('/auth/me');
      setUserEmail(res.data.email);
      setUserRole(res.data.role);
      userRoleRef.current = res.data.role;
    } catch {
      setUserEmail(null);
      setUserRole(null);
      userRoleRef.current = null;
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setUserEmail(null);
    setUserRole(null);
    setUnreadCount(0);
    navigate('/login');
  }

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFireAlertToast(null);
  }, []);

  // ── Real-time notification socket ─────────────────────────────────────────
  // Depends on userRole so we only connect (and show toasts) once the role is
  // resolved. This prevents the stale-closure bug where userRoleRef was null.
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;
    const token = localStorage.getItem('token');
    if (!token || !userRole) return; // Wait until logged in AND role is known

    const socket = io(`${SOCKET_URL}/detection`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnectionDelay: 2000,
    });

    // Bump the bell counter instantly when a new AI notification is created
    socket.on('notification:new', () => {
      setUnreadCount((prev) => prev + 1);
    });

    // Show global fire alert toast for admin and BFP staff
    if (userRole === 'admin' || userRole === 'bfp_staff' || userRole === 'fire_investigator') {
      // Immediate real-time broadcast from AI background detection
      // This fires instantly when fire/smoke is confirmed on a camera,
      // even before the full incident pipeline completes.
      socket.on('detection:fire-alert', (alert: any) => {
        // Only notify when confidence is at or above 70%
        if ((alert.confidence || 0) < 0.70) return;
        const title = `🔥 ${(alert.detectionType || 'fire').toUpperCase()} DETECTED`;
        const message = `${alert.severity?.toUpperCase() || 'HIGH'} severity on camera "${alert.cameraSource || 'Unknown'}". Confidence: ${((alert.confidence || 0) * 100).toFixed(0)}%`;
        setFireAlertToast({
          title, message, link: null,
          detectionType: alert.detectionType,
          confidence: alert.confidence,
          severity: alert.severity,
          cameraSource: alert.cameraSource,
          latitude: alert.latitude,
          longitude: alert.longitude,
          rawDetections: alert.rawDetections,
        });
        sendBrowserNotification(title, message);
      });

      // Full AI incident created (after temporal tracking + severity engine)
      // This may arrive a few seconds after detection:fire-alert with richer data
      socket.on('ai_incident:new', (incident: any) => {
        // Only notify when confidence is at or above 70%
        if ((incident.detectionConfidence || 0) < 0.70) return;
        const title = `🔥 AI Detection: ${incident.priority || 'HIGH'} Priority`;
        const message = `${incident.detectionType || 'Fire/Smoke'} detected on camera "${incident.cameraName || incident.cameraId || 'Unknown'}".`;
        const link = incident.id ? `/admin/ai-incidents/${incident.id}` : null;
        setFireAlertToast({ title, message, link });
        sendBrowserNotification(title, message);
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [userRole, dismissToast, sendBrowserNotification]); // Re-run when role becomes known

  useEffect(() => { fetchUnreadCount(); fetchUserEmail(); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Global AI Fire Alert Toast ─────────────────────────────────── */}
      {fireAlertToast && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: '72px',
            right: '16px',
            zIndex: 9999,
            width: '340px',
            background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(153,27,27,0.45)',
            border: '1px solid #ef4444',
            padding: '0',
            overflow: 'hidden',
            animation: 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(60px); }
              to   { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          {/* Red top bar */}
          <div style={{ background: '#ef4444', height: '4px', width: '100%' }} />

          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              {/* Icon */}
              <div style={{
                flexShrink: 0,
                background: 'rgba(239,68,68,0.2)',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AlertTriangle style={{ color: '#fca5a5', width: '18px', height: '18px' }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#fff', lineHeight: '1.3' }}>
                  {fireAlertToast.title}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>
                  {fireAlertToast.message}
                </p>
              </div>

              {/* Close */}
              <button
                id="fire-alert-toast-close"
                onClick={dismissToast}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#fca5a5' }}
                aria-label="Dismiss alert"
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {fireAlertToast.link && (
                <button
                  id="fire-alert-toast-view"
                  onClick={() => { navigate(fireAlertToast.link!); dismissToast(); }}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: '7px',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Incident
                </button>
              )}
              <button
                id="fire-alert-toast-ai-advice"
                onClick={async () => {
                  const ctx = {
                    title: fireAlertToast.title,
                    message: fireAlertToast.message,
                    detectionType: fireAlertToast.detectionType,
                    confidence: fireAlertToast.confidence,
                    severity: fireAlertToast.severity,
                    cameraSource: fireAlertToast.cameraSource,
                    latitude: fireAlertToast.latitude,
                    longitude: fireAlertToast.longitude,
                    rawDetections: fireAlertToast.rawDetections,
                  };
                  setAiAdviceContext({ title: ctx.title, message: ctx.message, latitude: ctx.latitude, longitude: ctx.longitude });
                  setAiAdviceContent('');
                  setAiAdviceModal(true);
                  setAiAdviceLoading(true);
                  try {
                    const res = await api.post('/notifications/ai-advice-from-alert', ctx);
                    setAiAdviceContent(res.data.advice);
                  } catch {
                    setAiAdviceContent('Failed to load AI advice. Please try again.');
                  } finally {
                    setAiAdviceLoading(false);
                  }
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🤖 AI Advice
              </button>
              <button
                id="fire-alert-toast-dismiss"
                onClick={dismissToast}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fca5a5',
                  fontWeight: 600,
                  fontSize: '12px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Advice Modal ─────────────────────────────────────────── */}
      {aiAdviceModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', padding: '16px',
          }}
          onClick={() => setAiAdviceModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '700px',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #dc2626, #ea580c)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🤖</span>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>AI Tactical Advice</h2>
                </div>
                {aiAdviceContext && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.85 }}>
                    Based on: {aiAdviceContext.title}
                  </p>
                )}
              </div>
              <button onClick={() => setAiAdviceModal(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
                color: '#fff', fontSize: '18px', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {aiAdviceLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{
                    width: '40px', height: '40px', margin: '0 auto 16px',
                    border: '3px solid #ea580c', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>🔍 Analyzing detection data...</p>
                  <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>Generating tactical advice for your team</p>
                </div>
              ) : (
                <div>
                  {aiAdviceContext && (
                    <div style={{
                      background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                    }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detection Details</p>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.6 }}>{aiAdviceContext.message}</p>
                    </div>
                  )}
                  <div
                    style={{ fontSize: '14px', color: '#374151', lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{
                      __html: aiAdviceContent
                        .replace(/## (.*)/g, '<h3 style="margin:18px 0 8px;font-size:16px;font-weight:700;color:#111827;">$1</h3>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^\d+\.\s+(.*)/gm, '<li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.6;">$1</li>')
                        .replace(/^[-•]\s+(.*)/gm, '<li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.6;">$1</li>')
                        .replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>')
                    }}
                  />
                  {/* Emergency Route Map — always shown; uses camera GPS or defaults to Malvar centre */}
                  <EmergencyRouteMap
                    incidentLat={Number(aiAdviceContext?.latitude) || 14.043095}
                    incidentLng={Number(aiAdviceContext?.longitude) || 121.156819}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setAiAdviceModal(false)} style={{
                padding: '8px 20px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/" className="flex items-center gap-2 z-50">
              <img src={bfpLogo} alt="BFP Logo" className="w-8 h-8 rounded-full object-cover" />
              <Flame className="w-8 h-8 text-orange-600" />
              <span className="font-bold text-xl text-gray-800">mySunog</span>
            </Link>

            <div className={`${menuOpen ? 'block absolute top-16 left-0 right-0 bg-white border-b shadow-lg p-4' : 'hidden'} md:flex md:items-center md:mx-auto`}>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                {/* Public nav links */}
                <button onClick={() => handleNavClick('/#alerts')} className={`px-3 py-2 text-sm rounded-lg transition text-left font-medium ${activeTab === 'alerts' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'}`}>Alerts</button>
                <button onClick={() => handleNavClick('/#education')} className={`px-3 py-2 text-sm rounded-lg transition text-left font-medium ${activeTab === 'education' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'}`}>Education</button>
                <button onClick={() => handleNavClick('/#services')} className={`px-3 py-2 text-sm rounded-lg transition text-left font-medium ${activeTab === 'services' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'}`}>Services</button>
                <button onClick={() => handleNavClick('/#map')} className={`px-3 py-2 text-sm rounded-lg transition text-left font-medium ${activeTab === 'map' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'}`}>Map</button>
                <button onClick={() => handleNavClick('/#hotlines')} className={`px-3 py-2 text-sm rounded-lg transition text-left font-medium ${activeTab === 'hotlines' ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'}`}>Hotlines</button>

                <div className="hidden md:block w-px h-6 bg-gray-200 mx-2" />

                {/* Staff/Admin links */}
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-3 py-1 md:hidden mt-4">Account</span>
                {/* Dashboard — bfp_staff and admin */}
                {(userRole === 'admin' || userRole === 'bfp_staff' || userRole === 'fire_investigator') && (
                  <Link to="/admin/dashboard" className="px-3 py-2 text-sm text-orange-600 font-bold hover:bg-orange-50 rounded-lg transition" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                )}

                {!userEmail && (
                  <Link to="/login" className="px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition font-medium" onClick={() => setMenuOpen(false)}>Login</Link>
                )}
                {userEmail && (
                  <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-medium md:hidden flex items-center gap-1">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                )}
              </div>
            </div>

            {/* Always visible top-right section */}
            <div className="flex items-center gap-2 ml-auto z-50">
              {userEmail && (
                <div className="hidden md:flex items-center gap-2" ref={profileRef}>
                  {/* Clickable email pill */}
                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((p) => !p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 rounded-full border border-orange-100 transition cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-orange-600" />
                      <span className="text-xs font-medium text-orange-700 max-w-[180px] truncate" title={userEmail}>{userEmail}</span>
                      <ChevronDown className={`w-3 h-3 text-orange-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Profile dropdown */}
                    {profileOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 z-50">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-xs text-gray-400 font-medium">Signed in as</p>
                          <p className="text-xs font-semibold text-gray-700 truncate">{userEmail}</p>
                        </div>
                        <Link
                          to="/change-password"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition w-full"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Change Password
                        </Link>
                        <button
                          onClick={() => { setProfileOpen(false); handleLogout(); }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition w-full"
                        >
                          <LogOut className="w-4 h-4" /> Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {userEmail && (
                <div className="flex items-center gap-2">
                  <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 font-mono text-xs shadow-sm" title="Philippine Standard Time">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    {currentTime.toLocaleString('en-US', {
                      timeZone: 'Asia/Manila',
                      year: 'numeric', month: 'short', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      hour12: false
                    }).replace(',', '')}
                  </div>
                  <Link to="/notifications" className="p-2 relative text-gray-500 hover:text-orange-600 transition" title="Notifications" onClick={() => setMenuOpen(false)}>
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full font-bold px-1 border-2 border-white">{unreadCount}</span>
                    )}
                  </Link>
                </div>
              )}
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-600">
                <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Routes */}
      <main className="max-w-7xl mx-auto flex-1 w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Shared authenticated routes */}
          <Route path="/notifications" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><Notifications /></RequireRole>} />

          {/* Incident routes — bfp_staff and admin only */}
          <Route path="/incidents/create" element={<RequireRole allowedRoles={['fire_investigator']}><IncidentCreate /></RequireRole>} />
          <Route path="/incidents/list" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><IncidentList /></RequireRole>} />
          <Route path="/incidents/dashboard" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><IncidentDashboard /></RequireRole>} />
          <Route path="/incidents/map" element={<IncidentMap />} />

          {/* BFP Staff + Admin routes */}
          <Route path="/admin/dashboard" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><AdminDashboard /></RequireRole>} />
          <Route path="/admin/incident-map" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><AdminIncidentMap /></RequireRole>} />
          <Route path="/admin/ai-detection" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><AIDetection /></RequireRole>} />
          <Route path="/admin/detection-map" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><DetectionMap /></RequireRole>} />
          <Route path="/admin/fire-risk-map" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><FireRiskMap /></RequireRole>} />
          <Route path="/reports" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><Reports /></RequireRole>} />
          {/* AI Incident routes */}

          <Route path="/admin/ai-incidents/:id" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><AiIncidentDetail /></RequireRole>} />

          {/* Admin-only routes */}
          <Route path="/admin/alerts" element={<RequireRole allowedRoles={['admin']}><AdminAlerts /></RequireRole>} />
          <Route path="/admin/education" element={<RequireRole allowedRoles={['admin']}><AdminEducation /></RequireRole>} />
          <Route path="/admin/site-images" element={<RequireRole allowedRoles={['admin']}><AdminSiteImages /></RequireRole>} />
          <Route path="/admin/hotlines" element={<RequireRole allowedRoles={['admin']}><AdminHotlines /></RequireRole>} />
          <Route path="/admin/services" element={<RequireRole allowedRoles={['admin']}><AdminServices /></RequireRole>} />
          <Route path="/admin/map-assets" element={<RequireRole allowedRoles={['admin', 'bfp_staff', 'fire_investigator']}><AdminMapAssets /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole allowedRoles={['admin']}><AdminManageUsers /></RequireRole>} />
          <Route path="/admin/deactivated-users" element={<RequireRole allowedRoles={['admin']}><AdminDeactivatedUsers /></RequireRole>} />

          {/* All authenticated users */}
          <Route path="/change-password" element={<RequireRole allowedRoles={['bfp_staff', 'admin', 'fire_investigator']}><ChangePassword /></RequireRole>} />
        </Routes>
      </main>

      {/* Floating Chatbot Widget */}
      {(userRole === null || userRole === 'admin' || userRole === 'bfp_staff' || userRole === 'fire_investigator') && <ChatbotWidget />}
    </div>
  );
}