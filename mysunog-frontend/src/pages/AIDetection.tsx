import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { useDetectionSocket } from '../hooks/useDetectionSocket';
import {
  ArrowLeft, Zap, Tv2, Plus, Trash2, X, RefreshCw, Maximize2, Mail
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const createPin = (color: string) => `<svg viewBox="0 0 24 36" width="24" height="36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 7.872 11.233 23.36 11.602 23.86a.5.5 0 0 0 .796 0C12.767 35.36 24 19.872 24 12c0-6.627-5.373-12-12-12zm0 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`;
const cameraIcon = new L.DivIcon({
    html: createPin('#a855f7'),
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
});

function MapClickHandler({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || `http://${window.location.hostname}:8000`;

type Camera = {
  id: number;
  name: string;
  location: string;
  streamUrl: string;
  type: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
};

export default function AIDetection() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cameras State
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [streamStatuses, setStreamStatuses] = useState<Record<string, any>>({});
  
  // Add Camera Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Expanded Camera Modal
  const [expandedCamera, setExpandedCamera] = useState<Camera | null>(null);

  const [newCamera, setNewCamera] = useState<{
    name: string;
    location: string;
    streamUrl: string;
    type: string;
    isActive: boolean;
    latitude: number | null;
    longitude: number | null;
  }>({
    name: '',
    location: '',
    streamUrl: '',
    type: 'rtsp',
    isActive: true,
    latitude: null,
    longitude: null,
  });


  // Email Alerts Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<{ id: number; emailAddress: string; name: string }[]>([]);
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [newEmailName, setNewEmailName] = useState('');
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { latestAlert, clearLatestAlert } = useDetectionSocket();

  useEffect(() => {
    if (latestAlert) {
      const timer = setTimeout(() => {
        clearLatestAlert();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert, clearLatestAlert]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/', { replace: true }); return; }
    api.get('/auth/me')
      .then((res) => {
        const role = res.data.role;
        if (role === 'admin' || role === 'bfp_staff' || role === 'fire_investigator') setAuthorized(true);
        else { navigate('/', { replace: true }); }
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  useEffect(() => {
    if (!authorized) return;
    Promise.all([fetchHealth(), fetchCameras()])
      .finally(() => setLoading(false));

    // Poll stream statuses
    pollRef.current = setInterval(fetchStreamStatuses, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [authorized]);


  async function fetchHealth() {
    try {
      const res = await api.get('/detection/health');
      setAiHealth(res.data);
    } catch {
      setAiHealth({ status: 'unavailable', model_loaded: false });
    }
  }

  async function fetchCameras() {
    try {
      const res = await api.get('/detection/cameras');
      setCameras(res.data.filter((c: Camera) => c.type !== 'webcam'));
      fetchStreamStatuses();
    } catch { /* ignore */ }
  }

  async function fetchStreamStatuses() {
    try {
      const res = await api.get('/detection/stream/status');
      setStreamStatuses(res.data);
    } catch { /* ignore */ }
  }

  async function handleAddCamera(e: React.FormEvent) {
    e.preventDefault();
    if (!newCamera.name || !newCamera.streamUrl) return;
    
    setIsAdding(true);
    try {
      await api.post('/detection/cameras', newCamera);
      setShowAddModal(false);
      setNewCamera({ name: '', location: '', streamUrl: '', type: 'rtsp', isActive: true, latitude: null, longitude: null });
      await fetchCameras();
    } catch (err) {
      alert('Failed to add camera');
    } finally {
      setIsAdding(false);
    }
  }


  async function handleDeleteCamera(id: number) {
    if (!window.confirm('Are you sure you want to delete this camera? It will stop AI detection for it.')) return;
    try {
      await api.delete(`/detection/cameras/${id}`);
      setCameras(prev => prev.filter(c => c.id !== id));
      await fetchStreamStatuses();
    } catch (err) {
      alert('Failed to delete camera');
    }
  }

  async function fetchEmailRecipients() {
    try {
      const res = await api.get('/email-alerts/recipients');
      setEmailRecipients(res.data);
    } catch (err) {
      console.error('Failed to fetch Email recipients', err);
    }
  }

  async function handleAddEmailRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmailAddress) return;
    setIsAddingEmail(true);
    try {
      await api.post('/email-alerts/recipients', { emailAddress: newEmailAddress, name: newEmailName });
      setNewEmailAddress('');
      setNewEmailName('');
      await fetchEmailRecipients();
    } catch (err) {
      alert('Failed to add Email recipient');
    } finally {
      setIsAddingEmail(false);
    }
  }

  async function handleDeleteEmailRecipient(id: number) {
    try {
      await api.delete(`/email-alerts/recipients/${id}`);
      await fetchEmailRecipients();
    } catch (err) {
      alert('Failed to delete Email recipient');
    }
  }

  // Fetch Email recipients when modal opens
  useEffect(() => {
    if (showEmailModal) {
      fetchEmailRecipients();
    }
  }, [showEmailModal]);

  if (loading) return <div className="p-6">Loading Multi-Camera AI Dashboard...</div>;



  return (
    <div className="p-6 max-w-7xl mx-auto">


      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2.5 rounded-xl">
            <Tv2 className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Multi-Camera AI Detection</h2>
            <p className="text-sm text-gray-500">Continuous AI monitoring of multiple CCTV streams</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            aiHealth?.model_loaded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <Zap className="w-3.5 h-3.5" />
            {aiHealth?.model_loaded ? 'AI Ready' : 'Connecting AI...'}
          </div>
        </div>
      </div>


      <div className="flex justify-between items-center mb-4 mt-8">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Tv2 className="w-5 h-5 text-gray-500" /> Monitored Cameras ({cameras.length})
        </h3>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setShowEmailModal(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Mail className="w-4 h-4" /> Email Alerts
            </button>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Add Camera
          </button>
        </div>
      </div>

      {/* Cameras Grid */}
      {cameras.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-500">
          <Tv2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-semibold">No Cameras Configured</p>
          <p className="text-sm mt-1 mb-4">Add your CCTV RTSP/HTTP streams to begin continuous AI monitoring.</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Add First Camera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cameras.map(cam => {
            const status = streamStatuses[cam.id.toString()];
            const isLive = status?.connected === true;
            return (
              <div key={cam.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col relative group cursor-pointer" onClick={() => setExpandedCamera(cam)}>
                {/* Camera Viewer */}
                <div className="bg-gray-950 aspect-video relative flex items-center justify-center">
                  {isLive && expandedCamera?.id !== cam.id ? (
                    <img 
                      src={`${AI_SERVICE_URL}/stream/mjpeg/${cam.id}?detect=true&fps=3&quality=50`} 
                      className="w-full h-full object-contain"
                      alt={cam.name}
                      loading="lazy"
                    />
                  ) : isLive && expandedCamera?.id === cam.id ? (
                    <div className="text-center px-4">
                      <Tv2 className="w-10 h-10 mx-auto text-gray-700 mb-2" />
                      <p className="text-xs text-gray-400 uppercase tracking-widest">Viewing in fullscreen</p>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      <Tv2 className="w-10 h-10 mx-auto text-gray-700 mb-2" />
                      <p className="text-xs text-gray-500 uppercase tracking-widest">Signal Lost / Connecting</p>
                      {status?.error && (
                        <p className="text-[10px] text-red-400 mt-1 break-all">{status.error}</p>
                      )}
                    </div>
                  )}
                  {/* Status Overlay */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isLive ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full bg-white ${isLive ? 'animate-pulse' : ''}`} />
                      {isLive ? 'Live AI' : 'Offline'}
                    </span>
                  </div>
                  {/* Hover Expand Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                {/* Camera Details */}
                <div className="p-4 flex flex-col flex-1" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-gray-800 text-sm cursor-pointer" onClick={() => setExpandedCamera(cam)}>{cam.name}</h4>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCamera(cam.id); }}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title="Delete Camera"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{cam.location || (cam.latitude ? `Pinned at ${Number(cam.latitude).toFixed(4)}, ${Number(cam.longitude).toFixed(4)}` : 'No location set')}</p>
                  
                  <div className="mt-auto">
                    <div className="bg-gray-50 border rounded px-2.5 py-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide text-[11px] font-mono text-gray-600">
                      {cam.streamUrl}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">Add External Camera</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCamera} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Camera Name</label>
                <input 
                  type="text" required
                  value={newCamera.name} onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Lobby Entrance"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location Name (Optional)</label>
                <input 
                  type="text" 
                  value={newCamera.location || ''} onChange={e => setNewCamera({...newCamera, location: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Main Building Ground Floor"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location (Pin on Map)</label>
                <p className="text-xs text-gray-500 mb-2">Click on the map to set the exact location for the camera in Malvar, Batangas.</p>
                <div className="h-[250px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
                  <MapContainer center={[14.0412, 121.1583]} zoom={14} className="h-full w-full">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    <MapClickHandler onPlace={(lat, lng) => setNewCamera({ ...newCamera, latitude: lat, longitude: lng })} />
                    {newCamera.latitude && newCamera.longitude && (
                      <Marker position={[newCamera.latitude, newCamera.longitude]} icon={cameraIcon} />
                    )}
                  </MapContainer>
                </div>
                {newCamera.latitude ? (
                  <p className="text-xs text-green-600 mt-1 font-medium">Location pinned successfully!</p>
                ) : (
                  <p className="text-xs text-orange-500 mt-1">Please pin a location on the map.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Stream URL (RTSP / HTTP)</label>
                <input 
                  type="text" required
                  value={newCamera.streamUrl} onChange={e => setNewCamera({...newCamera, streamUrl: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500"
                  placeholder="rtsp://admin:pass@192.168.1.100:554/stream"
                />
              </div>
              <div className="bg-purple-50 text-purple-800 p-3 rounded-lg text-xs">
                When added, the AI service will immediately connect to this stream and begin 24/7 background fire detection.
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={isAdding} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70">
                  {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isAdding ? 'Adding...' : 'Add Camera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Expanded Camera Modal */}
      {expandedCamera && (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 lg:p-8 backdrop-blur-sm">
          <div className="w-full max-w-7xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 text-white">
              <div>
                <h3 className="font-bold text-xl md:text-2xl flex items-center gap-2">
                  {expandedCamera.name}
                  {streamStatuses[expandedCamera.id.toString()]?.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live AI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                      Offline
                    </span>
                  )}
                </h3>
                <p className="text-gray-400 text-sm mt-1">{expandedCamera.location || (expandedCamera.latitude ? `Pinned at ${Number(expandedCamera.latitude).toFixed(4)}, ${Number(expandedCamera.longitude).toFixed(4)}` : 'No location set')}</p>
              </div>
              <button 
                onClick={() => setExpandedCamera(null)} 
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex items-center justify-center">
              {streamStatuses[expandedCamera.id.toString()]?.connected ? (
                <img 
                  src={`${AI_SERVICE_URL}/stream/mjpeg/${expandedCamera.id}?detect=true&fps=5&quality=65`} 
                  className="w-full h-full object-contain"
                  alt={expandedCamera.name}
                />
              ) : (
                <div className="text-center px-6">
                  <Tv2 className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                  <p className="text-lg text-gray-500 uppercase tracking-widest font-semibold">Signal Lost / Connecting</p>
                  {streamStatuses[expandedCamera.id.toString()]?.error && (
                    <p className="text-sm text-red-400 mt-2 break-all">{streamStatuses[expandedCamera.id.toString()].error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Alerts Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-500" /> Email Alert Recipients
              </h3>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">
                These addresses will receive an automated email whenever smoke or fire is detected with a confidence level of 70% or higher.
              </p>
              
              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Recipients ({emailRecipients.length})</h4>
                {emailRecipients.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 border border-dashed rounded-lg text-sm text-gray-400">
                    No email addresses added yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {emailRecipients.map(recipient => (
                      <li key={recipient.id} className="flex justify-between items-center bg-gray-50 border px-4 py-3 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-800">{recipient.emailAddress}</p>
                          {recipient.name && <p className="text-xs text-gray-500">{recipient.name}</p>}
                        </div>
                        <button 
                          onClick={() => handleDeleteEmailRecipient(recipient.id)}
                          className="text-gray-400 hover:text-red-500 p-1 transition"
                          title="Remove recipient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleAddEmailRecipient} className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <h4 className="text-sm font-bold text-purple-800 mb-3">Add New Recipient</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Name (Optional)</label>
                    <input 
                      type="text" 
                      value={newEmailName} onChange={e => setNewEmailName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                    <input 
                      type="email" required
                      value={newEmailAddress} onChange={e => setNewEmailAddress(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isAddingEmail || !newEmailAddress} className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 transition">
                  {isAddingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isAddingEmail ? 'Adding...' : 'Add Recipient'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
