import { useState } from 'react';
import { api } from '../services/api';

const BARANGAYS = [
  'Bagong Pook', 'Bilucao', 'Bulihan', 'Luta del Norte', 'Luta del Sur',
  'Poblacion', 'San Andres', 'San Fernando', 'San Isidro', 'San Juan',
  'San Pedro I', 'San Pedro II', 'San Pioquinto', 'Santiago',
];

export default function VolunteerRegister() {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', barangay: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone || !form.barangay) {
      alert('Please fill in all fields.');
      return;
    }
    try {
      setLoading(true);
      await api.post('/users/volunteer', form);
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert('Failed to register. Please make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">Registration Successful!</h2>
        <p className="text-gray-600">Thank you for volunteering as a community fire marshal.</p>
        <p className="text-gray-500 mt-2">BFP Malvar will contact you for the next fire watch activities.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">🙋 Volunteer Fire Marshal Registration</h2>
      <p className="text-gray-600 mb-6">Join the Barangay Fire Watch Program and help protect your community.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input type="text" name="firstName" value={form.firstName} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500"
              placeholder="Juan" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input type="text" name="lastName" value={form.lastName} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500"
              placeholder="Dela Cruz" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input type="tel" name="phone" value={form.phone} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500"
            placeholder="09XX-XXX-XXXX" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
          <select name="barangay" value={form.barangay} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500">
            <option value="">Select your barangay</option>
            {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {loading ? 'Registering...' : 'Register as Volunteer'}
        </button>
      </form>
    </div>
  );
}
