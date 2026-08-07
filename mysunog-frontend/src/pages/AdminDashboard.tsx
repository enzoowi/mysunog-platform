import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Flame, Coins, BarChart2, UserX, Hospital, Timer,
  BellRing, BookOpen, ShieldCheck,
  Users, Image as ImageIcon, MapPin, PhoneCall, LineChart,
  Shield, Clock, Target, Activity, AlertTriangle, TrendingUp, Home, Map, Eye
} from 'lucide-react';

type DashboardSummary = {
  totalIncidents: number;
  totalEstimatedDamage: number;
  totalCasualties: number;
  totalInjuries: number;
  avgDamagePerIncident: number;
  barangayCounts: Record<string, number>;
  causeCounts: Record<string, number>;
  propertyCounts: Record<string, number>;
  monthlyCounts: Record<string, number>;
  dayOfWeekCounts: Record<string, number>;
  timeOfDayCounts: Record<string, number>;
  damageSeverity: Record<string, number>;
  thisYearCount: number;
  lastYearCount: number;
};

type ResponsePerf = {
  totalWithResponseData: number;
  avgResponseTimeMinutes: number;
  recentIncidents: Array<{
    id: number; barangay: string; date: string;
    alarmTime?: string; responseTime?: string; controlTime?: string; fireOutTime?: string;
  }>;
};

type Period = 'weekly' | 'monthly' | 'annually';

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Past 7 Days',
  monthly: 'Past 30 Days',
  annually: `Year ${new Date().getFullYear()}`,
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [responsePerf, setResponsePerf] = useState<ResponsePerf | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [period, setPeriod] = useState<Period>('annually');
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check if user is admin or bfp_staff
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    api.get('/auth/me')
      .then((res) => {
        const role = res.data.role;
        if (role === 'admin' || role === 'bfp_staff' || role === 'fire_investigator') {
          setUserRole(role);
          setAuthorized(true);
        } else {
          alert('Access denied. Only BFP personnel can view the admin dashboard.');
          navigate('/', { replace: true });
        }
      })
      .catch(() => {
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  useEffect(() => {
    if (!authorized) return;
    // Initial load: fetch both summary and response performance
    Promise.all([
      api.get(`/incidents/dashboard-summary?period=${period}`),
      api.get('/incidents/response-performance'),
    ])
      .then(([summaryRes, perfRes]) => {
        setSummary(summaryRes.data);
        setResponsePerf(perfRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [authorized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch summary when period changes (after initial load)
  useEffect(() => {
    if (!authorized || loading) return;
    setStatsLoading(true);
    api.get(`/incidents/dashboard-summary?period=${period}`)
      .then((res) => setSummary(res.data))
      .catch((err) => console.error(err))
      .finally(() => setStatsLoading(false));
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-6">Loading admin dashboard...</div>;

  const cards = [
    { label: 'Total Incidents', value: summary?.totalIncidents || 0, color: 'bg-red-500', icon: <Flame className="w-8 h-8" /> },
    { label: 'Est. Damage', value: `₱${(summary?.totalEstimatedDamage || 0).toLocaleString()}`, color: 'bg-orange-500', icon: <Coins className="w-8 h-8" /> },
    { label: 'Avg Damage/Incident', value: `₱${(summary?.avgDamagePerIncident || 0).toLocaleString()}`, color: 'bg-amber-600', icon: <BarChart2 className="w-8 h-8" /> },
    { label: 'Casualties', value: summary?.totalCasualties || 0, color: 'bg-gray-700', icon: <UserX className="w-8 h-8" /> },
    { label: 'Injuries', value: summary?.totalInjuries || 0, color: 'bg-yellow-500', icon: <Hospital className="w-8 h-8" /> },
    { label: 'Avg Response', value: `${responsePerf?.avgResponseTimeMinutes || 0} min`, color: 'bg-blue-500', icon: <Timer className="w-8 h-8" /> },
  ];

  const adminLinks = [
    { label: 'Manage Alerts',       path: '/admin/alerts',       icon: <BellRing className="w-6 h-6" />,     adminOnly: true },
    { label: 'Manage Education',     path: '/admin/education',    icon: <BookOpen className="w-6 h-6" />,     adminOnly: true },
    { label: 'Manage Services',      path: '/admin/services',     icon: <ShieldCheck className="w-6 h-6" />,  adminOnly: true },
    { label: 'Incident & Risk Map',  path: '/admin/incident-map', icon: <Map className="w-6 h-6" />,          adminOnly: false },
    { label: 'Map Assets',           path: '/admin/map-assets',   icon: <MapPin className="w-6 h-6" />,       adminOnly: false },
    { label: 'Manage Hotlines',      path: '/admin/hotlines',     icon: <PhoneCall className="w-6 h-6" />,    adminOnly: true },
    { label: 'Manage Users',         path: '/admin/users',        icon: <Users className="w-6 h-6" />,        adminOnly: true },
    { label: 'Reports & Export',     path: '/reports',            icon: <LineChart className="w-6 h-6" />,    adminOnly: false },
  ];

  const visibleLinks = userRole === 'admin'
    ? adminLinks
    : adminLinks.filter((l) => !l.adminOnly);

  const severityColors: Record<string, string> = {
    'Minor (<₱10k)': 'bg-green-100 text-green-700 border-green-200',
    'Moderate (₱10k-₱100k)': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Major (₱100k-₱500k)': 'bg-orange-100 text-orange-700 border-orange-200',
    'Catastrophic (≥₱500k)': 'bg-red-100 text-red-700 border-red-200',
  };

  const MONTH_NAMES: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-8 h-8 text-orange-600" /> BFP Admin Dashboard
        </h2>
        {/* Role badge */}
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
          userRole === 'admin'
            ? 'bg-red-100 text-red-700'
            : userRole === 'fire_investigator'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {userRole === 'admin' ? '🔴 Super Admin' : userRole === 'fire_investigator' ? '🔥 Fire Investigator' : '🔵 BFP Staff'}
        </span>
      </div>

      {/* Period Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <span className="text-sm font-medium text-gray-500">Statistics Period:</span>
        <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {(['weekly', 'monthly', 'annually'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
                period === p
                  ? 'bg-orange-500 text-white shadow-inner'
                  : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600'
              }`}
            >
              {p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Annually'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 italic">
          {statsLoading ? 'Updating...' : `Showing data for: ${PERIOD_LABELS[period]}`}
        </span>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 transition-opacity duration-300 ${statsLoading ? 'opacity-50' : 'opacity-100'}`}>
        {cards.map((card) => (
          <div key={card.label} className={`${card.color} text-white rounded-xl p-5 shadow-lg`}>
            <div className="mb-2 opacity-90">{card.icon}</div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Year-Over-Year Comparison */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border rounded-xl p-5 flex items-center gap-4">
            <div className="bg-blue-100 text-blue-700 rounded-full w-14 h-14 flex items-center justify-center text-2xl font-bold">
              {summary.thisYearCount}
            </div>
            <div>
              <p className="font-semibold text-gray-800">This Year ({new Date().getFullYear()})</p>
              <p className="text-sm text-gray-500">Incidents recorded</p>
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 flex items-center gap-4">
            <div className="bg-gray-100 text-gray-700 rounded-full w-14 h-14 flex items-center justify-center text-2xl font-bold">
              {summary.lastYearCount}
            </div>
            <div>
              <p className="font-semibold text-gray-800">Last Year ({new Date().getFullYear() - 1})</p>
              <p className="text-sm text-gray-500">Incidents recorded</p>
              {summary.lastYearCount > 0 && (
                <p className={`text-xs font-medium ${summary.thisYearCount > summary.lastYearCount ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.thisYearCount > summary.lastYearCount ? '↑' : '↓'} {Math.abs(Math.round(((summary.thisYearCount - summary.lastYearCount) / summary.lastYearCount) * 100))}% vs last year
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-700">Quick Actions</h3>
      </div>

      <div className="mb-6 space-y-4">
        {/* Massive AI Detection Highlight */}
        <Link to="/admin/ai-detection" className="flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-800 text-white rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all w-full relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm shadow-inner">
              <Eye className="w-10 h-10 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">AI Fire & Smoke Detection</h3>
              <p className="text-purple-100 font-medium mt-1">Real-time CCTV monitoring and instant automated alerts.</p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 bg-white text-purple-800 px-6 py-3 rounded-full font-bold shadow-md hover:bg-gray-50 transition relative z-10">
            Open Control Center &rarr;
          </div>
        </Link>

        {/* Create Incident Report (Only for Fire Investigators) */}
        {userRole === 'fire_investigator' && (
          <Link to="/incidents/create" className="flex items-center justify-center gap-3 bg-red-600 text-white rounded-xl px-5 py-4 shadow-md hover:bg-red-700 transition w-full text-lg font-bold tracking-wide border border-red-500">
            <Flame className="w-6 h-6" /> Create Incident Report
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {visibleLinks.map((link) => (
          <Link key={link.path} to={link.path}
            className="flex items-center gap-3 bg-white border rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:border-orange-300 transition group">
            <span className="text-gray-400 group-hover:text-orange-500 transition-colors">{link.icon}</span>
            <span className="font-medium text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Time of Day & Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Time of Day */}
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" /> Incidents by Time of Day
          </h3>
          {summary && Object.entries(summary.timeOfDayCounts).map(([period, count]) => {
            const maxCount = Math.max(...Object.values(summary.timeOfDayCounts), 1);
            const widthPct = (count / maxCount) * 100;
            return (
              <div key={period} className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>{period}</span>
                  <span className="font-medium text-gray-800">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-orange-400 rounded-full h-3 transition-all" style={{ width: `${Math.max(widthPct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Readiness Insights */}
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-400" /> Operational Readiness Insights
          </h3>
          {summary && (() => {
            const peakTime = Object.entries(summary.timeOfDayCounts).sort(([, a], [, b]) => b - a)[0];
            const topBarangay = Object.entries(summary.barangayCounts).sort(([, a], [, b]) => b - a)[0];
            const topCause = Object.entries(summary.causeCounts).sort(([, a], [, b]) => b - a)[0];
            const totalIncidents = summary.totalIncidents || 1;
            return (
              <div className="space-y-4">
                {/* Peak Danger Period */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-bold text-red-800">Peak Danger Period</span>
                  </div>
                  <p className="text-sm text-red-700 font-medium">{peakTime?.[0] || 'N/A'}</p>
                  <p className="text-xs text-red-600 mt-1">
                    {peakTime ? `${peakTime[1]} incidents (${Math.round((peakTime[1] / totalIncidents) * 100)}% of all fires)` : 'No data'}
                  </p>
                  <p className="text-xs text-red-500 mt-1 italic">⚡ Recommend increased staffing during this window</p>
                </div>

                {/* Highest Risk Area */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-bold text-orange-800">Highest Risk Barangay</span>
                  </div>
                  <p className="text-sm text-orange-700 font-medium">Brgy. {topBarangay?.[0] || 'N/A'}</p>
                  <p className="text-xs text-orange-600 mt-1">
                    {topBarangay ? `${topBarangay[1]} incidents recorded` : 'No data'}
                  </p>
                  <p className="text-xs text-orange-500 mt-1 italic">🚒 Prioritize patrols and hydrant checks in this area</p>
                </div>

                {/* Top Fire Cause */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">#1 Fire Cause</span>
                  </div>
                  <p className="text-sm text-amber-700 font-medium">{topCause?.[0] || 'N/A'}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    {topCause ? `${topCause[1]} incidents (${Math.round((topCause[1] / totalIncidents) * 100)}% of fires)` : 'No data'}
                  </p>
                  <p className="text-xs text-amber-500 mt-1 italic">📢 Focus prevention campaigns on this cause</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Damage Severity Distribution */}
      <div className="bg-white border rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-400" /> Damage Severity Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary && Object.entries(summary.damageSeverity).map(([level, count]) => (
            <div key={level} className={`border rounded-lg p-4 text-center ${severityColors[level] || 'bg-gray-50'}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium mt-1">{level}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Barangay Incidents & Causes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Incidents by Barangay</h3>
          {summary && Object.entries(summary.barangayCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([barangay, count]) => (
              <div key={barangay} className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">{barangay}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-red-400 rounded" style={{ width: `${Math.min(count * 20, 120)}px` }} />
                  <span className="text-sm font-medium text-gray-800">{count}</span>
                </div>
              </div>
            ))}
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Pie: Incidents by Cause</h3>
          {summary && Object.keys(summary.causeCounts).length > 0 ? (
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(summary.causeCounts).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {Object.entries(summary.causeCounts).map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#f97316', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6', '#10b981'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip wrapperClassName="text-sm rounded-lg shadow-xl border-0 !bg-white" />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-4">No data yet.</p>
          )}
        </div>
      </div>

      {/* Property Type Breakdown */}
      <div className="bg-white border rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Home className="w-5 h-5 text-gray-400" /> Incidents by Property Type
        </h3>
        {summary && Object.keys(summary.propertyCounts).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.propertyCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="border border-gray-200 rounded-lg p-3 text-center bg-gray-50">
                  <p className="text-xl font-bold text-gray-800">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{type}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No property type data yet.</p>
        )}
      </div>

      {/* Monthly Trends */}
      <div className="bg-white border rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400" /> Monthly Incident Trends
        </h3>
        {summary && Object.keys(summary.monthlyCounts).length > 0 ? (() => {
          const chartData = Object.entries(summary.monthlyCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([month, count]) => ({
              month: `${MONTH_NAMES[month.substring(5)] || month.substring(5)} ${month.substring(2, 4)}`,
              incidents: count,
            }));
          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    formatter={(value: any) => [`${value} incident${value !== 1 ? 's' : ''}`, 'Fires']}
                  />
                  <Bar dataKey="incidents" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })() : (
          <p className="text-sm text-gray-400">No monthly data yet.</p>
        )}
      </div>

      {/* Response Performance */}
      {responsePerf && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Response Performance</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{responsePerf.avgResponseTimeMinutes} min</p>
              <p className="text-sm text-blue-600">Avg Response Time</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{responsePerf.totalWithResponseData}</p>
              <p className="text-sm text-blue-600">Incidents with Response Data</p>
            </div>
          </div>
          {responsePerf.recentIncidents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2">ID</th>
                    <th>Barangay</th>
                    <th>Date</th>
                    <th>Alarm</th>
                    <th>Response</th>
                    <th>Control</th>
                    <th>Fire Out</th>
                  </tr>
                </thead>
                <tbody>
                  {responsePerf.recentIncidents.map((i) => (
                    <tr key={i.id} className="border-b border-gray-100">
                      <td className="py-2">{i.id}</td>
                      <td>{i.barangay}</td>
                      <td>{i.date}</td>
                      <td>{i.alarmTime || '-'}</td>
                      <td>{i.responseTime || '-'}</td>
                      <td>{i.controlTime || '-'}</td>
                      <td>{i.fireOutTime || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
