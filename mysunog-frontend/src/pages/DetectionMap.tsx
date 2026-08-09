import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, LayersControl, TileLayer,  Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Map as MapIcon, Eye, Flame, Wind, Filter } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useDetectionSocket } from '../hooks/useDetectionSocket';
import { incidentIcon, cameraIcon } from '../components/MapIcons';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


type DetectionEvent = {
  id: number;
  detectionType: string;
  confidence: number;
  severity: string;
  cameraSource: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

type Camera = {
  id: number;
  name: string;
  location: string;
  type: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
};

export default function DetectionMap() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');

  // Live alerts from WebSocket — auto-refresh on new detections
  const { latestAlert } = useDetectionSocket();

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/', { replace: true }); return; }
    api.get('/auth/me')
      .then((res) => { if (res.data.role !== 'admin') navigate('/', { replace: true }); })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [eventsRes, camerasRes] = await Promise.all([
          api.get('/detection/events?limit=100'),
          api.get('/detection/cameras'),
        ]);
        setEvents(eventsRes.data);
        setCameras(camerasRes.data);
      } catch (err) {
        console.error('Failed to fetch detection data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [latestAlert]); // Re-fetch when new alert arrives

  // Filter events with valid coordinates
  const mappableEvents = events
    .filter((e) => e.latitude && e.longitude)
    .filter((e) => severityFilter === 'all' || e.severity === severityFilter);

  const mappableCameras = cameras.filter((c) => c.latitude && c.longitude);

  const defaultCenter: [number, number] = [14.0412, 121.1583];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/admin/ai-detection" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to AI Detection
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-100 p-2.5 rounded-xl">
          <MapIcon className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">AI Detection Map</h2>
          <p className="text-sm text-gray-500">Visualize fire & smoke detections and camera locations</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showDetections} onChange={(e) => setShowDetections(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
            🔴 Detections ({mappableEvents.length})
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showCameras} onChange={(e) => setShowCameras(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" />
            🟣 Cameras ({mappableCameras.length})
          </label>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <span className="ml-auto text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {mappableEvents.length} detection(s) on map
          </span>
        </div>
      </div>

      {/* Map */}
      {loading ? (
        <div className="flex items-center justify-center h-96 bg-white border rounded-xl">
          <p className="text-gray-500">Loading detection map...</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <MapContainer
            center={defaultCenter}
            zoom={13}
            maxBounds={[[13.98, 121.08], [14.10, 121.25]]}
            minZoom={12}
            style={{ height: '550px', width: '100%' }}
          >
            <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>

            {/* Detection markers */}
            {showDetections && mappableEvents.map((event) => {
                            
              return (
                <Marker 
                  key={`det-${event.id}`}
                  position={[Number(event.latitude), Number(event.longitude)]}
                  
                  
                 icon={incidentIcon}>
                  <Popup>
                    <div style={{ minWidth: '220px' }}>
                      <div className="flex items-center gap-2 mb-2 border-b pb-2">
                        {event.detectionType === 'fire'
                          ? <Flame className="w-4 h-4 text-red-500" />
                          : <Wind className="w-4 h-4 text-gray-500" />
                        }
                        <strong className="text-sm">
                          AI Detection #{event.id}
                        </strong>
                      </div>
                      <p className="text-xs mb-1"><strong>Type:</strong> {event.detectionType}</p>
                      <p className="text-xs mb-1"><strong>Confidence:</strong> {(Number(event.confidence) * 100).toFixed(0)}%</p>
                      <p className="text-xs mb-1"><strong>Severity:</strong> {event.severity.toUpperCase()}</p>
                      <p className="text-xs mb-1"><strong>Source:</strong> {event.cameraSource}</p>
                      <p className="text-xs"><strong>Time:</strong> {new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Camera markers */}
            {showCameras && mappableCameras.map((cam) => (
              <Marker
                key={`cam-${cam.id}`}
                position={[Number(cam.latitude), Number(cam.longitude)]}
                icon={cameraIcon}
              >
                <Popup>
                  <div className="flex items-center gap-1 mb-1">
                    <Eye className="w-4 h-4 text-purple-600" />
                    <strong>{cam.name}</strong>
                  </div>
                  <p className="text-xs text-gray-500">{cam.location}</p>
                  <p className="text-xs text-gray-500">Type: {cam.type}</p>
                  <p className={`text-xs font-medium ${cam.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {cam.isActive ? '● Active' : '○ Inactive'}
                  </p>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 bg-white border rounded-xl p-4 flex flex-wrap gap-6 text-sm shadow-sm">
        <span className="font-semibold text-gray-700">Legend:</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-green-500 inline-block" /> Low Severity</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-yellow-500 inline-block" /> Medium Severity</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-orange-500 inline-block" /> High Severity</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block" /> Critical Severity</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-purple-500 inline-block" /> Camera</span>
      </div>

    </div>
  );
}
