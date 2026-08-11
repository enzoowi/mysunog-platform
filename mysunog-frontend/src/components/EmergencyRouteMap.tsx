import { useEffect, useState } from 'react';
import { MapContainer, LayersControl, TileLayer, Marker, Polyline, Popup, Circle, Tooltip } from 'react-leaflet';
import { api } from '../services/api';
import { stationIcon, incidentIcon } from './MapIcons';

/* ── Danger Buffer Zone Config ─────────────────────────────────────────────── */
const DANGER_BUFFER_RADIUS = 500; // metres

type RouteData = {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  geometry: { type: string; coordinates: number[][] };
  distance: number;
  duration: number;
  steps: { instruction: string; distance: number; duration: number }[];
  error?: string;
};

export default function EmergencyRouteMap({ incidentLat, incidentLng }: { incidentLat: number; incidentLng: number }) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSteps, setShowSteps] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api.post('/notifications/emergency-route', { incidentLat, incidentLng })
      .then(res => {
        if (cancelled) return;
        if (res.data.error) {
          setError(res.data.error);
        } else {
          setRoute(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load emergency route.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [incidentLat, incidentLng]);

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{
          width: '32px', height: '32px', margin: '0 auto 12px',
          border: '3px solid #dc2626', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ color: '#6b7280', fontSize: '13px', fontWeight: 500 }}>🚒 Calculating fastest route...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
        padding: '12px 16px', color: '#991b1b', fontSize: '13px',
      }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!route) return null;

  // Convert GeoJSON coordinates [lng, lat] → [lat, lng] for Leaflet
  const routePositions: [number, number][] = route.geometry.coordinates.map(
    (coord: number[]) => [coord[1], coord[0]]
  );

  const distanceKm = (route.distance / 1000).toFixed(1);
  const durationMin = Math.ceil(route.duration / 60);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${route.origin.lat},${route.origin.lng}&destination=${route.destination.lat},${route.destination.lng}&travelmode=driving`;

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '18px' }}>🚒</span>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
          Emergency Response Route
        </h3>
      </div>

      {/* Route Summary Card */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '12px',
      }}>
        <div style={{
          flex: 1, background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '10px', padding: '12px', textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>
            {distanceKm} <span style={{ fontSize: '13px', fontWeight: 500 }}>km</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#991b1b', fontWeight: 500 }}>Distance</p>
        </div>
        <div style={{
          flex: 1, background: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: '10px', padding: '12px', textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#ea580c' }}>
            {durationMin} <span style={{ fontSize: '13px', fontWeight: 500 }}>min</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9a3412', fontWeight: 500 }}>Est. Travel Time</p>
        </div>
        <div style={{
          flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '10px', padding: '12px', textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>
            {route.steps.length}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#166534', fontWeight: 500 }}>Turns</p>
        </div>
      </div>

      {/* Danger Zone Info Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '10px', padding: '8px 12px',
        background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
        border: '1px solid #fecaca', borderRadius: '10px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'rgba(220,38,38,0.12)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px' }}>⚠️</span>
        </span>
        <div>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
            {DANGER_BUFFER_RADIUS}m Danger Buffer Zone Active
          </p>
          <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#b91c1c', opacity: 0.8 }}>
            Dynamic geospatial perimeter around fire coordinates — avoid this area
          </p>
        </div>
      </div>

      {/* Route Map */}
      <div style={{
        height: '280px', borderRadius: '12px', overflow: 'hidden',
        border: '2px solid #fecaca', position: 'relative',
      }}>
        {/* Pulsing animation for the danger buffer zone */}
        <style>{`
          @keyframes dangerPulse {
            0%   { opacity: 0.25; }
            50%  { opacity: 0.45; }
            100% { opacity: 0.25; }
          }
          .danger-buffer-zone {
            animation: dangerPulse 2.5s ease-in-out infinite;
          }
        `}</style>
        <MapContainer
          center={[
            (route.origin.lat + route.destination.lat) / 2,
            (route.origin.lng + route.destination.lng) / 2,
          ]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* ── 500m Danger Buffer Zone ─────────────────────────── */}
          <Circle
            center={[route.destination.lat, route.destination.lng]}
            radius={DANGER_BUFFER_RADIUS}
            pathOptions={{
              color: '#dc2626',
              weight: 2,
              dashArray: '8 4',
              fillColor: '#dc2626',
              fillOpacity: 0.12,
              className: 'danger-buffer-zone',
            }}
          >
            <Tooltip direction="top" sticky>
              <span style={{ fontWeight: 600, fontSize: '12px', color: '#991b1b' }}>
                ⚠️ {DANGER_BUFFER_RADIUS}m Danger Zone
              </span>
            </Tooltip>
          </Circle>

          <Marker position={[route.origin.lat, route.origin.lng]} icon={stationIcon}>
            <Popup>
              <strong>🚒 {route.origin.label}</strong><br/>
              <span style={{ fontSize: '11px', color: '#666' }}>Origin</span>
            </Popup>
          </Marker>
          <Marker position={[route.destination.lat, route.destination.lng]} icon={incidentIcon}>
            <Popup>
              <strong>🔥 {route.destination.label}</strong><br/>
              <span style={{ fontSize: '11px', color: '#666' }}>Destination</span>
            </Popup>
          </Marker>
          <Polyline
            positions={routePositions}
            pathOptions={{ color: '#dc2626', weight: 5, opacity: 0.8 }}
          />
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div style={{
        display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '11px', color: '#6b7280',
      }}>
        <span>🔴 BFP Station</span>
        <span>🟠 Incident</span>
        <span style={{ color: '#dc2626' }}>━━ Fastest Route</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%',
            background: 'rgba(220,38,38,0.15)', border: '1.5px dashed #dc2626',
          }} />
          {DANGER_BUFFER_RADIUS}m Danger Zone
        </span>
      </div>

      {/* Turn-by-Turn Directions */}
      {route.steps.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => setShowSteps(!showSteps)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '10px',
              border: '1px solid #e5e7eb', background: '#f9fafb',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', fontSize: '13px', fontWeight: 600,
              color: '#374151',
            }}
          >
            <span>📋 Turn-by-Turn Directions ({route.steps.length} steps)</span>
            <span style={{
              transform: showSteps ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>▼</span>
          </button>
          {showSteps && (
            <div style={{
              marginTop: '8px', maxHeight: '200px', overflowY: 'auto',
              border: '1px solid #e5e7eb', borderRadius: '10px', padding: '4px',
            }}>
              {route.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '10px', padding: '8px 10px',
                  borderBottom: i < route.steps.length - 1 ? '1px solid #f3f4f6' : 'none',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
                    background: '#dc2626', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#374151', lineHeight: 1.4 }}>
                      {step.instruction}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#9ca3af' }}>
                      {step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${step.distance} m`}
                      {step.duration > 0 && ` · ${Math.ceil(step.duration / 60)} min`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open in Google Maps button */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '12px', padding: '10px 16px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #1a73e8, #4285f4)',
          color: '#fff', fontWeight: 600, fontSize: '13px',
          textDecoration: 'none', border: 'none', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(26,115,232,0.3)',
          transition: 'opacity 0.15s',
        }}
      >
        🗺️ Open Route in Google Maps
      </a>

      {/* Attribution */}
      <p style={{ margin: '8px 0 0', fontSize: '9px', color: '#9ca3af', textAlign: 'center' }}>
        Route data © openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors
      </p>
    </div>
  );
}
