import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`;

export type DetectionAlert = {
  id: number;
  detectionType: string;
  confidence: number;
  severity: string;
  cameraSource: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

// Also import AiIncident if needed, or map fields manually
export type AiIncidentPayload = {
  id: string;
  detectionType: string;
  detectionConfidence: number;
  priority: string;
  cameraId: string;
  cameraName?: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

/**
 * Custom React hook for connecting to the detection WebSocket namespace.
 *
 * Returns:
 * - alerts: Array of recent detection alerts received via WebSocket
 * - connected: Whether the socket is currently connected
 * - latestAlert: The most recent alert (for toast notifications)
 */
export function useDetectionSocket() {
  const [alerts, setAlerts] = useState<DetectionAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const [latestAlert, setLatestAlert] = useState<DetectionAlert | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearLatestAlert = useCallback(() => {
    setLatestAlert(null);
  }, []);

  useEffect(() => {
    // Connect to the /detection namespace
    const socket = io(`${BACKEND_URL}/detection`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected to detection namespace');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected from detection namespace');
      setConnected(false);
    });

    // Listen for fire/smoke alerts from webcam
    socket.on('detection:fire-alert', (data: DetectionAlert) => {
      console.log('[WS] Fire alert received:', data);
      setAlerts((prev) => [data, ...prev].slice(0, 100)); // Keep last 100
      setLatestAlert(data);
    });

    // Listen for AI incidents from multi-camera feeds
    socket.on('ai_incident:new', (incident: AiIncidentPayload) => {
      console.log('[WS] New AI Incident received:', incident);
      const alert: DetectionAlert = {
        id: (incident.id as any),
        detectionType: incident.detectionType?.toLowerCase() || 'fire',
        confidence: incident.detectionConfidence || 0,
        severity: incident.priority?.toLowerCase() || 'high',
        cameraSource: incident.cameraName || incident.cameraId || 'External Camera',
        latitude: incident.latitude,
        longitude: incident.longitude,
        createdAt: incident.createdAt || new Date().toISOString(),
      };
      setAlerts((prev) => [alert, ...prev].slice(0, 100)); // Keep last 100
      setLatestAlert(alert);
    });

    // Listen for stats updates
    socket.on('detection:stats-update', (data: any) => {
      console.log('[WS] Stats update received:', data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { alerts, connected, latestAlert, clearLatestAlert };
}
