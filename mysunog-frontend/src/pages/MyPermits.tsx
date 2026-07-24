import { useEffect, useState } from 'react';
import { api } from '../services/api';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export default function MyPermits() {
    const [permits, setPermits] = useState<any[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);

    useEffect(() => {
        api.get('/permits/mine')
            .then((res) => setPermits(res.data))
            .catch((err) => console.error(err));

        api.get('/inspections/mine')
            .then((res) => setInspections(res.data))
            .catch((err) => console.error(err));
    }, []);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My FSIC & FSEC Applications</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">FSIC Applications</h3>
                    {permits.length === 0 ? (
                        <p className="text-gray-500 text-sm">No FSIC applications found.</p>
                    ) : (
                        <div className="space-y-4">
                            {permits.map((permit) => {
                                const address = `${permit.houseNumber} ${permit.streetName}${permit.subdivision ? ', ' + permit.subdivision : ''}, Brgy. ${permit.barangay}`;
                                return (
                                <div key={permit.id} className="bg-white border rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-800">{permit.businessName}</h4>
                                        <span className="px-2 py-1 text-xs font-semibold bg-gray-100 rounded text-gray-600 uppercase">{permit.status}</span>
                                    </div>
                                    <p className="text-sm text-gray-600"><strong>Address:</strong> {address}</p>
                                    <p className="text-sm text-gray-600"><strong>Description:</strong> {permit.description || 'None'}</p>
                                    <p className="text-sm text-gray-600"><strong>Remarks:</strong> {permit.adminRemarks || 'None'}</p>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        {permit.bploSlipUrl && (
                                            <a href={`${BACKEND_URL}${permit.bploSlipUrl}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline inline-block">View BPLO Slip</a>
                                        )}
                                        {permit.status === 'issued' && permit.certificateUrl && (
                                            <a href={`${BACKEND_URL}${permit.certificateUrl}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline inline-block flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                Download Certificate
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">FSEC Applications</h3>
                    {inspections.length === 0 ? (
                        <p className="text-gray-500 text-sm">No FSEC applications found.</p>
                    ) : (
                        <div className="space-y-4">
                            {inspections.map((insp) => {
                                const address = `${insp.houseNumber} ${insp.streetName}${insp.subdivision ? ', ' + insp.subdivision : ''}, Brgy. ${insp.barangay}`;
                                return (
                                <div key={insp.id} className="bg-white border rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-800">{insp.businessName}</h4>
                                        <span className="px-2 py-1 text-xs font-semibold bg-gray-100 rounded text-gray-600 uppercase">{insp.status}</span>
                                    </div>
                                    <p className="text-sm text-gray-600"><strong>Address:</strong> {address}</p>
                                    <p className="text-sm text-gray-600"><strong>Description:</strong> {insp.description || 'None'}</p>
                                    <p className="text-sm text-gray-600"><strong>Remarks:</strong> {insp.adminNotes || 'None'}</p>
                                    <div className="mt-3 flex flex-wrap gap-3">
                                        {insp.bploSlipUrl && (
                                            <a href={`${BACKEND_URL}${insp.bploSlipUrl}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline inline-block">View BPLO Slip</a>
                                        )}
                                        {insp.status === 'issued' && insp.certificateUrl && (
                                            <a href={`${BACKEND_URL}${insp.certificateUrl}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline inline-block flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                Download Certificate
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}