import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, Pane } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Map as MapIcon, Filter, Calendar, Flame, Droplet, ShieldPlus, AlertTriangle, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { RiskZone } from '../components/RiskZoneLayer';
import { RiskZonePolygons, RiskDetailPanel, RiskLegendItems } from '../components/RiskZoneLayer';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createPin = (color: string) => `<svg viewBox="0 0 24 36" width="24" height="36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 7.872 11.233 23.36 11.602 23.86a.5.5 0 0 0 .796 0C12.767 35.36 24 19.872 24 12c0-6.627-5.373-12-12-12zm0 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`;

const hydrantIcon = new L.DivIcon({
    html: createPin('#3b82f6'),
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
});

const stationIcon = new L.DivIcon({
    html: createPin('#16a34a'),
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
});


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
    landmark?: string;
    photoUrl?: string;
};

type Hydrant = { id: number; name: string; lat: number; lng: number; description?: string; photoUrl?: string; };

type Station = { id: number; name: string; lat: number; lng: number; contact?: string; photoUrl?: string; };

const BARANGAYS = [
    'All', 'Bagong Pook', 'Bilucao', 'Bulihan', 'Luta del Norte', 'Luta del Sur',
    'Poblacion', 'San Andres', 'San Fernando', 'San Isidro', 'San Juan',
    'San Pedro I', 'San Pedro II', 'San Pioquinto', 'Santiago',
];

export default function AdminIncidentMap() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [hydrants, setHydrants] = useState<Hydrant[]>([]);

    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedBarangay, setSelectedBarangay] = useState('All');

    const [showHydrants, setShowHydrants] = useState(true);
    const [showStations, setShowStations] = useState(true);

    const [showIncidents, setShowIncidents] = useState(true);
    const [showRiskZones, setShowRiskZones] = useState(true);

    const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
    const [selectedRiskZone, setSelectedRiskZone] = useState<RiskZone | null>(null);
    const [riskHighest, setRiskHighest] = useState<string | null>(null);
    const [refreshingRisk, setRefreshingRisk] = useState(false);

    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/', { replace: true }); return; }
        api.get('/auth/me')
            .then((res) => { if (res.data.role !== 'admin' && res.data.role !== 'bfp_staff') { navigate('/', { replace: true }); } })
            .catch(() => navigate('/login', { replace: true }));
    }, [navigate]);

    // Fetch hydrants, hotspots, stations once
    useEffect(() => {
        async function fetchMapData() {
            try {
                const [hyd, stn] = await Promise.all([
                    api.get('/map/hydrants'),
                    api.get('/map/stations')
                ]);
                setHydrants(hyd.data);
                setStations(stn.data);
            } catch (error) {
                console.error('Failed to fetch map data', error);
            }
        }
        fetchMapData();
    }, []);

    // Fetch risk zone data
    const fetchRiskData = async (isRefresh = false) => {
        if (isRefresh) setRefreshingRisk(true);
        try {
            const res = await api.get('/risk-map/malvar');
            setRiskZones(res.data.zones || []);
            setRiskHighest(res.data.highest_risk_barangay || null);
        } catch (err) {
            console.error('Failed to fetch risk data', err);
        } finally {
            setRefreshingRisk(false);
        }
    };

    useEffect(() => { fetchRiskData(); }, []);

    // Fetch incidents with filters
    useEffect(() => {
        async function fetchIncidents() {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (selectedBarangay && selectedBarangay !== 'All') params.set('barangay', selectedBarangay);
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);
                const res = await api.get(`/incidents/search?${params.toString()}`);
                setIncidents(res.data);
            } catch (err) {
                console.error('Failed to fetch incidents', err);
            } finally {
                setLoading(false);
            }
        }
        fetchIncidents();
    }, [startDate, endDate, selectedBarangay]);

    // ─── Point-in-polygon helper (ray-casting) ───────────────
    function pointInPolygon(lat: number, lng: number, polygon: number[][][]): boolean {
        const ring = polygon[0]; // outer ring: [lng, lat] per GeoJSON
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][1], yi = ring[i][0];
            const xj = ring[j][1], yj = ring[j][0];
            const intersect = ((yi > lng) !== (yj > lng)) &&
                (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // ─── Filter all layers by selected barangay ─────────────
    const filteredRiskZones = useMemo(() => {
        if (selectedBarangay === 'All') return riskZones;
        return riskZones.filter(z => z.name === selectedBarangay);
    }, [riskZones, selectedBarangay]);

    const filteredHydrants = useMemo(() => {
        if (selectedBarangay === 'All') return hydrants;
        const zone = riskZones.find(z => z.name === selectedBarangay);
        if (!zone) return hydrants;
        return hydrants.filter(h =>
            pointInPolygon(Number(h.lat), Number(h.lng), zone.geometry.coordinates)
        );
    }, [hydrants, riskZones, selectedBarangay]);

    const filteredStations = useMemo(() => {
        if (selectedBarangay === 'All') return stations;
        const zone = riskZones.find(z => z.name === selectedBarangay);
        if (!zone) return stations;
        return stations.filter(s =>
            pointInPolygon(Number(s.lat), Number(s.lng), zone.geometry.coordinates)
        );
    }, [stations, riskZones, selectedBarangay]);

    const defaultCenter: [number, number] = [14.0412, 121.1583];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>

            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-2.5">
                        <MapIcon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Incident & Risk Map</h2>
                        <p className="text-sm text-gray-500">Malvar, Batangas — Incidents, Assets & AI Risk Prediction</p>
                    </div>
                </div>
                <button onClick={() => fetchRiskData(true)} disabled={refreshingRisk}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-300 transition shadow-sm disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${refreshingRisk ? 'animate-spin' : ''}`} />
                    {refreshingRisk ? 'Refreshing...' : 'Refresh Risk'}
                </button>
            </div>

            {/* Risk Summary Cards */}
            {filteredRiskZones.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Zones</span>
                        <p className="text-xl font-bold text-gray-800">{filteredRiskZones.length}</p>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Avg Risk</span>
                        <p className="text-xl font-bold text-gray-800">
                            {filteredRiskZones.length > 0
                                ? (filteredRiskZones.reduce((sum, z) => sum + z.risk_score, 0) / filteredRiskZones.length).toFixed(1)
                                : 0}
                        </p>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Severe/High</span>
                        <p className="text-xl font-bold text-orange-600">{filteredRiskZones.filter(z => z.risk_level === 'Severe' || z.risk_level === 'High').length}</p>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Incidents</span>
                        <p className="text-xl font-bold text-red-600">{incidents.length}</p>
                    </div>
                </div>
            )}

            {riskHighest && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="font-bold text-red-800">Highest Risk:</span>
                    <span className="text-red-700">Brgy. {riskHighest} — prioritize inspection</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold text-gray-700">Filters</h3>
                    <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                        {incidents.length} incident{incidents.length !== 1 && 's'} found
                    </span>
                </div>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Barangay</label>
                        <select value={selectedBarangay} onChange={(e) => setSelectedBarangay(e.target.value)}
                            className="w-full border-gray-300 border rounded-lg px-4 py-2.5 text-sm shadow-sm focus:ring-orange-500 focus:border-orange-500">
                            {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Start Date
                        </label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border-gray-300 border rounded-lg px-4 py-2.5 text-sm shadow-sm focus:ring-orange-500 focus:border-orange-500" />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> End Date
                        </label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border-gray-300 border rounded-lg px-4 py-2.5 text-sm shadow-sm focus:ring-orange-500 focus:border-orange-500" />
                    </div>
                    <div className="flex items-end">
                        <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedBarangay('All'); }}
                            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                            Clear
                        </button>
                    </div>
                </div>

                {/* Map Layer Toggles */}
                <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100 items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Layers:</span>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={showIncidents} onChange={(e) => setShowIncidents(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                        🔴 Incidents
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={showHydrants} onChange={(e) => setShowHydrants(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                        🔵 Hydrants
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                        🟢 BFP Station
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={showRiskZones} onChange={(e) => setShowRiskZones(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
                        🗺️ Risk Zones
                    </label>
                </div>
            </div>

            {/* Map + Risk Detail Panel */}
            <div className="flex gap-5">
              <div className={`${selectedRiskZone ? 'w-2/3' : 'w-full'} transition-all duration-300 relative`}>
                    <div className="border rounded-xl overflow-hidden shadow-sm relative">
                        {loading && (
                            <div className="absolute inset-0 z-[1000] bg-white/50 flex items-center justify-center">
                                <div className="bg-white px-4 py-2 rounded-full shadow-md text-sm font-medium text-gray-600 flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                                    Updating Map...
                                </div>
                            </div>
                        )}
                        <MapContainer
                            center={defaultCenter}
                            zoom={13}
                            minZoom={12}
                            style={{ height: '550px', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; OpenStreetMap contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {/* Risk Zone Polygons */}
                            {showRiskZones && (
                                <RiskZonePolygons zones={filteredRiskZones} selected={selectedRiskZone} onSelect={setSelectedRiskZone} />
                            )}



                            {/* Incident markers */}
                            {showIncidents && (
                                <Pane name="incidentsPane" style={{ zIndex: 500 }}>
                                    {incidents.map((incident) => {
                                        const damage = Number(incident.estimatedDamage || 0);
                                        return (
                                            <CircleMarker
                                                key={`inc-${incident.id}`}
                                                center={[Number(incident.latitude), Number(incident.longitude)]}
                                                radius={7}
                                                pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.8, weight: 2 }}
                                            >
                                                <Popup pane="popupPane">
                                                    <div style={{ minWidth: '220px', maxHeight: '250px', overflowY: 'auto' }}>
                                                        {incident.photoUrl && <img src={incident.photoUrl?.startsWith('http') ? incident.photoUrl : `${BACKEND_URL}${incident.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(incident.photoUrl?.startsWith('http') ? incident.photoUrl : `${BACKEND_URL}${incident.photoUrl}`)} />}
                                                        <div className="flex items-center gap-2 mb-2 border-b pb-2">
                                                            <Flame className="w-4 h-4 text-red-500" />
                                                            <strong className="text-sm">Incident #{incident.id}</strong>
                                                        </div>
                                                        <p className="text-xs mb-1"><strong>Barangay:</strong> {incident.barangay}</p>
                                                        <p className="text-xs mb-1"><strong>Date:</strong> {incident.incidentDate}</p>
                                                        <p className="text-xs mb-1"><strong>Time:</strong> {incident.incidentTime}</p>
                                                        <p className="text-xs mb-1"><strong>Cause:</strong> {incident.cause || 'N/A'}</p>
                                                        <p className="text-xs mb-1"><strong>Property:</strong> {incident.propertyType || 'N/A'}</p>
                                                        <p className="text-xs mb-1"><strong>Damage:</strong> ₱{damage.toLocaleString()}</p>
                                                        <p className="text-xs mb-1"><strong>Casualties:</strong> {incident.casualties || 0} | <strong>Injuries:</strong> {incident.injuries || 0}</p>
                                                        {incident.landmark && <p className="text-xs"><strong>Landmark:</strong> {incident.landmark}</p>}
                                                    </div>
                                                </Popup>
                                            </CircleMarker>
                                        );
                                    })}
                                </Pane>
                            )}

                            {/* Fire hydrants */}
                            {showHydrants && filteredHydrants.map((h) => (
                                <Marker key={`hyd-${h.id}`} position={[Number(h.lat), Number(h.lng)]} icon={hydrantIcon}>
                                    <Popup>
                                        {h.photoUrl && <img src={h.photoUrl?.startsWith('http') ? h.photoUrl : `${BACKEND_URL}${h.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(h.photoUrl?.startsWith('http') ? h.photoUrl : `${BACKEND_URL}${h.photoUrl}`)} />}
                                        <div className="flex items-center gap-1 mb-1">
                                            <Droplet className="w-4 h-4 text-blue-500" />
                                            <strong>{h.name}</strong>
                                        </div>
                                        <span className="text-xs text-gray-500">{h.description}</span>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* BFP station */}
                            {showStations && filteredStations.map((s) => (
                                <Marker key={`stn-${s.id}`} position={[Number(s.lat), Number(s.lng)]} icon={stationIcon}>
                                    <Popup>
                                        {s.photoUrl && <img src={s.photoUrl?.startsWith('http') ? s.photoUrl : `${BACKEND_URL}${s.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(s.photoUrl?.startsWith('http') ? s.photoUrl : `${BACKEND_URL}${s.photoUrl}`)} />}
                                        <div className="flex items-center gap-1 mb-1">
                                            <ShieldPlus className="w-4 h-4 text-green-600" />
                                            <strong>{s.name}</strong>
                                        </div>
                                        <span className="text-xs text-gray-500">{s.contact}</span>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
              </div>

              {/* Risk Detail Panel */}
              {selectedRiskZone && (
                <div className="w-1/3">
                  <RiskDetailPanel zone={selectedRiskZone} onClose={() => setSelectedRiskZone(null)} />
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 bg-white border rounded-xl p-4 flex flex-wrap gap-6 text-sm shadow-sm">
                <span className="font-semibold text-gray-700">Markers:</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" /> Incident</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block" /> Hydrant</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-green-500 inline-block" /> Station</span>
                <span className="w-px h-5 bg-gray-200" />
                <span className="font-semibold text-gray-700">Risk Zones:</span>
                <RiskLegendItems />
            </div>

            {/* Full Screen Image Modal */}
            {fullImageUrl && (
                <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setFullImageUrl(null)}>
                    <button className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full transition" onClick={() => setFullImageUrl(null)}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <img src={fullImageUrl} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain cursor-default" onClick={(e) => e.stopPropagation()} alt="Full screen preview" />
                </div>
            )}
        </div>
    );
}
