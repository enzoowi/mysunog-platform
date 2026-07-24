import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Map as MapIcon, Droplet, ShieldPlus } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

// Fix default Leaflet marker icons in Vite/React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const hydrantIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const stationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

type Incident = {
    id: number; incidentDate: string; incidentTime: string; barangay: string;
    cause?: string; latitude: number; longitude: number; estimatedDamage?: number;
    casualties?: number; injuries?: number; photoUrl?: string;
};

type Hydrant = { id: number; name: string; lat: number; lng: number; description?: string; photoUrl?: string; };
type Station = { id: number; name: string; lat: number; lng: number; contact?: string; photoUrl?: string; };

export default function IncidentMap() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [hydrants, setHydrants] = useState<Hydrant[]>([]);
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedBarangay, setSelectedBarangay] = useState('All');
    const [showHydrants, setShowHydrants] = useState(true);
    const [showStations, setShowStations] = useState(true);
    const [showIncidents, setShowIncidents] = useState(true);
    const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        async function fetchUserRole() {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const res = await api.get('/auth/me');
                // Show incident markers only for BFP personnel (staff and admin)
                if (res.data.role === 'admin' || res.data.role === 'bfp_staff') {
                    setIsAdmin(true);
                }
            }
        } catch {
            // Ignore
        }
    }
        fetchUserRole();

        async function fetchAll() {
            setLoading(true);
            try {
                // Fetch map assets for all users
                const [hyd, stn] = await Promise.all([
                    api.get('/map/hydrants'),
                    api.get('/map/stations')
                ]);
                setHydrants(hyd.data);
                setStations(stn.data);

                // Incident data is confidential — only fetch for BFP personnel
                const token = localStorage.getItem('token');
                if (token) {
                    try {
                        const inc = await api.get('/incidents');
                        setIncidents(inc.data);
                    } catch {
                        // Not authorized or not BFP personnel — leave incidents empty
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchAll();
    }, []);

    const barangayOptions = Array.from(
        new Set(incidents.map((i) => i.barangay).filter(Boolean)),
    ).sort();
    barangayOptions.unshift('All');

    const filteredIncidents = selectedBarangay === 'All' 
        ? incidents 
        : incidents.filter((i) => i.barangay === selectedBarangay);

    const defaultCenter: [number, number] = [14.0412, 121.1583];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
                <MapIcon className="w-8 h-8 text-blue-700" />
                <h2 className="text-2xl font-bold text-gray-800">Interactive Community Map</h2>
            </div>
            <p className="text-gray-600 mb-4">Visualize {isAdmin ? 'fire incidents, ' : ''}hydrants, and BFP stations in Malvar.</p>

            <div className="flex flex-wrap gap-4 mb-4 items-center">
                <div>
                    <label className="text-sm font-medium text-gray-700 mr-2">Barangay:</label>
                    <select value={selectedBarangay} onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm">
                        {barangayOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                {isAdmin && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={showIncidents} onChange={(e) => setShowIncidents(e.target.checked)} />
                        🔴 Incidents ({filteredIncidents.length})
                    </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showHydrants} onChange={(e) => setShowHydrants(e.target.checked)} />
                    🔵 Hydrants
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
                    🟢 BFP Stations
                </label>
            </div>

            {loading ? (
                <p>Loading map data...</p>
            ) : (
                <MapContainer center={defaultCenter} zoom={13}
                    maxBounds={[[13.98, 121.08], [14.10, 121.25]]} minZoom={13}
                    style={{ height: '550px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Incident markers */}
                    {isAdmin && showIncidents && filteredIncidents.map((incident) => (
                        <CircleMarker key={`inc-${incident.id}`}
                            center={[Number(incident.latitude), Number(incident.longitude)]}
                            radius={6}
                            pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.8 }}>
                            <Popup>
                                <div style={{ minWidth: '200px' }}>
                                    {incident.photoUrl && <img src={`${BACKEND_URL}${incident.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(`${BACKEND_URL}${incident.photoUrl}`)} />}
                                    <p><strong>Barangay:</strong> {incident.barangay}</p>
                                    <p><strong>Date:</strong> {incident.incidentDate}</p>
                                    <p><strong>Time:</strong> {incident.incidentTime}</p>
                                    <p><strong>Cause:</strong> {incident.cause || 'N/A'}</p>
                                    <p><strong>Damage:</strong> ₱{incident.estimatedDamage ?? 0}</p>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))}

                    {/* Fire hydrants */}
                    {showHydrants && hydrants.map((h) => (
                        <Marker key={`hyd-${h.id}`} position={[Number(h.lat), Number(h.lng)]} icon={hydrantIcon}>
                            <Popup>
                                {h.photoUrl && <img src={`${BACKEND_URL}${h.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(`${BACKEND_URL}${h.photoUrl}`)} />}
                                <div className="flex items-center gap-1 mb-1">
                                    <Droplet className="w-4 h-4 text-blue-500" />
                                    <strong>{h.name}</strong>
                                </div>
                                <span className="text-xs text-gray-500">{h.description}</span>
                            </Popup>
                        </Marker>
                    ))}

                    {/* BFP stations */}
                    {showStations && stations.map((s) => (
                        <Marker key={`stn-${s.id}`} position={[Number(s.lat), Number(s.lng)]} icon={stationIcon}>
                            <Popup>
                                {s.photoUrl && <img src={`${BACKEND_URL}${s.photoUrl}`} alt="" className="w-full h-32 object-cover rounded mb-2 cursor-pointer hover:opacity-90 transition" onClick={() => setFullImageUrl(`${BACKEND_URL}${s.photoUrl}`)} />}
                                <div className="flex items-center gap-1 mb-1">
                                    <ShieldPlus className="w-4 h-4 text-green-600" />
                                    <strong>{s.name}</strong>
                                </div>
                                <span className="text-xs text-gray-500">{s.contact}</span>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            )}

            {/* Legend */}
            <div className="mt-4 bg-white border rounded-xl p-4 flex flex-wrap gap-6 text-sm">
                <span className="font-semibold">Legend:</span>
                {isAdmin && (
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Fire Incident</span>
                )}
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Fire Hydrant</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> BFP Station</span>
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