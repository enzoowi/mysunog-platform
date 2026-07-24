/**
 * AiIncidentDetail — Full detail view for a single AI incident.
 *
 * Sections:
 * 1. Incident header (priority, status, ID)
 * 2. AI Detection summary (type, confidence, screenshot)
 * 3. Multi-factor severity breakdown (score, reasons)
 * 4. Temporal analysis (duration, growth, area history)
 * 5. Camera / location info
 * 6. Status audit trail timeline
 * 7. Action buttons for BFP personnel
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { AiIncident, AiIncidentStatusHistory } from '../types/ai-incident.types';
import { PRIORITY_CONFIG, STATUS_CONFIG, GROWTH_CONFIG } from '../types/ai-incident.types';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

// ── Time helpers ─────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

// ── Mini sparkline for area history ─────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <span className="text-xs text-slate-500">No data</span>;
  const max = Math.max(...data, 0.1);
  const w = 160, h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last value dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - (data[data.length - 1] / max) * h}
        r="3" fill={color}
      />
    </svg>
  );
}

// ── Audit trail entry ────────────────────────────────────────────────────────

function TimelineEntry({ entry, isFirst }: { entry: AiIncidentStatusHistory; isFirst: boolean }) {
  const sc = STATUS_CONFIG[entry.newStatus];
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${
          isFirst ? 'border-slate-500 bg-slate-700' : 'border-orange-500 bg-orange-600'
        }`} />
        <div className="w-px flex-1 bg-slate-700 mt-1" />
      </div>
      <div className="pb-4">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${sc.bgColor} ${sc.color}`}>
            {sc.label}
          </span>
          <span className="text-xs text-slate-400">by {entry.performedByName}</span>
        </div>
        <p className="text-xs text-slate-500">{fmt(entry.changedAt)}</p>
        {entry.remarks && (
          <p className="text-xs text-slate-300 mt-1 italic">&ldquo;{entry.remarks}&rdquo;</p>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AiIncidentDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { isBfpPersonnel } = useAuth();

  const [incident, setIncident] = useState<AiIncident | null>(null);
  const [history,  setHistory]  = useState<AiIncidentStatusHistory[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [remarks,  setRemarks]  = useState('');
  const [showRemarks, setShowRemarks] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<AiIncident>(`/ai/incidents/${id}`),
      api.get<AiIncidentStatusHistory[]>(`/ai/incidents/${id}/history`),
    ])
      .then(([r1, r2]) => {
        setIncident(r1.data);
        setHistory(r2.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const doStatus = async (status: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await api.patch<AiIncident>(`/ai/incidents/${id}/status`, {
        status, remarks: remarks || undefined,
      });
      setIncident(res.data);
      const histRes = await api.get<AiIncidentStatusHistory[]>(`/ai/incidents/${id}/history`);
      setHistory(histRes.data);
      setShowRemarks(false);
      setRemarks('');
      setPendingStatus(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!incident) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
      Incident not found.{' '}
      <Link to="/admin/dashboard" className="text-orange-400 ml-2">← Back</Link>
    </div>
  );

  const pc = PRIORITY_CONFIG[incident.priority];
  const sc = STATUS_CONFIG[incident.status];
  const gc = GROWTH_CONFIG[incident.growthStatus];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Back + nav */}
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button onClick={() => navigate(-1)} className="hover:text-white transition">
            ← Back
          </button>
          <span>/</span>
          <Link to="/admin/dashboard" className="hover:text-white transition">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-300 font-mono text-xs">{incident.id.slice(0, 8)}…</span>
        </div>

        {/* ── Header card ──────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${pc.bgColor} ${pc.color} ${pc.border}`}>
                  {pc.emoji} {incident.priority} PRIORITY
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bgColor} ${sc.color}`}>
                  {sc.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                  {incident.detectionType.replace('_', ' + ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">ID: {incident.id}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                First detected: {fmt(incident.firstDetectionTime)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">{incident.severityScore}<span className="text-base text-slate-400">/100</span></p>
              <p className="text-xs text-slate-400">Severity Score</p>
            </div>
          </div>
        </div>

        {/* ── Severity reasons ──────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-3">🔍 AI Severity Assessment</h2>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Severity Score</span>
              <span className="text-sm font-bold text-white">{incident.severityScore}/100</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  incident.severityScore >= 81 ? 'bg-red-500' :
                  incident.severityScore >= 61 ? 'bg-orange-500' :
                  incident.severityScore >= 31 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${incident.severityScore}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            {incident.severityReasons?.map((reason, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400 mt-0.5 text-xs flex-shrink-0">▸</span>
                <span>{reason}</span>
              </div>
            ))}
            {(!incident.severityReasons || incident.severityReasons.length === 0) && (
              <p className="text-xs text-slate-500">No severity reasons recorded.</p>
            )}
          </div>
        </div>

        {/* ── Temporal analysis ─────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-3">📈 Temporal Analysis</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Duration',    value: formatDuration(Number(incident.durationSeconds)) },
              { label: 'Frames',      value: incident.consecutiveFrameCount },
              { label: 'Growth',      value: <span className={gc.color}>{gc.icon} {gc.label}</span> },
              { label: 'Confidence',  value: `${(Number(incident.detectionConfidence) * 100).toFixed(0)}%` },
            ].map(item => (
              <div key={item.label} className="bg-slate-900/50 rounded-xl p-2.5 text-center">
                <p className="text-base font-bold text-white">{item.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Area history sparklines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {incident.fireAreaHistory?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">🔥 Fire Area History (%)</p>
                <Sparkline data={incident.fireAreaHistory} color="#ef4444" />
              </div>
            )}
            {incident.smokeAreaHistory?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5">💨 Smoke Area History (%)</p>
                <Sparkline data={incident.smokeAreaHistory} color="#94a3b8" />
              </div>
            )}
          </div>
        </div>

        {/* ── Camera / location ─────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-3">📷 Source Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-slate-500 text-xs">Camera ID</span><p className="font-mono text-slate-200">{incident.cameraId}</p></div>
            <div><span className="text-slate-500 text-xs">Camera Name</span><p className="text-slate-200">{incident.cameraName || '—'}</p></div>
            <div className="col-span-2"><span className="text-slate-500 text-xs">Location</span><p className="text-slate-200">{incident.cameraLocation || '—'}</p></div>
            {incident.latitude && incident.longitude && (
              <div className="col-span-2">
                <span className="text-slate-500 text-xs">Coordinates</span>
                <p className="font-mono text-slate-200">{Number(incident.latitude).toFixed(6)}, {Number(incident.longitude).toFixed(6)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Verification timestamps ───────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-3">👤 Human Verification</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              { label: 'Acknowledged By', value: incident.acknowledgedByName, time: incident.acknowledgedAt },
              { label: 'Verified By',     value: incident.verifiedByName,     time: incident.verifiedAt    },
            ].map(row => (
              <div key={row.label} className="bg-slate-900/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">{row.label}</p>
                <p className="text-slate-200 font-semibold">{row.value || '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fmt(row.time)}</p>
              </div>
            ))}
          </div>
          {incident.resolvedAt && (
            <p className="text-xs text-emerald-400 mt-2">✅ Resolved at {fmt(incident.resolvedAt)}</p>
          )}
        </div>

        {/* ── Action buttons ────────────────────────────── */}
        {isBfpPersonnel && !['RESOLVED', 'FALSE_ALARM'].includes(incident.status) && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
            <h2 className="text-sm font-bold text-slate-200 mb-3">⚡ Actions</h2>

            {showRemarks && (
              <div className="mb-3">
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Optional remark…"
                  className="w-full text-sm bg-slate-900/60 border border-slate-600 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-orange-500"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => doStatus(pendingStatus!)} disabled={busy}
                    className="px-4 py-2 text-sm rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold disabled:opacity-50 transition">
                    {busy ? 'Saving…' : 'Confirm'}
                  </button>
                  <button onClick={() => { setShowRemarks(false); setPendingStatus(null); setRemarks(''); }}
                    className="px-4 py-2 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showRemarks && (
              <div className="flex flex-wrap gap-2">
                {incident.status === 'UNVERIFIED' && (
                  <button onClick={() => doStatus('ACKNOWLEDGED')} disabled={busy}
                    className="px-4 py-2 text-sm rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:opacity-50">
                    👁 Acknowledge
                  </button>
                )}
                {['UNVERIFIED', 'ACKNOWLEDGED'].includes(incident.status) && (
                  <>
                    <button onClick={() => { setPendingStatus('VERIFIED_FIRE'); setShowRemarks(true); }} disabled={busy}
                      className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:opacity-50">
                      🔥 Verify Fire
                    </button>
                    <button onClick={() => { setPendingStatus('POSSIBLE_FIRE'); setShowRemarks(true); }} disabled={busy}
                      className="px-4 py-2 text-sm rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition disabled:opacity-50">
                      ⚠ Possible Fire
                    </button>
                    <button onClick={() => { setPendingStatus('FALSE_ALARM'); setShowRemarks(true); }} disabled={busy}
                      className="px-4 py-2 text-sm rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition disabled:opacity-50">
                      ✓ False Alarm
                    </button>
                    <button onClick={() => { setPendingStatus('SMOKE_ONLY'); setShowRemarks(true); }} disabled={busy}
                      className="px-4 py-2 text-sm rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold transition disabled:opacity-50">
                      💨 Smoke Only
                    </button>
                  </>
                )}
                {incident.status === 'VERIFIED_FIRE' && (
                  <button onClick={() => { setPendingStatus('RESPONSE_INITIATED'); setShowRemarks(true); }} disabled={busy}
                    className="px-4 py-2 text-sm rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold transition disabled:opacity-50">
                    🚒 Response Initiated
                  </button>
                )}
                {['VERIFIED_FIRE', 'RESPONSE_INITIATED', 'SMOKE_ONLY', 'POSSIBLE_FIRE'].includes(incident.status) && (
                  <button onClick={() => { setPendingStatus('RESOLVED'); setShowRemarks(true); }} disabled={busy}
                    className="px-4 py-2 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition disabled:opacity-50">
                    ✅ Mark Resolved
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Audit trail ───────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-4">📋 Status Audit Trail</h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No history recorded yet.</p>
          ) : (
            <div>
              {history.map((entry, i) => (
                <TimelineEntry key={entry.id} entry={entry} isFirst={i === 0} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
