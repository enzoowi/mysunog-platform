import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { useDetectionSocket } from '../hooks/useDetectionSocket';
import {
  ArrowLeft, Zap, Tv2, Plus, Trash2, X, RefreshCw, Maximize2, Loader,
  Upload, Film, Square, Play, Smartphone, Edit2, Save, FlameKindling
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { MapContainer, LayersControl, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { cameraIcon } from '../components/MapIcons';

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


  // SMS Alerts Modal
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState<{ id: number; phoneNumber: string; name: string }[]>([]);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newSmsName, setNewSmsName] = useState('');
  const [isAddingSms, setIsAddingSms] = useState(false);

  const [editingSmsId, setEditingSmsId] = useState<number | null>(null);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editSmsName, setEditSmsName] = useState('');
  const [isEditingSms, setIsEditingSms] = useState(false);

  // Video Upload State
  const [videoUploading, setVideoUploading] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoName, setActiveVideoName] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Per-camera AI detection toggle — persisted to localStorage so App.tsx
  // can suppress notifications/sounds for disabled cameras.
  const STORAGE_KEY = 'ai_detection_disabled_cameras';

  function getDisabledCameraIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }

  const [detectionEnabled, setDetectionEnabled] = useState<Record<number, boolean>>(() => {
    const disabled = getDisabledCameraIds();
    // We'll populate real camera-specific entries once cameras load
    const initial: Record<number, boolean> = {};
    disabled.forEach(id => { initial[parseInt(id)] = false; });
    return initial;
  });

  function isDetectionEnabled(camId: number): boolean {
    return detectionEnabled[camId] !== false; // default ON
  }

  function toggleDetection(e: React.MouseEvent, camId: number) {
    e.stopPropagation();
    const nowEnabled = !isDetectionEnabled(camId);
    setDetectionEnabled(prev => ({ ...prev, [camId]: nowEnabled }));

    // Persist to localStorage
    const disabled = getDisabledCameraIds();
    if (!nowEnabled) {
      disabled.add(String(camId));
    } else {
      disabled.delete(String(camId));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(disabled)));
  }

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

  async function fetchSmsRecipients() {
    try {
      const res = await api.get('/sms-alerts/recipients');
      setSmsRecipients(res.data);
    } catch (err) {
      console.error('Failed to fetch SMS recipients', err);
    }
  }

  async function handleAddSmsRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhoneNumber) return;
    setIsAddingSms(true);
    try {
      await api.post('/sms-alerts/recipients', { phoneNumber: newPhoneNumber, name: newSmsName });
      setNewPhoneNumber('');
      setNewSmsName('');
      await fetchSmsRecipients();
    } catch (err) {
      alert('Failed to add SMS recipient');
    } finally {
      setIsAddingSms(false);
    }
  }

  async function handleDeleteSmsRecipient(id: number) {
    try {
      await api.delete(`/sms-alerts/recipients/${id}`);
      await fetchSmsRecipients();
    } catch (err) {
      alert('Failed to delete SMS recipient');
    }
  }

  async function handleUpdateSmsRecipient(id: number) {
    if (!editPhoneNumber) return;
    setIsEditingSms(true);
    try {
      await api.put(`/sms-alerts/recipients/${id}`, { phoneNumber: editPhoneNumber, name: editSmsName });
      setEditingSmsId(null);
      await fetchSmsRecipients();
    } catch (err) {
      alert('Failed to update SMS recipient');
    } finally {
      setIsEditingSms(false);
    }
  }

  function startEditingSms(recipient: { id: number; phoneNumber: string; name: string }) {
    setEditingSmsId(recipient.id);
    setEditPhoneNumber(recipient.phoneNumber);
    setEditSmsName(recipient.name || '');
  }

  // Fetch SMS recipients when modal opens
  useEffect(() => {
    if (showSmsModal) {
      fetchSmsRecipients();
    }
  }, [showSmsModal]);

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('camera_name', file.name);
      const res = await axios.post(`${AI_SERVICE_URL}/video/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setActiveVideoId(res.data.video_id);
        setActiveVideoName(file.name);
      } else {
        alert('Failed to upload video: ' + (res.data.message || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to upload video: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  async function handleStopVideo() {
    if (!activeVideoId) return;
    try {
      await axios.delete(`${AI_SERVICE_URL}/video/stop/${activeVideoId}`);
    } catch { /* ignore */ }
    setActiveVideoId(null);
    setActiveVideoName(null);
    setExpandedVideoId(null);
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader className="w-12 h-12 animate-spin text-purple-600" />
      <p className="text-gray-500 font-medium animate-pulse">Loading Multi-Camera AI Dashboard...</p>
    </div>
  );



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
              onClick={() => setShowSmsModal(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Smartphone className="w-4 h-4" /> SMS Alerts
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add Camera
            </button>
          )}
        </div>
      </div>

      {/* Cameras Grid */}
      {cameras.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-500">
          <Tv2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-semibold">No Cameras Configured</p>
          <p className="text-sm mt-1 mb-4">Add your CCTV RTSP/HTTP streams to begin continuous AI monitoring.</p>
          {isAdmin && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add First Camera
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cameras.map(cam => {
            const status = streamStatuses[cam.id.toString()];
            const isLive = status?.connected === true;
            const detectionOn = isDetectionEnabled(cam.id);
            return (
              <div key={cam.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col relative group cursor-pointer" onClick={() => setExpandedCamera(cam)}>
                {/* Camera Viewer */}
                <div className="bg-gray-950 aspect-video relative flex items-center justify-center">
                  {isLive && expandedCamera?.id !== cam.id ? (
                    <img 
                      src={`${AI_SERVICE_URL}/stream/mjpeg/${cam.id}?detect=${detectionOn}&fps=10&quality=50`} 
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
                  {/* AI Detection badge overlay */}
                  {isLive && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        detectionOn
                          ? 'bg-orange-500/90 text-white'
                          : 'bg-gray-600/80 text-gray-300'
                      }`}>
                        <FlameKindling className="w-3 h-3" />
                        {detectionOn ? 'AI ON' : 'AI OFF'}
                      </span>
                    </div>
                  )}
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
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCamera(cam.id); }}
                        className="text-gray-400 hover:text-red-500 transition p-1"
                        title="Delete Camera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{cam.location || (cam.latitude ? `Pinned at ${Number(cam.latitude).toFixed(4)}, ${Number(cam.longitude).toFixed(4)}` : 'No location set')}</p>
                  
                  {/* AI Detection Toggle */}
                  <div className="flex items-center justify-between mb-3 bg-gray-50 border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FlameKindling className={`w-4 h-4 ${detectionOn ? 'text-orange-500' : 'text-gray-400'}`} />
                      <span className="text-xs font-semibold text-gray-700">AI Fire & Smoke Detection</span>
                    </div>
                    <button
                      id={`ai-toggle-${cam.id}`}
                      onClick={(e) => toggleDetection(e, cam.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 ${
                        detectionOn ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={detectionOn}
                      title={detectionOn ? 'Disable AI Detection' : 'Enable AI Detection'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        detectionOn ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

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

      {/* Video Upload Section */}
      <div className="mt-10 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Film className="w-5 h-5 text-gray-500" /> Video Analysis
          </h3>
        </div>

        {!activeVideoId ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-purple-300 transition">
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-base font-semibold text-gray-700 mb-1">Upload Video for AI Detection</p>
            <p className="text-sm text-gray-500 mb-4">Upload a video file to run fire & smoke detection with live bounding boxes.</p>
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,.avi,.mov,.mkv,.webm"
              onChange={handleVideoUpload}
              className="hidden"
              id="video-upload-input"
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={videoUploading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition disabled:opacity-70"
            >
              {videoUploading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Choose Video File</>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-3">Supported: MP4, AVI, MOV, MKV, WebM</p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-950 aspect-video relative flex items-center justify-center cursor-pointer group" onClick={() => setExpandedVideoId(activeVideoId)}>
              <img
                src={`${AI_SERVICE_URL}/stream/mjpeg/${activeVideoId}?detect=true&fps=15&quality=60`}
                className="w-full h-full object-contain"
                alt="Video Analysis"
              />
              <div className="absolute top-2 left-2 z-10">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/90 text-white">
                  <Play className="w-3 h-3" /> AI Analysis
                </span>
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                  <Maximize2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-500" />
                  {activeVideoName || 'Uploaded Video'}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">AI detection is running on every frame</p>
              </div>
              <button
                onClick={handleStopVideo}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Video Modal */}
      {expandedVideoId && (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 lg:p-8 backdrop-blur-sm">
          <div className="w-full max-w-7xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 text-white">
              <div>
                <h3 className="font-bold text-xl md:text-2xl flex items-center gap-2">
                  {activeVideoName || 'Video Analysis'}
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Play className="w-3 h-3" /> AI Analysis
                  </span>
                </h3>
                <p className="text-gray-400 text-sm mt-1">Video playback with real-time fire & smoke detection</p>
              </div>
              <button
                onClick={() => setExpandedVideoId(null)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex items-center justify-center">
              <img
                src={`${AI_SERVICE_URL}/stream/mjpeg/${expandedVideoId}?detect=true&fps=15&quality=70`}
                className="w-full h-full object-contain"
                alt="Video Analysis Fullscreen"
              />
            </div>
          </div>
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
                    <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>
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
            
            {/* AI Detection Toggle in expanded modal */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FlameKindling className={`w-4 h-4 ${isDetectionEnabled(expandedCamera.id) ? 'text-orange-400' : 'text-gray-500'}`} />
                <span className="text-sm font-semibold text-gray-300">AI Fire & Smoke Detection</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  isDetectionEnabled(expandedCamera.id) ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'
                }`}>
                  {isDetectionEnabled(expandedCamera.id) ? 'ON' : 'OFF'}
                </span>
              </div>
              <button
                id={`ai-toggle-expanded-${expandedCamera.id}`}
                onClick={(e) => toggleDetection(e, expandedCamera.id)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  isDetectionEnabled(expandedCamera.id) ? 'bg-orange-500' : 'bg-gray-600'
                }`}
                role="switch"
                aria-checked={isDetectionEnabled(expandedCamera.id)}
                title={isDetectionEnabled(expandedCamera.id) ? 'Disable AI Detection' : 'Enable AI Detection'}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  isDetectionEnabled(expandedCamera.id) ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex-1 bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex items-center justify-center">
              {streamStatuses[expandedCamera.id.toString()]?.connected ? (
                <img 
                  src={`${AI_SERVICE_URL}/stream/mjpeg/${expandedCamera.id}?detect=${isDetectionEnabled(expandedCamera.id)}&fps=15&quality=70`} 
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

      {/* SMS Alerts Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-gray-500" /> SMS Alert Recipients
              </h3>
              <button onClick={() => setShowSmsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">
                These mobile numbers will receive an automated SMS whenever smoke or fire is detected with a confidence level of 70% or higher.
              </p>
              
              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Recipients ({smsRecipients.length})</h4>
                {smsRecipients.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 border border-dashed rounded-lg text-sm text-gray-400">
                    No phone numbers added yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {smsRecipients.map(recipient => (
                      <li key={recipient.id} className="flex justify-between items-center bg-gray-50 border px-4 py-3 rounded-lg">
                        {editingSmsId === recipient.id ? (
                          <div className="flex-1 mr-4">
                            <div className="grid grid-cols-2 gap-2">
                              <input 
                                type="text"
                                value={editSmsName} onChange={e => setEditSmsName(e.target.value)}
                                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                                placeholder="Name (Optional)"
                              />
                              <input 
                                type="text"
                                value={editPhoneNumber} onChange={e => setEditPhoneNumber(e.target.value)}
                                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
                                placeholder="Phone (e.g. +63...)"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{recipient.phoneNumber}</p>
                            {recipient.name && <p className="text-xs text-gray-500">{recipient.name}</p>}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          {editingSmsId === recipient.id ? (
                            <>
                              <button 
                                onClick={() => handleUpdateSmsRecipient(recipient.id)}
                                disabled={isEditingSms || !editPhoneNumber}
                                className="text-green-600 hover:text-green-700 p-1 transition disabled:opacity-50"
                                title="Save changes"
                              >
                                {isEditingSms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => setEditingSmsId(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 transition"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => startEditingSms(recipient)}
                                className="text-gray-400 hover:text-blue-500 p-1 transition"
                                title="Edit recipient"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSmsRecipient(recipient.id)}
                                className="text-gray-400 hover:text-red-500 p-1 transition"
                                title="Remove recipient"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleAddSmsRecipient} className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <h4 className="text-sm font-bold text-purple-800 mb-3">Add New Recipient</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Name (Optional)</label>
                    <input 
                      type="text" 
                      value={newSmsName} onChange={e => setNewSmsName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                    <input 
                      type="text" required
                      value={newPhoneNumber} onChange={e => setNewPhoneNumber(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g. +639123456789"
                    />
                  </div>
                </div>
                <button type="submit" disabled={isAddingSms || !newPhoneNumber} className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70 transition">
                  {isAddingSms ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {isAddingSms ? 'Adding...' : 'Add Recipient'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
