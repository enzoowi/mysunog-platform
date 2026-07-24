import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Image, CheckCircle } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

const SLOTS = [
  { key: 'home_hero', label: 'Home Hero Banner', description: 'Main background image on the home page hero section' },
];

type SiteImage = { id: number; key: string; label?: string; imageUrl?: string; updatedAt: string };

export default function AdminSiteImages() {
  const [images, setImages] = useState<SiteImage[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchImages() {
    try {
      const res = await api.get('/site-images');
      setImages(res.data);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { fetchImages(); }, []);

  function getImageFor(key: string) {
    return images.find(i => i.key === key);
  }

  async function handleUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(key);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/site-images/${key}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchImages();
      setSuccess(key);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) { console.error(err); alert('Upload failed.'); }
    finally { setUploading(null); e.target.value = ''; }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Manage Site Images</h2>
      <p className="text-gray-500 text-sm mb-6">Upload images that appear on public-facing pages of the website.</p>

      <div className="space-y-5">
        {SLOTS.map(slot => {
          const current = getImageFor(slot.key);
          return (
            <div key={slot.key} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <Image className="w-4 h-4 text-orange-500" /> {slot.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{slot.description}</p>
                  {current?.updatedAt && (
                    <p className="text-xs text-gray-400 mt-1">Last updated: {new Date(current.updatedAt).toLocaleString()}</p>
                  )}
                </div>

                <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition
                  ${uploading === slot.key ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-orange-600 text-white hover:bg-orange-700 border-orange-600'}`}>
                  {success === slot.key
                    ? <><CheckCircle className="w-4 h-4" /> Uploaded!</>
                    : uploading === slot.key
                      ? 'Uploading...'
                      : <><Upload className="w-4 h-4" /> Upload Image</>}
                  <input type="file" accept="image/*" className="hidden"
                    disabled={!!uploading}
                    onChange={(e) => handleUpload(slot.key, e)} />
                </label>
              </div>

              {current?.imageUrl && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Current image:</p>
                  <img
                    src={`${BACKEND_URL}${current.imageUrl}`}
                    alt={slot.label}
                    className="w-full max-h-64 object-cover rounded-lg border"
                  />
                </div>
              )}
              {!current?.imageUrl && (
                <div className="mt-4 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                  No image uploaded yet
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
