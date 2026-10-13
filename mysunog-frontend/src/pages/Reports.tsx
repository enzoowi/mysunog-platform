import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, AlertCircle, TrendingDown, X, Download, Trash2, RotateCcw, Trash, Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const BARANGAYS = [
  'All', 'Bagong Pook', 'Bilucao', 'Bulihan', 'Luta del Norte', 'Luta del Sur',
  'Poblacion', 'San Andres', 'San Fernando', 'San Isidro', 'San Juan',
  'San Pedro I', 'San Pedro II', 'San Pioquinto', 'Santiago',
];

export default function Reports() {
  const [barangay, setBarangay] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Excel import state
  const [userRole, setUserRole] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildQuery() {
    const params = new URLSearchParams();
    if (barangay && barangay !== 'All') params.set('barangay', barangay);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }

  useEffect(() => {
    async function fetchIncidents() {
      setLoading(true);
      try {
        if (showDeleted) {
          const res = await api.get('/incidents/deleted');
          setIncidents(res.data);
        } else {
          const res = await api.get(`/incidents/search?${buildQuery()}`);
          setIncidents(res.data);
        }
      } catch (e) {
        console.error('Failed to fetch incidents', e);
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangay, startDate, endDate, showDeleted]);

  // Fetch current user role from the API
  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setUserRole(res.data.role))
      .catch(() => setUserRole(null));
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to move this incident record to the archive? This action will move it to Archived Records and will affect analytics.')) return;
    
    setLoading(true);
    try {
      await api.delete(`/incidents/${id}`);
      setSelectedIncident(null);
      // refetch incidents
      const res = await api.get(`/incidents/search?${buildQuery()}`);
      setIncidents(res.data);
    } catch (e) {
      console.error('Failed to delete incident', e);
      alert('Failed to delete incident');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(id: number) {
    if (!window.confirm('Are you sure you want to restore this record?')) return;
    setLoading(true);
    try {
      await api.post(`/incidents/${id}/restore`);
      setSelectedIncident(null);
      const res = await api.get('/incidents/deleted');
      setIncidents(res.data);
    } catch (e) {
      console.error('Failed to restore incident', e);
      alert('Failed to restore incident');
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(id: number) {
    if (!window.confirm('Are you sure you want to permanently delete this record? This action CANNOT be undone.')) return;
    setLoading(true);
    try {
      await api.delete(`/incidents/${id}/permanent`);
      setSelectedIncident(null);
      const res = await api.get('/incidents/deleted');
      setIncidents(res.data);
    } catch (e) {
      console.error('Failed to permanently delete incident', e);
      alert('Failed to permanently delete incident');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    try {
      const res = await api.get(`/reports/incidents/pdf?${buildQuery()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident-report-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Failed to download PDF', e);
      alert('Failed to download PDF');
    }
  }

  async function downloadExcel() {
    try {
      const res = await api.get(`/reports/incidents/excel?${buildQuery()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident-report-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Failed to download Excel', e);
      alert('Failed to download Excel');
    }
  }

  async function downloadSinglePdf(id: number) {
    try {
      const res = await api.get(`/reports/incidents/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident-${id}-report-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Failed to download PDF', e);
      alert('Failed to download PDF');
    }
  }

  async function handleImportExcel() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/incidents/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      setImportFile(null);
      // Refresh incident list
      const updated = await api.get(`/incidents/search?${buildQuery()}`);
      setIncidents(updated.data);
    } catch (e: any) {
      setImportError(e?.response?.data?.message || 'Failed to import Excel file.');
    } finally {
      setImporting(false);
    }
  }

  /** Download a blank Excel template with the correct column headers */
  function downloadExcelTemplate() {
    const headers = [
      'incidentDate','incidentTime','barangay','cause',
      'latitude','longitude','estimatedDamage','casualties','injuries',
      'propertyType','landmark','remarks','reporterName','reporterContact',
      'fireInvestigator','alarmTime','responseTime','controlTime','fireOutTime',
    ];
    const csvContent = headers.join(',') + '\n2026-01-08,02:30,Poblacion,Electrical,14.0477,121.1541,250000,0,2,Residential,Near Hall,,Juan Cruz,09171234567,,,,,';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incident-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 Reports & Export</h2>
          <p className="text-gray-600">Generate and download fire incident reports for administrative use.</p>
        </div>
        <button 
          onClick={() => setShowDeleted(!showDeleted)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition ${showDeleted ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {showDeleted ? 'View Active Records' : 'View Archive'}
        </button>
      </div>

      {/* Filters & Export */}
      {!showDeleted && (
      <div className="bg-white border text-sm rounded-xl p-6 mb-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-4 text-gray-800 border-b pb-2">Report Filters & Export</h3>
        
        <div className="flex flex-col md:flex-row gap-4 mb-5">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Barangay</label>
            <select value={barangay} onChange={(e) => setBarangay(e.target.value)}
              className="w-full border-gray-300 border rounded-lg px-4 py-2.5 shadow-sm focus:ring-orange-500 focus:border-orange-500">
              {BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border-gray-300 border rounded-lg px-4 py-2.5 shadow-sm focus:ring-orange-500 focus:border-orange-500" />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full border-gray-300 border rounded-lg px-4 py-2.5 shadow-sm focus:ring-orange-500 focus:border-orange-500" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={downloadPdf}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition shadow-sm flex items-center justify-center gap-2">
            📄 Download PDF
          </button>
          <button onClick={downloadExcel}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition shadow-sm flex items-center justify-center gap-2">
            📊 Download Excel
          </button>
        </div>
      </div>
      )}

      {/* Excel Import — Fire Investigator only */}
      {userRole === 'fire_investigator' && !showDeleted && (
        <div className="bg-white border rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-lg mb-1 text-gray-800 border-b pb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Import Incidents from Excel
          </h3>
          <p className="text-xs text-gray-500 mb-4">Upload an <strong>.xlsx</strong> file with a header row. Required columns: <code className="bg-gray-100 px-1 rounded">incidentDate</code>, <code className="bg-gray-100 px-1 rounded">incidentTime</code>, <code className="bg-gray-100 px-1 rounded">barangay</code>.</p>

          {/* Success banner */}
          {importResult && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Successful!</p>
                <p className="text-sm">{importResult.imported} record(s) imported, {importResult.skipped} skipped.</p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 text-xs list-disc list-inside text-green-700">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="ml-auto text-green-500 hover:text-green-700"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Error banner */}
          {importError && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm flex-1">{importError}</p>
              <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped && (dropped.name.endsWith('.xlsx') || dropped.name.endsWith('.xls'))) {
                setImportFile(dropped);
                setImportResult(null);
                setImportError(null);
              } else {
                setImportError('Please drop a valid .xlsx or .xls file.');
              }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              dragOver ? 'border-green-400 bg-green-50' : importFile ? 'border-green-300 bg-green-50/50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setImportFile(f); setImportResult(null); setImportError(null); }
                e.target.value = '';
              }}
            />
            <Upload className={`w-8 h-8 mx-auto mb-2 ${importFile ? 'text-green-500' : 'text-gray-400'}`} />
            {importFile ? (
              <div>
                <p className="font-medium text-gray-800">{importFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{(importFile.size / 1024).toFixed(1)} KB · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-600">Drag & drop your Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse · .xlsx / .xls</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            {importFile && (
              <button
                onClick={() => { setImportFile(null); setImportResult(null); setImportError(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition"
              >Clear</button>
            )}
            <button
              onClick={handleImportExcel}
              disabled={!importFile || importing}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing...</>
              ) : (
                <><Upload className="w-4 h-4" />Import & Save to Reports</>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center">
            Need a template? <a href="#" onClick={(e) => { e.preventDefault(); downloadExcelTemplate(); }} className="text-green-600 hover:underline">Download sample template</a>
          </p>
        </div>
      )}

      {/* Incident Data Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">{showDeleted ? 'Archived Records' : 'Incident Records'}</h3>
            <span className="text-xs font-medium text-gray-500 bg-white border px-3 py-1 rounded-full">{incidents.length} Result{incidents.length !== 1 && 's'}</span>
        </div>
        
        {loading ? (
            <div className="p-12 text-center text-gray-500">Loading incidents...</div>
        ) : incidents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No incidents found for the selected filters.</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                        <tr>
                            <th className="px-6 py-3 font-semibold">Date & Time</th>
                            <th className="px-6 py-3 font-semibold">Location</th>
                            <th className="px-6 py-3 font-semibold">Cause</th>
                            <th className="px-6 py-3 font-semibold">Damage / Victims</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {incidents.map((incident) => (
                            <tr key={incident.id} onClick={() => setSelectedIncident(incident)} className="hover:bg-orange-50/50 cursor-pointer transition">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{incident.incidentDate}</div>
                                    <div className="text-gray-500 flex items-center gap-1 mt-0.5 text-xs"><Clock className="w-3 h-3"/> {incident.incidentTime}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium flex items-center gap-1 text-gray-800"><MapPin className="w-3.5 h-3.5 text-red-500" /> {incident.barangay}</div>
                                    <div className="text-gray-500 text-xs ml-4.5 mt-0.5">{incident.propertyType || '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-medium">
                                        <AlertCircle className="w-3 h-3" />
                                        {incident.cause || 'Unknown'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium flex items-center gap-1 text-orange-600"><TrendingDown className="w-3.5 h-3.5" /> ₱{(incident.estimatedDamage || 0).toLocaleString()}</div>
                                    <div className="text-gray-500 text-xs mt-0.5">
                                        Casualties: {incident.casualties || 0} | Injuries: {incident.injuries || 0}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Incident Details Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  Incident #{selectedIncident.id} Details
                </h3>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Date & Time</p>
                  <p className="font-medium text-gray-800">{selectedIncident.incidentDate} at {selectedIncident.incidentTime}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Barangay</p>
                  <p className="font-medium text-gray-800">{selectedIncident.barangay}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Reporter Name</p>
                  <p className="font-medium text-gray-800">{selectedIncident.reporterName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Reporter Contact</p>
                  <p className="font-medium text-gray-800">{selectedIncident.reporterContact || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Fire Investigator</p>
                  <p className="font-medium text-gray-800">{selectedIncident.fireInvestigator || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Cause of Fire</p>
                  <p className="font-medium text-gray-800">{selectedIncident.cause || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Property Type</p>
                  <p className="font-medium text-gray-800">{selectedIncident.propertyType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Nearest Landmark</p>
                  <p className="font-medium text-gray-800">{selectedIncident.landmark || 'N/A'}</p>
                </div>
                
                <div className="col-span-2 border-t pt-4 mt-2"></div>
                
                <div>
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Estimated Damage</p>
                  <p className="font-bold text-red-600">₱{(selectedIncident.estimatedDamage || 0).toLocaleString()}</p>
                </div>
                <div>
                   <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Victims</p>
                   <p className="font-medium text-gray-800">{selectedIncident.casualties || 0} Casualties, {selectedIncident.injuries || 0} Injuries</p>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <p className="font-semibold text-gray-800 mb-3">Response Performance</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Alarm Time</p>
                      <p className="font-medium text-gray-800">{selectedIncident.alarmTime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Response Time</p>
                      <p className="font-medium text-gray-800">{selectedIncident.responseTime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Control Time</p>
                      <p className="font-medium text-gray-800">{selectedIncident.controlTime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Fire Out Time</p>
                      <p className="font-medium text-gray-800">{selectedIncident.fireOutTime || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 border-t pt-4 mt-2">
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Location Coordinates</p>
                  <p className="font-medium text-gray-800">{selectedIncident.latitude}, {selectedIncident.longitude}</p>
                </div>
                
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs font-semibold uppercase mb-1">Remarks</p>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[60px] text-gray-700">
                    {selectedIncident.remarks || 'No remarks provided.'}
                  </div>
                </div>

                {selectedIncident.images && Array.isArray(selectedIncident.images) && selectedIncident.images.length > 0 && (
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <p className="font-semibold text-gray-800 mb-3">Incident Images</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedIncident.images.map((imgUrl: string, idx: number) => (
                        <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-full aspect-video rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition">
                          <img src={imgUrl} alt={`Incident photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
              {showDeleted ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(selectedIncident.id)}
                    className="text-green-600 hover:bg-green-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(selectedIncident.id)}
                    className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    <Trash className="w-4 h-4" /> Delete Permanently
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDelete(selectedIncident.id)}
                  className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Move to Archive
                </button>
              )}
              
              {!showDeleted && (
                <button 
                  onClick={() => downloadSinglePdf(selectedIncident.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Incident PDF
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
