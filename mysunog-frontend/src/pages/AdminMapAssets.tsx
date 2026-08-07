import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Droplet, ShieldPlus, Plus, Pencil, Trash2, X, Check, Upload, GripHorizontal } from 'lucide-react';
import { MapContainer, LayersControl, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icons
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

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;
const DEFAULT_CENTER: [number, number] = [14.0412, 121.1583];

type Tab = 'hydrants' | 'stations';

type Hydrant = { id: number; name: string; lat: number; lng: number; description?: string; photoUrl?: string; };
type Station = { id: number; name: string; lat: number; lng: number; contact?: string; photoUrl?: string; };

/** Click anywhere on the map to set coordinates */
function MapClickHandler({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPlace(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/** Draggable marker wrapper */
function DraggableMarker({
  position, icon, children, onDragEnd,
}: {
  position: [number, number];
  icon: L.Icon | L.DivIcon;
  children: React.ReactNode;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  return (
    <Marker
      position={position}
      icon={icon}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) {
            const ll = m.getLatLng();
            onDragEnd(ll.lat, ll.lng);
          }
        },
      }}>
      {children}
    </Marker>
  );
}

export default function AdminMapAssets() {
  const [tab, setTab] = useState<Tab>('hydrants');
  const [hydrants, setHydrants] = useState<Hydrant[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([
        api.get('/map/hydrants'),
        api.get('/map/stations'),
      ]);
      setHydrants(h.data);
      setStations(s.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, []);

  function resetForm() {
    setFormData({});
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditingId(null);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleMapPlace(lat: number, lng: number) {
    setFormData(p => ({ ...p, lat: lat.toFixed(7), lng: lng.toFixed(7) }));
  }

  async function handleDragEnd(type: Tab, id: number, lat: number, lng: number) {
    try {
      const body = new FormData();
      body.append('lat', lat.toFixed(7));
      body.append('lng', lng.toFixed(7));
      await api.patch(`/map/${type}/${id}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      await fetchAll();
    } catch (err) { console.error('Drag update failed', err); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(formData).forEach(([k, v]) => body.append(k, v));
      if (photoFile) body.append('photo', photoFile);

      const endpoint = `/map/${tab}`;
      if (editingId) {
        await api.patch(`${endpoint}/${editingId}`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(endpoint, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      resetForm();
      await fetchAll();
    } catch (err) { console.error(err); alert('Failed to save.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(type: Tab, id: number) {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/map/${type}/${id}`);
      await fetchAll();
    } catch (err) { console.error(err); }
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    const d: Record<string, string> = {};
    const editableFields = ['name', 'riskLevel', 'contact', 'description', 'lat', 'lng'];
    Object.entries(item).forEach(([k, v]) => { 
      if (editableFields.includes(k) && v !== null && v !== undefined) d[k] = String(v); 
    });
    setFormData(d);
    setPhotoPreview(item.photoUrl ? item.photoUrl?.startsWith('http') ? item.photoUrl : `${BACKEND_URL}${item.photoUrl}` : null);
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'hydrants', label: 'Fire Hydrants', icon: <Droplet className="w-4 h-4" /> },
    { key: 'stations', label: 'BFP Station', icon: <ShieldPlus className="w-4 h-4" /> },
  ];

  const currentItems = tab === 'hydrants' ? hydrants : stations;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <style>{`
        .leaflet-container {
          cursor: crosshair !important;
        }
        .leaflet-interactive {
          cursor: pointer !important;
        }
        .leaflet-dragging .leaflet-container,
        .leaflet-dragging .leaflet-interactive {
          cursor: grabbing !important;
        }
      `}</style>
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Manage Interactive Map Assets</h2>
      <p className="text-sm text-gray-500 mb-6">
        Add, edit, delete, and reposition fire hydrants, risk hotspots, and the BFP station.{' '}
        <span className="text-orange-600 font-medium">Drag markers on the map to update their position.</span>
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); resetForm(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition
              ${tab === t.key ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Map */}
        <div>
          <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
            <GripHorizontal className="w-4 h-4 text-orange-500" />
            Click map to set position for a new entry. Drag existing markers to reposition.
          </p>
          <MapContainer center={DEFAULT_CENTER} zoom={13}
            style={{ height: '460px', borderRadius: '12px', overflow: 'hidden' }}>
            <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
            </LayersControl.BaseLayer>
          </LayersControl>
            <MapClickHandler onPlace={handleMapPlace} />

            {tab === 'hydrants' && hydrants.filter(h => h.id !== editingId).map(h => (
              <DraggableMarker key={h.id} position={[Number(h.lat), Number(h.lng)]} icon={hydrantIcon}
                onDragEnd={(lat, lng) => handleDragEnd('hydrants', h.id, lat, lng)}>
                <Popup>
                  {h.photoUrl && <img src={h.photoUrl?.startsWith('http') ? h.photoUrl : `${BACKEND_URL}${h.photoUrl}`} alt="" className="w-full h-28 object-cover rounded mb-2" />}
                  <strong>{h.name}</strong><br />
                  <span className="text-xs text-gray-500">{h.description}</span>
                </Popup>
              </DraggableMarker>
            ))}

            {tab === 'stations' && stations.filter(s => s.id !== editingId).map(s => (
              <DraggableMarker key={s.id} position={[Number(s.lat), Number(s.lng)]} icon={stationIcon}
                onDragEnd={(lat, lng) => handleDragEnd('stations', s.id, lat, lng)}>
                <Popup>
                  {s.photoUrl && <img src={s.photoUrl?.startsWith('http') ? s.photoUrl : `${BACKEND_URL}${s.photoUrl}`} alt="" className="w-full h-28 object-cover rounded mb-2" />}
                  <strong>{s.name}</strong><br />
                  <span className="text-xs text-gray-500">{s.contact}</span>
                </Popup>
              </DraggableMarker>
            ))}

            {/* Draft Marker */}
            {formData.lat && formData.lng && (
              <DraggableMarker
                position={[Number(formData.lat), Number(formData.lng)]}
                icon={tab === 'hydrants' ? hydrantIcon : stationIcon}
                onDragEnd={(lat, lng) => setFormData(p => ({ ...p, lat: lat.toFixed(7), lng: lng.toFixed(7) }))}
              >
                <Popup>
                  <strong className="text-orange-600">{editingId ? 'Unsaved Location' : 'New Location'}</strong><br />
                  <span className="text-xs text-gray-500">Drag to adjust or click map.</span>
                </Popup>
              </DraggableMarker>
            )}
          </MapContainer>
        </div>

        {/* Right: Form + List */}
        <div className="flex flex-col gap-4">
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-500" />
              {editingId ? `Edit ${tabs.find(t => t.key === tab)?.label.slice(0, -1)}` : `Add ${tabs.find(t => t.key === tab)?.label.slice(0, -1)}`}
            </h3>

            {(tab === 'hydrants' || tab === 'stations') && (
              <input type="text" placeholder="Name" value={formData.name || ''}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" required />
            )}
            {tab === 'stations' && (
              <input type="text" placeholder="Contact number (optional)" value={formData.contact || ''}
                onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            )}
            <input type="text" placeholder="Description (optional)" value={formData.description || ''}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />

            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Latitude" step="0.0000001"
                value={formData.lat || ''}
                onChange={e => setFormData(p => ({ ...p, lat: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" required />
              <input type="number" placeholder="Longitude" step="0.0000001"
                value={formData.lng || ''}
                onChange={e => setFormData(p => ({ ...p, lng: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <p className="text-xs text-gray-400">Or click on the map to auto-fill coordinates.</p>

            {/* Photo upload */}
            <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer group">
              <div className="flex items-center gap-2 bg-gray-100 group-hover:bg-gray-200 px-3 py-2 rounded-lg transition">
                <Upload className="w-4 h-4 text-gray-500" />
                <span>{photoFile ? photoFile.name : 'Upload Photo (optional)'}</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
            {photoPreview && (
              <img src={photoPreview} alt="Preview" className="w-full h-28 object-cover rounded-lg border" />
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition disabled:opacity-50">
                <Check className="w-4 h-4" /> {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
                  <X className="w-4 h-4" /> Cancel
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="overflow-y-auto max-h-56 space-y-2">
            {loading && <p className="text-gray-400 text-sm text-center py-4">Loading...</p>}
            {!loading && currentItems.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No entries yet.</p>
            )}
            {(currentItems as any[]).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between bg-white border rounded-xl px-4 py-3 shadow-sm gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {item.photoUrl && (
                    <img src={item.photoUrl?.startsWith('http') ? item.photoUrl : `${BACKEND_URL}${item.photoUrl}`} alt="" className="w-10 h-10 object-cover rounded-lg border flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(item)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(tab, item.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
