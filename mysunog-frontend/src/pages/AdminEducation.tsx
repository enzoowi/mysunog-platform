import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

type Content = { id: number; title: string; content: string; category: string; imageUrl?: string; };

export default function AdminEducation() {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ title: string; content: string; category: string; imageUrl: string; imageFile: File | null }>({ title: '', content: '', category: 'general', imageUrl: '', imageFile: null });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  async function fetchContents() {
    try { setLoading(true); const res = await api.get('/education'); setContents(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchContents(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', form.title || '');
      formData.append('content', form.content || '');
      formData.append('category', form.category);
      if (form.imageFile) {
        formData.append('image', form.imageFile);
      }
      
      if (editingId) {
        await api.patch(`/education/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Content updated!');
      } else {
        await api.post('/education', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Content created!');
      }
      setForm({ title: '', content: '', category: 'general', imageUrl: '', imageFile: null });
      setEditingId(null);
      fetchContents();
    } catch (err) { console.error(err); alert('Failed to save content.'); }
  }

  function startEdit(c: Content) {
    setEditingId(c.id);
    setForm({ title: c.title || '', content: c.content || '', category: c.category, imageUrl: c.imageUrl || '', imageFile: null });
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this content?')) return;
    await api.delete(`/education/${id}`);
    fetchContents();
  }

  async function handleUploadImage(id: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/education/${id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Image uploaded successfully!');
      fetchContents();
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  }

  return (
    <div className="p-6">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Education Content</h2>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-5 mb-6 space-y-3">
        <h3 className="font-semibold">{editingId ? 'Edit Content' : 'Add New Content'}</h3>
        <input type="text" placeholder="Title (optional)" value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          className="w-full border rounded-lg px-4 py-2" />
        <textarea placeholder="Content body (optional)" value={form.content} rows={5}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          className="w-full border rounded-lg px-4 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="border rounded-lg px-4 py-2">
            <option value="general">General</option>
            <option value="prevention">Fire Prevention</option>
            <option value="lpg">LPG Safety</option>
            <option value="emergency">Emergency Preparedness</option>
            <option value="home_safety">Home Safety</option>
          </select>
          <input type="file" accept="image/*"
            onChange={(e) => setForm((p) => ({ ...p, imageFile: e.target.files?.[0] || null }))}
            className="border rounded-lg px-4 py-1.5 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition font-medium">
            {editingId ? 'Update' : 'Publish'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ title: '', content: '', category: 'general', imageUrl: '', imageFile: null }); }}
              className="bg-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300 transition font-medium">Cancel</button>
          )}
        </div>
      </form>

      {loading && <p>Loading...</p>}
      {!loading && contents.map((c) => (
        <div key={c.id} className="border rounded-xl p-4 mb-3 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            {c.imageUrl && (
              <img src={c.imageUrl.startsWith('http') ? c.imageUrl : `${BACKEND_URL}${c.imageUrl}`} 
                alt="thumb" className="w-16 h-16 object-cover rounded shadow-sm border mt-1" />
            )}
            <div>
              <p className="font-semibold">{c.title || 'Untitled Image'} <span className="text-xs text-gray-400">({c.category})</span></p>
              <p className="text-sm text-gray-600 mt-1">{c.content ? c.content.substring(0, 120) + '...' : 'No description provided.'}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <label className={`cursor-pointer px-3 py-1 flex items-center gap-1 border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded text-xs font-medium transition ${uploadingId === c.id ? 'opacity-50' : ''}`}>
               <Upload className="w-3 h-3" /> {uploadingId === c.id ? 'Uploading...' : 'Upload Image'}
               <input type="file" accept="image/*" className="hidden" disabled={uploadingId === c.id} onChange={(e) => handleUploadImage(c.id, e)} />
            </label>
            <button onClick={() => startEdit(c)} className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium transition">Edit</button>
            <button onClick={() => handleDelete(c.id)} className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
