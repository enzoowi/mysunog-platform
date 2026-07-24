import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Flame, Bell, Zap, Droplets, Megaphone, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

type AlertItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  targetBarangay?: string;
  isActive: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  fire_risk: <Flame className="w-6 h-6 text-red-500" />,
  drill: <Bell className="w-6 h-6 text-blue-500" />,
  power_outage: <Zap className="w-6 h-6 text-yellow-500" />,
  lpg_safety: <Droplets className="w-6 h-6 text-orange-500" />,
  general: <Megaphone className="w-6 h-6 text-purple-500" />,
};

const TYPE_STYLES: Record<string, { bg: string, border: string, badge: string, iconBg: string }> = {
  fire_risk: { bg: 'bg-red-50/80', border: 'border-red-200', badge: 'bg-red-100 text-red-700', iconBg: 'bg-red-100' },
  drill: { bg: 'bg-blue-50/80', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-100' },
  power_outage: { bg: 'bg-yellow-50/80', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', iconBg: 'bg-yellow-100' },
  lpg_safety: { bg: 'bg-orange-50/80', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', iconBg: 'bg-orange-100' },
  general: { bg: 'bg-purple-50/80', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', iconBg: 'bg-purple-100' },
};

const TYPE_LABELS: Record<string, string> = {
  fire_risk: 'Fire Risk',
  drill: 'Drill',
  power_outage: 'Power Outage',
  lpg_safety: 'LPG Safety',
  general: 'General',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/alerts/active')
      .then((res) => setAlerts(res.data))
      .catch((err) => { console.error(err); alert('Failed to load alerts.'); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> Live Updates
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Fire Safety Alerts & Advisories</h2>
          <p className="text-gray-500 mt-2 text-lg">Stay informed with the latest critical alerts from BFP Malvar.</p>
        </div>
        {!loading && alerts.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-sm font-bold text-red-700">{alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-40 rounded-2xl"></div>
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-3xl p-10 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-green-800 mb-2">All Clear</h3>
          <p className="text-green-600 font-medium">There are no active alerts or advisories in Malvar at this time.</p>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {alerts.map((a) => {
            const style = TYPE_STYLES[a.type] || TYPE_STYLES.general;
            const icon = TYPE_ICONS[a.type] || TYPE_ICONS.general;
            const label = TYPE_LABELS[a.type] || 'Alert';
            
            return (
              <div 
                key={a.id} 
                className={`group relative overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border backdrop-blur-sm ${style.bg} ${style.border}`}
              >
                {/* Decorative background circle */}
                <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-50 blur-3xl ${style.iconBg} pointer-events-none transition-transform duration-500 group-hover:scale-150`}></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${style.iconBg}`}>
                      {icon}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${style.badge}`}>
                        {label}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-white/60 px-2 py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-xl text-gray-900 mb-3 leading-tight group-hover:text-black transition-colors">
                    {a.title}
                  </h3>
                  
                  <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3">
                    {a.message}
                  </p>
                  
                  {a.targetBarangay && (
                    <div className="inline-flex items-center gap-1.5 bg-white/80 border border-white/50 px-3 py-1.5 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Area:</span>
                      <span className="text-xs font-bold text-gray-800">{a.targetBarangay}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
