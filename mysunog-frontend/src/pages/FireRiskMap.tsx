import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  Pane,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Map as MapIcon,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  AlertTriangle,
  RefreshCw,
  Shield,
  Flame,
  BarChart3,
  Clock,
  ChevronRight,
  X,
  Users,
  Building2,
  TrendingUp,
  Cloud,
} from 'lucide-react';
import type { RiskZone } from '../components/RiskZoneLayer';
import {
  RiskZonePolygons,
  RiskLegendItems,
} from '../components/RiskZoneLayer';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
  return null;
}

type WeatherData = {
  temperature_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_speed_kph: number;
  heat_index: number | null;
  rainfall_mm: number;
  description: string;
  icon: string;
  is_live: boolean;
};

type Incident = {
  id: number;
  incidentDate: string;
  incidentTime: string;
  barangay: string;
  cause?: string;
  latitude: number;
  longitude: number;
  estimatedDamage?: number;
  casualties?: number;
  injuries?: number;
  propertyType?: string;
};

type RiskPayload = {
  municipality: string;
  province: string;
  timestamp: string;
  total_barangays: number;
  average_risk_score: number;
  highest_risk_barangay: string | null;
  zones: RiskZone[];
  weather: WeatherData | null;
  incident_counts: Record<string, number>;
};

const RISK_COLORS: Record<string, string> = {
  Severe: '#ef4444',
  High: '#f97316',
  Moderate: '#eab308',
  Low: '#22c55e',
};

const RISK_BG: Record<string, string> = {
  Severe: 'bg-red-50 border-red-200 text-red-800',
  High: 'bg-orange-50 border-orange-200 text-orange-800',
  Moderate: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Low: 'bg-green-50 border-green-200 text-green-800',
};

const RISK_BADGE: Record<string, string> = {
  Severe: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

const FACTOR_META: Record<
  string,
  { label: string; icon: ReactNode; bg: string }
> = {
  historical_fire_score: {
    label: 'Historical',
    icon: <Clock className="w-3.5 h-3.5" />,
    bg: 'bg-red-500',
  },
  weather_score: {
    label: 'Weather',
    icon: <Thermometer className="w-3.5 h-3.5" />,
    bg: 'bg-orange-500',
  },
  population_density_score: {
    label: 'Population',
    icon: <Users className="w-3.5 h-3.5" />,
    bg: 'bg-blue-500',
  },
  building_type_score: {
    label: 'Buildings',
    icon: <Building2 className="w-3.5 h-3.5" />,
    bg: 'bg-amber-500',
  },
};

export default function FireRiskMap() {
  const [data, setData] = useState<RiskPayload | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const navigate = useNavigate();

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        const role = res.data.role;
        if (role !== 'admin' && role !== 'bfp_staff') navigate('/', { replace: true });
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  // Fetch data
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [riskRes, incidentRes] = await Promise.all([
        api.get('/risk-map/malvar'),
        api.get('/incidents/search'),
      ]);
      setData(riskRes.data);
      setIncidents(incidentRes.data || []);
    } catch (err) {
      console.error('Failed to fetch risk map data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh weather every 10 minutes
  useEffect(() => {
    const interval = setInterval(
      () => fetchData(true),
      10 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  const weather = data?.weather;
  const zones = data?.zones || [];

  // Risk level counts
  const riskCounts = useMemo(() => {
    const counts = { Severe: 0, High: 0, Moderate: 0, Low: 0 };
    zones.forEach((z) => {
      if (z.risk_level in counts)
        counts[z.risk_level as keyof typeof counts]++;
    });
    return counts;
  }, [zones]);

  // Fire Weather Index
  const fireWeatherIndex = useMemo(() => {
    if (!weather) return null;
    const tempScore = Math.min(
      Math.max(((weather.temperature_c - 25) / 15) * 100, 0),
      100,
    );
    const humScore = Math.min(
      Math.max(((100 - weather.humidity_pct) / 80) * 100, 0),
      100,
    );
    const windScore = Math.min(
      Math.max((weather.wind_speed_kph / 30) * 100, 0),
      100,
    );
    return Math.round(tempScore * 0.4 + humScore * 0.35 + windScore * 0.25);
  }, [weather]);

  const fwiLevel = fireWeatherIndex
    ? fireWeatherIndex >= 76
      ? 'Extreme'
      : fireWeatherIndex >= 51
        ? 'High'
        : fireWeatherIndex >= 26
          ? 'Moderate'
          : 'Low'
    : 'N/A';



  const defaultCenter: [number, number] = [14.0412, 121.1470];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-600 font-medium">
            Loading Fire Risk Map...
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Fetching live weather and risk data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-2.5">
            <MapIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Fire Risk Prediction Map
            </h2>
            <p className="text-sm text-gray-500">
              Malvar, Batangas — AI-Powered Risk Assessment with Live Weather
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-300 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Weather Widget + Risk Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        {/* Live Weather Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 opacity-80" />
              <span className="text-sm font-semibold opacity-90">
                Live Weather — Malvar, Batangas
              </span>
            </div>
            {weather && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  weather.is_live
                    ? 'bg-green-400/20 text-green-200'
                    : 'bg-yellow-400/20 text-yellow-200'
                }`}
              >
                {weather.is_live ? '● Live' : '○ Cached'}
              </span>
            )}
          </div>

          {weather ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-black">
                    {weather.temperature_c}°
                  </span>
                  <span className="text-lg opacity-80 mb-1">C</span>
                </div>
                <p className="text-sm opacity-80 capitalize">
                  {weather.description}
                </p>
                {weather.feels_like_c !== weather.temperature_c && (
                  <p className="text-xs opacity-60 mt-0.5">
                    Feels like {weather.feels_like_c}°C
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Droplets className="w-4 h-4 opacity-70" />
                  <span>
                    {weather.humidity_pct}% humidity
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Wind className="w-4 h-4 opacity-70" />
                  <span>{weather.wind_speed_kph} km/h wind</span>
                </div>
                {weather.heat_index && (
                  <div className="flex items-center gap-2 text-sm">
                    <Thermometer className="w-4 h-4 opacity-70" />
                    <span>Heat Index: {weather.heat_index}°C</span>
                  </div>
                )}
                {weather.rainfall_mm > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <CloudRain className="w-4 h-4 opacity-70" />
                    <span>{weather.rainfall_mm}mm rain</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm opacity-70">
              Weather data unavailable
            </p>
          )}

          {/* Fire Weather Index */}
          {fireWeatherIndex !== null && (
            <div className="mt-4 pt-3 border-t border-white/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold opacity-70 uppercase tracking-wide">
                  Fire Weather Index
                </span>
                <span
                  className={`text-lg font-black ${
                    fwiLevel === 'Extreme' || fwiLevel === 'High'
                      ? 'text-yellow-300'
                      : 'text-green-300'
                  }`}
                >
                  {fireWeatherIndex} — {fwiLevel}
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mt-1.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${fireWeatherIndex}%`,
                    backgroundColor:
                      fwiLevel === 'Extreme'
                        ? '#ef4444'
                        : fwiLevel === 'High'
                          ? '#f97316'
                          : fwiLevel === 'Moderate'
                            ? '#eab308'
                            : '#22c55e',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Overall Risk
          </span>
          <p className="text-3xl font-black text-gray-800 mt-1">
            {data?.average_risk_score ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Average score across {zones.length} barangays
          </p>
          <div className="flex gap-1 mt-3">
            {['Severe', 'High', 'Moderate', 'Low'].map((lvl) => (
              <div
                key={lvl}
                className="flex-1 text-center px-1 py-1.5 rounded-lg border"
                style={{
                  borderColor: RISK_COLORS[lvl] + '40',
                  backgroundColor: RISK_COLORS[lvl] + '10',
                }}
              >
                <p
                  className="text-lg font-bold"
                  style={{ color: RISK_COLORS[lvl] }}
                >
                  {riskCounts[lvl as keyof typeof riskCounts]}
                </p>
                <p className="text-[10px] text-gray-500">{lvl}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Highest Risk
          </span>
          {data?.highest_risk_barangay ? (
            <>
              <p className="text-lg font-bold text-red-600 mt-1">
                Brgy. {data.highest_risk_barangay}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Score:{' '}
                {zones.find(
                  (z) => z.name === data.highest_risk_barangay,
                )?.risk_score ?? '—'}
                /100
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-2">No data</p>
          )}
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Total incidents: {incidents.length}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {data?.highest_risk_barangay && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-bold text-red-800">Priority Alert:</span>
          <span className="text-red-700">
            Brgy. {data.highest_risk_barangay} requires immediate fire safety
            inspection — prioritize patrol deployment
          </span>
        </div>
      )}

      {/* Layer Toggles */}
      <div className="bg-white border rounded-xl p-4 mb-5 shadow-sm flex flex-wrap gap-4 items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase">
          Map Layers:
        </span>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showRiskZones}
            onChange={(e) => setShowRiskZones(e.target.checked)}
            className="rounded text-orange-600 focus:ring-orange-500"
          />
          🗺️ Risk Zones
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showIncidents}
            onChange={(e) => setShowIncidents(e.target.checked)}
            className="rounded text-orange-600 focus:ring-orange-500"
          />
          🔴 Fire Incidents ({incidents.length})
        </label>
        <div className="ml-auto text-xs text-gray-400">
          Last updated:{' '}
          {data?.timestamp
            ? new Date(data.timestamp).toLocaleTimeString()
            : '—'}
        </div>
      </div>

      {/* Map + Detail Panel */}
      <div className="flex gap-5">
        <div
          className={`${
            selectedZone ? 'w-2/3' : 'w-full'
          } transition-all duration-300`}
        >
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <MapContainer
              center={defaultCenter}
              zoom={13}
              maxBounds={[
                [13.95, 121.05],
                [14.10, 121.25],
              ]}
              minZoom={11}
              style={{ height: '560px', width: '100%' }}
            >
              <MapUpdater 
                center={selectedZone ? selectedZone.center : defaultCenter} 
                zoom={selectedZone ? 15 : 13} 
              />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Risk Zone Polygons */}
              {showRiskZones && (
                <RiskZonePolygons
                  zones={zones}
                  selected={selectedZone}
                  onSelect={setSelectedZone}
                />
              )}

              {/* Fire Incident Markers */}
              {showIncidents && (
                <Pane name="incidentsPane" style={{ zIndex: 500 }}>
                  {incidents
                    .filter((inc) => !selectedZone || inc.barangay === selectedZone.name)
                    .map((inc) => (
                    <CircleMarker
                      key={`inc-${inc.id}`}
                      center={[
                        Number(inc.latitude),
                        Number(inc.longitude),
                      ]}
                      radius={7}
                      pathOptions={{
                        color: '#dc2626',
                        fillColor: '#ef4444',
                        fillOpacity: 0.8,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <div className="flex items-center gap-2 mb-2 border-b pb-2">
                            <Flame className="w-4 h-4 text-red-500" />
                            <strong className="text-sm">
                              Incident #{inc.id}
                            </strong>
                          </div>
                          <p className="text-xs mb-1">
                            <strong>Barangay:</strong> {inc.barangay}
                          </p>
                          <p className="text-xs mb-1">
                            <strong>Date:</strong> {inc.incidentDate}
                          </p>
                          <p className="text-xs mb-1">
                            <strong>Cause:</strong> {inc.cause || 'N/A'}
                          </p>
                          <p className="text-xs mb-1">
                            <strong>Damage:</strong> ₱
                            {Number(inc.estimatedDamage || 0).toLocaleString()}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </Pane>
              )}
            </MapContainer>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedZone && (
          <div className="w-1/3">
            <div
              className="bg-white border rounded-xl shadow-lg overflow-y-auto"
              style={{ maxHeight: '560px' }}
            >
              {/* Header */}
              <div
                className={`p-4 border-b ${
                  RISK_BG[selectedZone.risk_level]
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold">
                    Brgy. {selectedZone.name}
                  </h3>
                  <button
                    onClick={() => setSelectedZone(null)}
                    className="p-1 rounded hover:bg-white/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black">
                    {selectedZone.risk_score}
                  </span>
                  <div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        RISK_BADGE[selectedZone.risk_level]
                      }`}
                    >
                      {selectedZone.risk_level} Risk
                    </span>
                    <p className="text-xs mt-0.5 opacity-75">
                      Score (0–100)
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="p-4 border-b">
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5 text-gray-400" />{' '}
                  Score Breakdown
                </h4>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedZone.risk_score}%`,
                      backgroundColor:
                        RISK_COLORS[selectedZone.risk_level],
                    }}
                  />
                </div>
                <div className="space-y-2">
                  {Object.entries(
                    selectedZone.factor_breakdown,
                  ).map(([key, val]) => {
                    const f = FACTOR_META[key];
                    if (!f) return null;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                          <span className="flex items-center gap-1">
                            {f.icon} {f.label}
                          </span>
                          <span className="font-bold">{val}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`${f.bg} rounded-full h-1.5`}
                            style={{
                              width: `${Math.min(val as number, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Incident Count */}
              {'incident_count' in selectedZone && (
                <div className="px-4 pt-3 pb-2 border-b">
                  <div className="flex items-center gap-2 text-sm">
                    <Flame className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-gray-700">
                      {(selectedZone as any).incident_count} fire
                      incident
                      {(selectedZone as any).incident_count !== 1
                        ? 's'
                        : ''}{' '}
                      recorded
                    </span>
                  </div>
                </div>
              )}

              {/* Risk Factors */}
              {selectedZone.primary_risk_factors.length > 0 && (
                <div className="p-4 border-b">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />{' '}
                    Risk Factors
                  </h4>
                  <ul className="space-y-1">
                    {selectedZone.primary_risk_factors.map(
                      (f, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-gray-600"
                        >
                          <ChevronRight className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {selectedZone.recommendations.length > 0 && (
                <div className="p-4">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />{' '}
                    BFP Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {selectedZone.recommendations.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-gray-600"
                      >
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {i + 1}
                        </span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 bg-white border rounded-xl p-4 flex flex-wrap gap-6 text-sm shadow-sm">
        <span className="font-semibold text-gray-700">Markers:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" />
          Fire Incident
        </span>
        <span className="w-px h-5 bg-gray-200" />
        <span className="font-semibold text-gray-700">Risk Zones:</span>
        <RiskLegendItems />
      </div>

      {/* Barangay Ranking Table */}
      <div className="mt-6 bg-white border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          Barangay Risk Rankings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">#</th>
                <th className="py-2">Barangay</th>
                <th className="py-2 text-center">Score</th>
                <th className="py-2 text-center">Level</th>
                <th className="py-2 text-center">Incidents</th>
                <th className="py-2">Top Factor</th>
              </tr>
            </thead>
            <tbody>
              {[...zones]
                .sort((a, b) => b.risk_score - a.risk_score)
                .map((zone, idx) => (
                  <tr
                    key={zone.name}
                    className="border-b border-gray-50 hover:bg-orange-50/50 transition cursor-pointer"
                    onClick={() => setSelectedZone(zone)}
                  >
                    <td className="py-2.5 pr-3 text-gray-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 font-medium text-gray-800">
                      {zone.name}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className="font-bold"
                        style={{
                          color: RISK_COLORS[zone.risk_level],
                        }}
                      >
                        {zone.risk_score}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          RISK_BADGE[zone.risk_level]
                        }`}
                      >
                        {zone.risk_level}
                      </span>
                    </td>
                    <td className="py-2.5 text-center text-gray-600">
                      {(zone as any).incident_count ?? 0}
                    </td>
                    <td className="py-2.5 text-xs text-gray-500 max-w-[200px] truncate">
                      {zone.primary_risk_factors[0] || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
