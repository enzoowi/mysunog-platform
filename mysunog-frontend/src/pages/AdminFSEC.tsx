import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Edit, Eye, FileCheck, AlertTriangle, Calendar } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export default function AdminFSEC() {
    const [inspections, setInspections] = useState<any[]>([]);

    async function fetchAll() {
        try {
            const res = await api.get('/inspections');
            setInspections(res.data);
        } catch (error) {
            console.error('Failed to load FSEC applications', error);
        }
    }

    useEffect(() => {
        fetchAll();
    }, []);

    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; permitId: number | null; status: string }>({ isOpen: false, permitId: null, status: '' });
    const [notes, setNotes] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [confirmIssue, setConfirmIssue] = useState<{ isOpen: boolean; permitId: number | null }>({ isOpen: false, permitId: null });
    const [issuing, setIssuing] = useState(false);

    function openModal(permitId: number, status: string) {
        setModalConfig({ isOpen: true, permitId, status });
        setNotes('');
        setScheduledDate('');
        setScheduledTime('');
    }

    async function handleConfirmUpdate() {
        if (!modalConfig.permitId) return;
        try {
            await api.patch(`/inspections/${modalConfig.permitId}/status`, {
                status: modalConfig.status,
                adminNotes: notes,
                ...(modalConfig.status === 'approved' && scheduledDate ? { scheduledDate, scheduledTime } : {}),
            });
            setModalConfig({ isOpen: false, permitId: null, status: '' });
            fetchAll();
        } catch (error) {
            console.error(error);
            alert('Failed to update status');
        }
    }

    async function handleIssueCertificate() {
        if (!confirmIssue.permitId) return;
        setIssuing(true);
        try {
            await api.post(`/inspections/${confirmIssue.permitId}/issue-certificate`);
            setConfirmIssue({ isOpen: false, permitId: null });
            fetchAll();
        } catch (error) {
            console.error(error);
            alert('Failed to issue certificate');
        } finally {
            setIssuing(false);
        }
    }

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            approved: 'bg-green-100 text-green-700',
            issued: 'bg-blue-100 text-blue-700',
            rejected: 'bg-red-100 text-red-700',
            completed: 'bg-purple-100 text-purple-700',
        };
        return styles[status] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4 font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>

            <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage FSEC Applications</h2>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-4 py-3">Business</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Applicant</th>
                            <th className="px-4 py-3">BPLO Slip</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {inspections.map(i => (
                            <tr key={i.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold text-gray-800">{i.businessName}</td>
                                <td className="px-4 py-3">
                                    <p className="text-sm text-gray-800">{i.houseNumber} {i.streetName}</p>
                                    <p className="text-xs text-gray-500">{i.subdivision ? `${i.subdivision}, ` : ''}Brgy. {i.barangay}</p>
                                </td>
                                <td className="px-4 py-3">{i.description || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${statusBadge(i.status)}`}>{i.status}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs font-semibold text-gray-800">
                                        {i.requestedBy?.firstName || i.requestedBy?.lastName
                                            ? `${i.requestedBy?.firstName || ''} ${i.requestedBy?.lastName || ''}`.trim()
                                            : i.requestedBy?.email}
                                    </p>
                                    {(i.requestedBy?.firstName || i.requestedBy?.lastName) && (
                                        <p className="text-[10px] text-gray-500">{i.requestedBy?.email}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {i.bploSlipUrl ? (
                                        <a href={`${BACKEND_URL}${i.bploSlipUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                            <Eye className="w-4 h-4" /> View
                                        </a>
                                    ) : <span className="text-gray-400">N/A</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => openModal(i.id, 'approved')} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Approve">
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openModal(i.id, 'rejected')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Reject">
                                            <X className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openModal(i.id, i.status)} className="p-1.5 bg-gray-50 text-gray-600 rounded hover:bg-gray-200" title="Update Notes">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        {i.status === 'approved' && (
                                            <button onClick={() => setConfirmIssue({ isOpen: true, permitId: i.id })} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Issue Certificate">
                                                <FileCheck className="w-4 h-4" />
                                            </button>
                                        )}
                                        {i.status === 'issued' && i.certificateUrl && (
                                            <a href={`${BACKEND_URL}${i.certificateUrl}`} target="_blank" rel="noreferrer" className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100" title="Download Certificate">
                                                <Eye className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {inspections.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-gray-500">No FSEC applications found.</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Notes / Approval Modal */}
            {modalConfig.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-lg">
                                {modalConfig.status === 'approved' ? 'Approve Application' :
                                    modalConfig.status === 'rejected' ? 'Reject Application' : 'Update Notes'}
                            </h3>
                            <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1.5 rounded-full transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Admin Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Enter any notes, instructions, or reasons..."
                                    rows={3}
                                    className="w-full border-gray-300 border rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow resize-none text-sm"
                                />
                            </div>
                            {modalConfig.status === 'approved' && (
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-gray-700">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Inspection Schedule (Optional)
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Date</label>
                                            <input
                                                type="date"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                className="w-full border-gray-300 border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Time</label>
                                            <input
                                                type="time"
                                                value={scheduledTime}
                                                onChange={(e) => setScheduledTime(e.target.value)}
                                                className="w-full border-gray-300 border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow text-sm"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">Leave blank if no inspection is needed yet.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition text-sm">Cancel</button>
                            <button onClick={handleConfirmUpdate} className={`px-5 py-2.5 text-white font-medium rounded-xl transition shadow-sm text-sm ${modalConfig.status === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                                    modalConfig.status === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-orange-600 hover:bg-orange-700'
                                }`}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Issue Certificate Confirmation Modal */}
            {confirmIssue.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="mx-auto w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-7 h-7 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Issue FSEC Certificate?</h3>
                            <p className="text-sm text-gray-600">
                                This will generate the official FSEC certificate PDF and notify the applicant. This action cannot be undone.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-center gap-3">
                            <button onClick={() => setConfirmIssue({ isOpen: false, permitId: null })} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleIssueCertificate}
                                disabled={issuing}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition shadow-sm text-sm disabled:opacity-50"
                            >
                                {issuing ? 'Issuing...' : 'Yes, Issue Certificate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
