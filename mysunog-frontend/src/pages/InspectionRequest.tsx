import { useState } from 'react';
import { api } from '../services/api';

const BARANGAYS = [
  'BAGONG POOK', 'BILUCAO', 'BULIHAN', 'LUTA DEL NORTE', 'LUTA DEL SUR',
  'POBLACION', 'SAN ANDRES', 'SAN FERNANDO', 'SAN ISIDRO', 'SAN JUAN',
  'SAN PEDRO I', 'SAN PEDRO II', 'SAN PIOQUINTO', 'SANTIAGO',
];

export default function InspectionRequest() {
  const [form, setForm] = useState({
    businessName: '',
    houseNumber: '',
    streetName: '',
    subdivision: '',
    barangay: '',
    description: '',
  });
  const [bploSlip, setBploSlip] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (['houseNumber', 'streetName', 'subdivision'].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName || !form.houseNumber || !form.streetName || !form.barangay || !bploSlip) {
      alert('Please fill in all required fields and upload the BPLO slip.');
      return;
    }
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('businessName', form.businessName);
      fd.append('houseNumber', form.houseNumber);
      fd.append('streetName', form.streetName);
      if (form.subdivision) fd.append('subdivision', form.subdivision);
      fd.append('barangay', form.barangay);
      if (form.description) fd.append('description', form.description);
      fd.append('bploSlip', bploSlip);

      await api.post('/inspections', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('FSEC Application submitted successfully!');
      setForm({ businessName: '', houseNumber: '', streetName: '', subdivision: '', barangay: '', description: '' });
      setBploSlip(null);
      const fileInput = document.getElementById('bploSlip') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error(error);
      alert('Failed to submit inspection request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Apply for FSEC</h2>
      <p className="text-gray-600 mb-6">Fill out the form below to submit a Fire Safety Evaluation Clearance (FSEC) application.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business/Establishment Name *</label>
          <input type="text" name="businessName" value={form.businessName} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Enter business name" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">House/Bldg No. *</label>
            <input type="text" name="houseNumber" value={form.houseNumber} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Name *</label>
            <input type="text" name="streetName" value={form.streetName} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subdivision/Village (Optional)</label>
            <input type="text" name="subdivision" value={form.subdivision} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
            <select name="barangay" value={form.barangay} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" required>
              <option value="">Select Barangay</option>
              {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Describe any special requirements or additional details" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo of BPLO Assessment Slip *</label>
          <div className="flex items-center gap-2">
            <input type="file" id="bploSlip" accept="image/*" onChange={(e) => setBploSlip(e.target.files?.[0] || null)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" required={!bploSlip} />
            {bploSlip && (
              <button type="button" onClick={() => {
                  setBploSlip(null);
                  const fileInput = document.getElementById('bploSlip') as HTMLInputElement;
                  if (fileInput) fileInput.value = '';
                }}
                className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition" title="Remove Image">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            )}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition disabled:opacity-50">
          {loading ? 'Submitting...' : 'Submit FSEC Application'}
        </button>
      </form>
    </div>
  );
}
