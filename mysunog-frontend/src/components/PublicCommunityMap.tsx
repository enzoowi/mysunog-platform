/**
 * PublicCommunityMap
 *
 * A public-facing map for the Home page that shows:
 *  - AI-generated fire risk zones (colored polygons by risk level)
 *  - BFP station, fire hydrants
 *
 * Incidents are NEVER shown — this component is intentionally
 * incident-free regardless of the viewer's authentication state.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  MapContainer,
  LayersControl, TileLayer,
  Marker,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Droplet, Droplets, ShieldPlus, RefreshCw, Cloud, Wind, CloudRain } from 'lucide-react';
import type { RiskZone } from './RiskZoneLayer';
import { RiskZonePolygons, RiskLegendItems } from './RiskZoneLayer';
import { hydrantIcon, stationIcon } from './MapIcons';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

// Fix Leaflet default icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Hydrant  = { id: number; name: string; lat: number; lng: number; description?: string; photoUrl?: string; };
type Station  = { id: number; name: string; lat: number; lng: number; contact?: string; photoUrl?: string; };

const defaultCenter: [number, number] = [14.0412, 121.1470];

export default function PublicCommunityMap() {
  const [zones, setZones]       = useState<RiskZone[]>([]);
  const [weather, setWeather]   = useState<any>(null);
  const [hydrants, setHydrants] = useState<Hydrant[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  // Layer toggles
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showHydrants,  setShowHydrants]  = useState(true);
  const [showStations,  setShowStations]  = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [riskRes, hydRes, stnRes] = await Promise.all([
          api.get('/risk-map/malvar'),
          api.get('/map/hydrants'),
          api.get('/map/stations'),
        ]);
        setZones(riskRes.data?.zones ?? []);
        setWeather(riskRes.data?.weather ?? null);
        setHydrants(hydRes.data ?? []);
        setStations(stnRes.data ?? []);
      } catch (err) {
        console.error('PublicCommunityMap: failed to load map data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Loading map data…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Layer toggles */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-sm text-gray-600">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showRiskZones}
            onChange={(e) => setShowRiskZones(e.target.checked)}
            className="rounded text-orange-600 focus:ring-orange-500"
          />
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444', opacity: 0.65 }} />
          Risk Zones
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showHydrants}
            onChange={(e) => setShowHydrants(e.target.checked)}
            className="rounded text-orange-600 focus:ring-orange-500"
          />
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          Fire Hydrants
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showStations}
            onChange={(e) => setShowStations(e.target.checked)}
            className="rounded text-orange-600 focus:ring-orange-500"
          />
          <span className="w-3 h-3 rounded-full bg-green-600" />
          BFP Station
        </label>
      </div>

      {/* Map Container Wrapper */}
      <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        
        {/* Floating Weather Widget */}
        {weather && (
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-md border border-white/40 pointer-events-none flex flex-col gap-1 max-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Cloud className="w-3 h-3" /> Malvar Weather
              </span>
              {weather.is_live && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-slate-800 leading-none">{weather.temperature_c}°C</span>
              <span className="text-xs font-medium text-slate-500 mb-0.5 capitalize truncate">{weather.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <Droplets className="w-3 h-3 text-blue-500" /> {weather.humidity_pct}%
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <Wind className="w-3 h-3 text-teal-500" /> {weather.wind_speed_kph}km/h
              </div>
              {weather.rainfall_mm > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-slate-600 col-span-2">
                  <CloudRain className="w-3 h-3 text-indigo-500" /> {weather.rainfall_mm}mm rain
                </div>
              )}
            </div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={13}
          maxBounds={[[13.98, 121.08], [14.10, 121.25]]}
          minZoom={12}
          style={{ height: '520px', width: '100%' }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Risk zone polygons — click to open info panel */}
          {showRiskZones && zones.length > 0 && (
            <RiskZonePolygons
              zones={zones}
              selected={selectedZone}
              onSelect={setSelectedZone}
            />
          )}

          {/* Fire hydrants */}
          {showHydrants && hydrants.map((h) => (
            <Marker key={`hyd-${h.id}`} position={[Number(h.lat), Number(h.lng)]} icon={hydrantIcon}>
              <Popup>
                {h.photoUrl && (
                  <img
                    src={h.photoUrl?.startsWith('http') ? h.photoUrl : `${BACKEND_URL}${h.photoUrl}`}
                    alt=""
                    className="w-full h-28 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition"
                    onClick={() => setFullImageUrl(h.photoUrl!?.startsWith('http') ? h.photoUrl! : `${BACKEND_URL}${h.photoUrl!}`)}
                  />
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <Droplet className="w-4 h-4 text-blue-500" />
                  <strong className="text-sm">{h.name}</strong>
                </div>
                {h.description && <p className="text-xs text-gray-500">{h.description}</p>}
              </Popup>
            </Marker>
          ))}

          {/* BFP station */}
          {showStations && stations.map((s) => (
            <Marker key={`stn-${s.id}`} position={[Number(s.lat), Number(s.lng)]} icon={stationIcon}>
              <Popup>
                {s.photoUrl && (
                  <img
                    src={s.photoUrl?.startsWith('http') ? s.photoUrl : `${BACKEND_URL}${s.photoUrl}`}
                    alt=""
                    className="w-full h-28 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition"
                    onClick={() => setFullImageUrl(s.photoUrl!?.startsWith('http') ? s.photoUrl! : `${BACKEND_URL}${s.photoUrl!}`)}
                  />
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldPlus className="w-4 h-4 text-green-600" />
                  <strong className="text-sm">{s.name}</strong>
                </div>
                {s.contact && <p className="text-xs text-gray-500">{s.contact}</p>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Selected zone info panel (below the map) */}
      {selectedZone && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-800 text-base">Brgy. {selectedZone.name}</h4>
              <button
                onClick={() => setSelectedZone(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span
                className="text-3xl font-black"
                style={{ color: selectedZone.risk_score >= 76 ? '#ef4444' : selectedZone.risk_score >= 51 ? '#f97316' : selectedZone.risk_score >= 26 ? '#eab308' : '#22c55e' }}
              >
                {selectedZone.risk_score}
              </span>
              <div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  selectedZone.risk_level === 'Severe' ? 'bg-red-100 text-red-700' :
                  selectedZone.risk_level === 'High'   ? 'bg-orange-100 text-orange-700' :
                  selectedZone.risk_level === 'Moderate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {selectedZone.risk_level} Risk
                </span>
                <p className="text-xs text-gray-400 mt-0.5">AI Risk Score (0–100)</p>
              </div>
            </div>
            {selectedZone.primary_risk_factors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Risk Factors</p>
                <ul className="flex flex-wrap gap-2">
                  {selectedZone.primary_risk_factors.map((f, i) => (
                    <li key={i} className="bg-orange-50 border border-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 bg-white border border-gray-200 rounded-xl px-5 py-3 flex flex-wrap gap-5 text-sm text-gray-600">
        <span className="font-semibold text-gray-700">Legend:</span>
        <RiskLegendItems />
        <span className="w-px h-5 bg-gray-200 self-center hidden sm:block" />
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" /> Fire Hydrant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-600" /> BFP Station
        </span>
      </div>

      {/* Full-screen image modal */}
      {fullImageUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFullImageUrl(null)}
        >
          <button
            className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full transition"
            onClick={() => setFullImageUrl(null)}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={fullImageUrl}
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
            alt="Full screen preview"
          />
        </div>
      )}
    </div>
  );
}
