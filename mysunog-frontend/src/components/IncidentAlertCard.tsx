/**
 * IncidentAlertCard — The primary interactive alert component for a single AI incident.
 *
 * Shows:
 * - Priority badge (color-coded, pulsing if CRITICAL/UNVERIFIED)
 * - Detection type, camera name, location
 * - Severity score + interpretable reasons
 * - Fire growth status with icon
 * - Time since detection
 * - Action buttons: Acknowledge / Verify Fire / False Alarm / More
 *
 * Design: Glassmorphism-style card, dark theme compatible, smooth animations.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AiIncident } from '../types/ai-incident.types';
import type { UpdateStatusPayload } from '../hooks/useAiIncidents';
import { PRIORITY_CONFIG, STATUS_CONFIG, GROWTH_CONFIG } from '../types/ai-incident.types';

// ── Time helpers ─────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60)  return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  incident:      AiIncident;
  onAcknowledge: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, payload: UpdateStatusPayload) => Promise<void>;
  isCompact?:    boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IncidentAlertCard({
  incident,
  onAcknowledge,
  onUpdateStatus,
  isCompact = false,
}: Props) {
  const [busy,        setBusy]        = useState(false);
  const [showRemarks, setShowRemarks] = useState(false);
  const [remarks,     setRemarks]     = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const pc = PRIORITY_CONFIG[incident.priority];
  const sc = STATUS_CONFIG[incident.status];
  const gc = GROWTH_CONFIG[incident.growthStatus];
  const isUnverified  = incident.status === 'UNVERIFIED';
  const isAcknowledged = incident.status === 'ACKNOWLEDGED';
  const isCritical    = incident.priority === 'CRITICAL';
  const isHigh        = incident.priority === 'HIGH';
  const needsAttention = isUnverified || isAcknowledged;

  const doAction = useCallback(async (action: string) => {
    setBusy(true);
    try {
      if (action === 'acknowledge') {
        await onAcknowledge(incident.id);
      } else {
        await onUpdateStatus(incident.id, {
          status:  action as any,
          remarks: remarks || undefined,
        });
      }
      setShowRemarks(false);
      setRemarks('');
      setPendingAction(null);
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setBusy(false);
    }
  }, [incident.id, onAcknowledge, onUpdateStatus, remarks]);

  const requestAction = (action: string) => {
    if (['VERIFIED_FIRE', 'FALSE_ALARM', 'SMOKE_ONLY', 'POSSIBLE_FIRE', 'RESOLVED'].includes(action)) {
      setPendingAction(action);
      setShowRemarks(true);
    } else {
      doAction(action);
    }
  };

  return (
    <div
      className={`
        relative rounded-2xl border transition-all duration-300
        ${isCritical
          ? 'border-red-700 bg-gradient-to-br from-red-950/80 to-red-900/60 shadow-lg shadow-red-900/40'
          : isHigh
          ? 'border-red-400/60 bg-gradient-to-br from-red-950/50 to-slate-900/80 shadow-md shadow-red-800/20'
          : 'border-slate-700/60 bg-gradient-to-br from-slate-900/80 to-slate-800/60 shadow-md'
        }
        ${needsAttention && isCritical ? 'animate-pulse-slow' : ''}
      `}
      id={`incident-${incident.id}`}
    >
      {/* Priority accent strip */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
          isCritical ? 'bg-red-500' : isHigh ? 'bg-orange-500' : incident.priority === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-400'
        }`}
      />

      <div className="pl-4 pr-4 pt-4 pb-3">
        {/* ── Header row ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {/* Priority + Detection badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`
              inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border
              ${pc.bgColor} ${pc.color} ${pc.border}
              ${isCritical ? 'animate-pulse' : ''}
            `}>
              {pc.emoji} {incident.priority}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/70 text-slate-200 border border-slate-600">
              {incident.detectionType === 'FIRE_AND_SMOKE' ? '🔥💨' : incident.detectionType === 'FIRE' ? '🔥' : '💨'}
              {' '}{incident.detectionType.replace('_', ' + ')}
            </span>
            <span className={`
              inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
              ${sc.bgColor.replace('bg-', 'bg-opacity-20 border-').replace('-100', '-500/30')} ${sc.color}
            `}>
              {sc.label}
            </span>
          </div>

          {/* Time */}
          <span className="text-xs text-slate-400 whitespace-nowrap mt-0.5">
            {timeAgo(incident.createdAt)}
          </span>
        </div>

        {/* ── Location info ──────────────────────────────────── */}
        <div className="mb-2">
          <p className="text-sm font-semibold text-white leading-tight">
            📷 {incident.cameraName || incident.cameraId}
          </p>
          {incident.cameraLocation && (
            <p className="text-xs text-slate-400 mt-0.5">
              📍 {incident.cameraLocation}
            </p>
          )}
        </div>

        {/* ── Severity row ──────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {/* Severity score */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  incident.severityScore >= 81 ? 'bg-red-500' :
                  incident.severityScore >= 61 ? 'bg-orange-500' :
                  incident.severityScore >= 31 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${incident.severityScore}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-200">
              {incident.severityScore}/100
            </span>
          </div>

          {/* Growth status */}
          <span className={`text-xs font-semibold ${gc.color}`}>
            {gc.icon} {gc.label}
          </span>

          {/* Duration */}
          <span className="text-xs text-slate-400">
            ⏱ {formatDuration(Number(incident.durationSeconds))}
          </span>

          {/* Confidence */}
          <span className="text-xs text-slate-400">
            AI: {(Number(incident.detectionConfidence) * 100).toFixed(0)}%
          </span>
        </div>

        {/* ── Severity reasons (collapsed if compact) ───────── */}
        {!isCompact && incident.severityReasons?.length > 0 && (
          <div className="mb-3 space-y-1">
            {incident.severityReasons.slice(0, 3).map((reason, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>{reason}</span>
              </div>
            ))}
            {incident.severityReasons.length > 3 && (
              <p className="text-xs text-slate-500">+{incident.severityReasons.length - 3} more reasons</p>
            )}
          </div>
        )}

        {/* ── Remarks input (shown before confirming action) ── */}
        {showRemarks && (
          <div className="mb-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-600">
            <p className="text-xs text-slate-400 mb-1.5">
              Add a remark for &ldquo;{pendingAction?.replace('_', ' ')}&rdquo; (optional):
            </p>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={2}
              placeholder="e.g. Verified via camera 2 — smoke from BBQ"
              className="w-full text-xs bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => doAction(pendingAction!)}
                disabled={busy}
                className="px-3 py-1 text-xs rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold disabled:opacity-50 transition"
              >
                {busy ? 'Saving…' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowRemarks(false); setPendingAction(null); setRemarks(''); }}
                className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────── */}
        {!showRemarks && (
          <div className="flex items-center gap-2 flex-wrap">
            {isUnverified && (
              <button
                onClick={() => doAction('acknowledge')}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:opacity-50"
                id={`ack-btn-${incident.id}`}
              >
                {busy ? '…' : '👁 Acknowledge'}
              </button>
            )}
            {(isUnverified || isAcknowledged) && (
              <>
                <button
                  onClick={() => requestAction('VERIFIED_FIRE')}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:opacity-50"
                  id={`verify-btn-${incident.id}`}
                >
                  🔥 Verify Fire
                </button>
                <button
                  onClick={() => requestAction('FALSE_ALARM')}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition disabled:opacity-50"
                  id={`false-alarm-btn-${incident.id}`}
                >
                  ✓ False Alarm
                </button>
                <button
                  onClick={() => requestAction('SMOKE_ONLY')}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold transition disabled:opacity-50"
                >
                  💨 Smoke Only
                </button>
              </>
            )}
            {incident.status === 'VERIFIED_FIRE' && (
              <button
                onClick={() => requestAction('RESPONSE_INITIATED')}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold transition disabled:opacity-50"
              >
                🚒 Response Initiated
              </button>
            )}
            {['VERIFIED_FIRE', 'RESPONSE_INITIATED', 'SMOKE_ONLY', 'POSSIBLE_FIRE'].includes(incident.status) && (
              <button
                onClick={() => requestAction('RESOLVED')}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition disabled:opacity-50"
              >
                ✅ Resolve
              </button>
            )}

            {/* Detail link */}
            <Link
              to={`/admin/ai-incidents/${incident.id}`}
              className="ml-auto px-3 py-1.5 text-xs rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition"
            >
              Details →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
