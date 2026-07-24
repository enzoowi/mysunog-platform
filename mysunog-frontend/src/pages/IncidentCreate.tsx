import { useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapClickHandler({ setLocation }: { setLocation: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            setLocation(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

const BARANGAYS = [
    'Bagong Pook', 'Bilucao', 'Bulihan', 'Luta del Norte', 'Luta del Sur',
    'Poblacion', 'San Andres', 'San Fernando', 'San Isidro', 'San Juan',
    'San Pedro I', 'San Pedro II', 'San Pioquinto', 'Santiago',
];

export default function IncidentCreate() {
    const [form, setForm] = useState({
        incidentDate: '', incidentTime: '', barangay: '', cause: '',
        latitude: '', longitude: '', estimatedDamage: '', casualties: '',
        injuries: '', propertyType: '', landmark: '', remarks: '',
        alarmTime: '', responseTime: '', controlTime: '', fireOutTime: '',
        reporterName: '', reporterContact: '', fireInvestigator: '',
    });
    const [otherCause, setOtherCause] = useState('');
    const [otherPropertyType, setOtherPropertyType] = useState('');
    const [showMapModal, setShowMapModal] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const finalCause = form.cause === 'Other' ? otherCause : form.cause;
            const finalPropertyType = form.propertyType === 'Other' ? otherPropertyType : form.propertyType;
            await api.post('/incidents', {
                ...form,
                cause: finalCause,
                propertyType: finalPropertyType,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                estimatedDamage: form.estimatedDamage ? Number(form.estimatedDamage) : undefined,
                casualties: form.casualties ? Number(form.casualties) : undefined,
                injuries: form.injuries ? Number(form.injuries) : undefined,
                alarmTime: form.alarmTime || undefined,
                responseTime: form.responseTime || undefined,
                controlTime: form.controlTime || undefined,
                fireOutTime: form.fireOutTime || undefined,
                reporterName: form.reporterName || undefined,
                reporterContact: form.reporterContact || undefined,
                fireInvestigator: form.fireInvestigator || undefined,
            });
            alert('Incident saved successfully.');
            setForm({
                incidentDate: '', incidentTime: '', barangay: '', cause: '',
                latitude: '', longitude: '', estimatedDamage: '', casualties: '',
                injuries: '', propertyType: '', landmark: '', remarks: '',
                alarmTime: '', responseTime: '', controlTime: '', fireOutTime: '',
                reporterName: '', reporterContact: '', fireInvestigator: '',
            });
            setOtherCause('');
            setOtherPropertyType('');
        } catch (error) {
            console.error(error);
            alert('Failed to save incident.');
        }
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🔥 Record Fire Incident</h2>
            <p className="text-gray-600 mb-6">Fill in the details of the fire incident for BFP records.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reporter's Name</label>
                        <input type="text" name="reporterName" value={form.reporterName} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" placeholder="Optional" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reporter's Contact</label>
                        <input type="text" name="reporterContact" value={form.reporterContact} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" placeholder="Optional" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fire Investigator</label>
                        <input type="text" name="fireInvestigator" value={form.fireInvestigator} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" placeholder="Optional" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input type="date" name="incidentDate" value={form.incidentDate} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                        <input type="time" name="incidentTime" value={form.incidentTime} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" required />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                    <select name="barangay" value={form.barangay} onChange={handleChange}
                        className="w-full border rounded-lg px-4 py-2" required>
                        <option value="">Select Barangay</option>
                        {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cause *</label>
                    <select name="cause" value={form.cause} onChange={handleChange}
                        className="w-full border rounded-lg px-4 py-2" required>
                        <option value="">Select Cause</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Cooking">Cooking</option>
                        <option value="Arson">Arson</option>
                        <option value="Open Flame">Open Flame</option>
                        <option value="Cigarette Butt">Cigarette Butt</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {form.cause === 'Other' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specific Cause</label>
                        <input type="text" placeholder="Please specify..." value={otherCause} onChange={(e) => setOtherCause(e.target.value)}
                            className="w-full border rounded-lg px-4 py-2" required />
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location Coordinates *</label>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setShowMapModal(true)}
                            className="flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-lg border hover:bg-gray-200 transition">
                            <MapPin className="w-4 h-4" /> 
                            {form.latitude && form.longitude ? 'Change Pinned Location' : 'Pin Location on Map'}
                        </button>
                        {form.latitude && form.longitude && (
                            <span className="text-sm text-green-600 font-medium">📍 Location Pinned!</span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Est. Damage (₱)</label>
                        <input type="number" name="estimatedDamage" value={form.estimatedDamage} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Casualties</label>
                        <input type="number" name="casualties" value={form.casualties} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Injuries</label>
                        <input type="number" name="injuries" value={form.injuries} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                        <select name="propertyType" value={form.propertyType} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2">
                            <option value="">Select Property Type</option>
                            <option value="Residential">Residential</option>
                            <option value="Commercial">Commercial</option>
                            <option value="Industrial">Industrial</option>
                            <option value="Institutional">Institutional</option>
                            <option value="Agricultural">Agricultural</option>
                            <option value="Government">Government</option>
                            <option value="Religious">Religious</option>
                            <option value="Mixed-Use">Mixed-Use</option>
                            <option value="Vacant Lot">Vacant Lot</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nearest Landmark</label>
                        <input type="text" name="landmark" placeholder="e.g. Near City Hall" value={form.landmark} onChange={handleChange}
                            className="w-full border rounded-lg px-4 py-2" />
                    </div>
                </div>

                {form.propertyType === 'Other' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Specify Property Type</label>
                        <input type="text" placeholder="Please specify..." value={otherPropertyType} onChange={(e) => setOtherPropertyType(e.target.value)}
                            className="w-full border rounded-lg px-4 py-2" required />
                    </div>
                )}

                <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold text-gray-700 mb-3">⏱️ Response Performance Data</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Alarm Time</label>
                            <input type="time" name="alarmTime" value={form.alarmTime} onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Response Time</label>
                            <input type="time" name="responseTime" value={form.responseTime} onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Control Time</label>
                            <input type="time" name="controlTime" value={form.controlTime} onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fire Out Time</label>
                            <input type="time" name="fireOutTime" value={form.fireOutTime} onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea name="remarks" placeholder="Additional details..." value={form.remarks} onChange={handleChange} rows={3}
                        className="w-full border rounded-lg px-4 py-2" />
                </div>

                <button type="submit" disabled={!form.latitude || !form.longitude}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    Save Incident
                </button>
            </form>

            {showMapModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-semibold text-gray-800">Pin Incident Location</h3>
                            <button type="button" onClick={() => setShowMapModal(false)} className="text-gray-500 hover:text-gray-700">Close</button>
                        </div>
                        <div className="h-96 w-full relative">
                            <MapContainer
                                center={[14.04, 121.16]}
                                zoom={13}
                                minZoom={12}
                                maxBounds={[[13.98, 121.08], [14.10, 121.25]]}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapClickHandler setLocation={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() }))} />
                                {form.latitude && form.longitude && (
                                    <Marker position={[Number(form.latitude), Number(form.longitude)]} />
                                )}
                            </MapContainer>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button type="button" onClick={() => setShowMapModal(false)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Confirm Location</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}