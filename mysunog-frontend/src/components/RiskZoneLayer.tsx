import type { ReactNode } from 'react';
import { GeoJSON, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { X, Shield, AlertTriangle, ChevronRight, Clock, Thermometer, Users, Building2 } from 'lucide-react';

type FactorBreakdown = {
  historical_fire_score: number;
  weather_score: number;
  population_density_score: number;
  building_type_score: number;
};

export type RiskZone = {
  name: string;
  center: [number, number];
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  risk_score: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  factor_breakdown: FactorBreakdown;
  primary_risk_factors: string[];
  recommendations: string[];
  incident_count: number;
};

const RISK_BADGE: Record<string, string> = {
  Low: 'bg-green-100 text-green-700',
  Moderate: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Severe: 'bg-red-100 text-red-700',
};

const RISK_BG: Record<string, string> = {
  Low: 'bg-green-50 border-green-200 text-green-800',
  Moderate: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  High: 'bg-orange-50 border-orange-200 text-orange-800',
  Severe: 'bg-red-50 border-red-200 text-red-800',
};

function color(score: number) {
  if (score >= 76) return '#ef4444';
  if (score >= 51) return '#f97316';
  if (score >= 26) return '#eab308';
  return '#22c55e';
}

function opacity(score: number) {
  return 0.3 + (score / 100) * 0.45;
}

const FACTORS: Record<string, { label: string; icon: ReactNode; bg: string }> = {
  historical_fire_score: { label: 'Historical', icon: <Clock className="w-3.5 h-3.5" />, bg: 'bg-red-500' },
  weather_score: { label: 'Weather', icon: <Thermometer className="w-3.5 h-3.5" />, bg: 'bg-orange-500' },
  population_density_score: { label: 'Population', icon: <Users className="w-3.5 h-3.5" />, bg: 'bg-blue-500' },
  building_type_score: { label: 'Buildings', icon: <Building2 className="w-3.5 h-3.5" />, bg: 'bg-amber-500' },
};

export function RiskZonePolygons({ zones, selected, onSelect }: {
  zones: RiskZone[];
  selected: RiskZone | null;
  onSelect: (z: RiskZone) => void;
}) {
  return (
    <>
      {zones.map((zone) => (
        <GeoJSON
          key={zone.name}
          data={{ type: 'Feature', properties: {}, geometry: zone.geometry } as GeoJSON.Feature}
          style={() => ({
            fillColor: color(zone.risk_score),
            fillOpacity: opacity(zone.risk_score),
            color: selected?.name === zone.name ? '#1e293b' : color(zone.risk_score),
            weight: selected?.name === zone.name ? 3 : 2,
            opacity: 1,
          })}
          eventHandlers={{
            click: () => onSelect(zone),
            mouseover: (e: L.LeafletMouseEvent) => {
              e.target.setStyle({ weight: 3, fillOpacity: opacity(zone.risk_score) + 0.15 });
              e.target.bringToFront();
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              e.target.setStyle({
                weight: selected?.name === zone.name ? 3 : 2,
                fillOpacity: opacity(zone.risk_score),
              });
            },
          }}
        >
          <Tooltip sticky direction="top">
            <span className="font-semibold">{zone.name}</span> — <span style={{ color: color(zone.risk_score) }} className="font-bold">{zone.risk_score}</span> ({zone.risk_level})
          </Tooltip>
        </GeoJSON>
      ))}
    </>
  );
}

export function RiskDetailPanel({ zone, onClose }: { zone: RiskZone; onClose: () => void }) {
  return (
    <div className="bg-white border rounded-xl shadow-lg overflow-y-auto" style={{ maxHeight: '560px' }}>
      <div className={`p-4 border-b ${RISK_BG[zone.risk_level]}`}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold">Brgy. {zone.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/50"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black">{zone.risk_score}</span>
          <div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${RISK_BADGE[zone.risk_level]}`}>{zone.risk_level} Risk</span>
            <p className="text-xs mt-0.5 opacity-75">Score (0–100)</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-gray-400" /> Score Breakdown</h4>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${zone.risk_score}%`, backgroundColor: color(zone.risk_score) }} />
        </div>
        <div className="space-y-2">
          {Object.entries(zone.factor_breakdown).map(([key, val]) => {
            const f = FACTORS[key];
            if (!f) return null;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span className="flex items-center gap-1">{f.icon} {f.label}</span>
                  <span className="font-bold">{val}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className={`${f.bg} rounded-full h-1.5`} style={{ width: `${Math.min(val, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {zone.primary_risk_factors.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> Risk Factors</h4>
          <ul className="space-y-1">
            {zone.primary_risk_factors.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <ChevronRight className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {zone.recommendations.length > 0 && (
        <div className="p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-500" /> Recommendations</h4>
          <ul className="space-y-1">
            {zone.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RiskLegendItems() {
  return (
    <>
      {['Low', 'Moderate', 'High', 'Severe'].map((lvl) => (
        <span key={lvl} className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: color(lvl === 'Severe' ? 80 : lvl === 'High' ? 60 : lvl === 'Moderate' ? 40 : 15), opacity: 0.7 }} />
          {lvl} Risk
        </span>
      ))}
    </>
  );
}
