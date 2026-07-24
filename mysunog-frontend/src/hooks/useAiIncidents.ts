/**
 * useAiIncidents — React hook for AI incident state management.
 *
 * Responsibilities:
 * 1. Fetch active incidents from GET /ai/incidents/active on mount.
 * 2. Subscribe to Socket.IO /detection namespace for real-time updates.
 * 3. Play an alert sound on CRITICAL/HIGH new incidents.
 * 4. Expose mutation functions (acknowledge, updateStatus) that call
 *    the NestJS REST endpoints.
 *
 * Usage:
 *   const { incidents, unacknowledged, updateStatus, loading } = useAiIncidents();
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import type { AiIncident, AiIncidentStatus } from '../types/ai-incident.types';

const SOCKET_URL  = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;
const ALERT_SOUND = '/alert.mp3'; // Place alert.mp3 in public/

// Terminal statuses — incidents in these states are removed from active list
const TERMINAL: AiIncidentStatus[] = ['FALSE_ALARM', 'RESOLVED'];

export interface UpdateStatusPayload {
  status:   AiIncidentStatus;
  remarks?: string;
}

export function useAiIncidents() {
  const [incidents, setIncidents]     = useState<AiIncident[]>([]);
  const [loading,   setLoading]       = useState(true);
  const [error,     setError]         = useState<string | null>(null);
  const socketRef                      = useRef<Socket | null>(null);
  const audioRef                       = useRef<HTMLAudioElement | null>(null);

  // Pre-load audio element
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND);
    audioRef.current.volume = 0.7;
  }, []);

  const playAlert = useCallback(() => {
    audioRef.current?.play().catch(() => {
      // Browser may block autoplay — silently ignore
    });
  }, []);

  // ── Initial fetch ────────────────────────────────────────────────────────
  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<AiIncident[]>('/ai/incidents/active');
      setIncidents(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // ── Socket.IO subscription ───────────────────────────────────────────────
  useEffect(() => {
    const token  = localStorage.getItem('token');
    const socket = io(`${SOCKET_URL}/detection`, {
      path:             '/socket.io',
      transports:       ['websocket', 'polling'],
      auth:             token ? { token } : undefined,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useAiIncidents] Socket connected:', socket.id);
    });

    // ── New incident created by AI service ──────────────────────────────
    socket.on('ai_incident:new', (incident: AiIncident) => {
      console.log('[useAiIncidents] ai_incident:new', incident.id, incident.priority);

      // Prepend to top of list
      setIncidents(prev => {
        // Deduplicate by id
        const filtered = prev.filter(i => i.id !== incident.id);
        return [incident, ...filtered];
      });

      // Sound alert for HIGH/CRITICAL
      if (incident.priority === 'CRITICAL' || incident.priority === 'HIGH') {
        playAlert();
      }
    });

    // ── Incident updated (status change, severity escalation) ───────────
    socket.on('ai_incident:updated', (incident: AiIncident) => {
      console.log('[useAiIncidents] ai_incident:updated', incident.id, incident.status);

      setIncidents(prev => {
        // If terminal, remove from active list
        if (TERMINAL.includes(incident.status)) {
          return prev.filter(i => i.id !== incident.id);
        }
        // Otherwise update in place
        return prev.map(i => i.id === incident.id ? incident : i);
      });
    });

    // ── Incident resolved ───────────────────────────────────────────────
    socket.on('ai_incident:resolved', ({ id }: { id: string }) => {
      setIncidents(prev => prev.filter(i => i.id !== id));
    });

    socket.on('disconnect', () => {
      console.log('[useAiIncidents] Socket disconnected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[useAiIncidents] Socket error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ────────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (
    incidentId: string,
    payload: UpdateStatusPayload,
  ): Promise<void> => {
    await api.patch(`/ai/incidents/${incidentId}/status`, payload);
    // The Socket.IO event will update local state — no need to refetch
  }, []);

  const acknowledge = useCallback(async (incidentId: string): Promise<void> => {
    await updateStatus(incidentId, { status: 'ACKNOWLEDGED' });
  }, [updateStatus]);

  const verifyFire = useCallback(async (incidentId: string, remarks?: string): Promise<void> => {
    await updateStatus(incidentId, { status: 'VERIFIED_FIRE', remarks });
  }, [updateStatus]);

  const markFalseAlarm = useCallback(async (incidentId: string, remarks?: string): Promise<void> => {
    await updateStatus(incidentId, { status: 'FALSE_ALARM', remarks });
  }, [updateStatus]);

  const markResolved = useCallback(async (incidentId: string, remarks?: string): Promise<void> => {
    await updateStatus(incidentId, { status: 'RESOLVED', remarks });
  }, [updateStatus]);

  // Count incidents not yet acknowledged
  const unacknowledged = incidents.filter(i => i.status === 'UNVERIFIED').length;

  return {
    incidents,
    loading,
    error,
    unacknowledged,
    refresh:       fetchActive,
    updateStatus,
    acknowledge,
    verifyFire,
    markFalseAlarm,
    markResolved,
  };
}
