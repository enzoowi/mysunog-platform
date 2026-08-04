import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DetectionEvent } from './detection-event.entity';

/**
 * DetectionGateway — Socket.IO gateway for all real-time events.
 *
 * Namespace: /detection
 *
 * Events emitted:
 *   detection:fire-alert      — raw per-frame detection (existing)
 *   detection:stats-update    — detection statistics (existing)
 *   ai_incident:new           — NEW: a new AI incident was created
 *   ai_incident:updated       — NEW: an existing incident's data changed
 *   ai_incident:resolved      — NEW: an incident reached a terminal status
 *   camera:status-change      — NEW: a camera went online/offline
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/detection',
})
export class DetectionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DetectionGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Detection WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Existing Events (keep for backward compatibility) ─────────────────

  /**
   * Broadcast a fire/smoke detection alert to all connected clients.
   * Called by the DetectionController when a raw detection event is saved.
   */
  broadcastFireAlert(event: DetectionEvent) {
    this.logger.warn(
      `🔥 FIRE ALERT — ${event.detectionType} detected ` +
        `(confidence: ${(Number(event.confidence) * 100).toFixed(0)}%, ` +
        `severity: ${event.severity})`,
    );

    this.server.emit('detection:fire-alert', {
      id:             event.id,
      detectionType:  event.detectionType,
      confidence:     event.confidence,
      severity:       event.severity,
      cameraSource:   event.cameraSource,
      latitude:       event.latitude,
      longitude:      event.longitude,
      rawDetections:  event.rawDetections,
      imageUrl:       event.imageUrl,
      createdAt:      event.createdAt,
    });
  }

  /**
   * Broadcast updated detection statistics to all connected clients.
   */
  broadcastStatsUpdate(stats: any) {
    this.server.emit('detection:stats-update', stats);
  }

  // ─── New AI Incident Events ─────────────────────────────────────────────

  /**
   * Broadcast a newly created AI incident to all dashboard clients.
   * The payload includes the full incident object so the React client can
   * render the alert card immediately without a follow-up REST fetch.
   *
   * Event name: 'ai_incident:new'
   */
  broadcastAiIncidentNew(incident: any) {
    this.logger.warn(
      `🚨 BROADCAST ai_incident:new — id=${incident.id} ` +
      `priority=${incident.priority} severity=${incident.severityScore} ` +
      `camera=${incident.cameraId}`,
    );
    this.server.emit('ai_incident:new', incident);
  }

  /**
   * Broadcast an updated AI incident (severity/priority/status changed).
   *
   * Event name: 'ai_incident:updated'
   */
  broadcastAiIncidentUpdated(incident: any) {
    this.logger.log(
      `📡 BROADCAST ai_incident:updated — id=${incident.id} ` +
      `status=${incident.status} priority=${incident.priority}`,
    );
    this.server.emit('ai_incident:updated', incident);
  }

  /**
   * Broadcast when an incident reaches a terminal status (RESOLVED / FALSE_ALARM).
   * The frontend uses this to remove the incident from the active list.
   *
   * Event name: 'ai_incident:resolved'
   */
  broadcastAiIncidentResolved(incidentId: string, status: string) {
    this.logger.log(`✅ BROADCAST ai_incident:resolved — id=${incidentId} status=${status}`);
    this.server.emit('ai_incident:resolved', { id: incidentId, status });
  }

  /**
   * Broadcast a camera status change.
   *
   * Event name: 'camera:status-change'
   */
  broadcastCameraStatusChange(cameraId: string | number, status: 'ONLINE' | 'OFFLINE' | 'ERROR') {
    this.server.emit('camera:status-change', { cameraId, status });
  }

  /**
   * Broadcast a notification event so all connected clients can instantly
   * update their unread bell counter without waiting for a route-change poll.
   *
   * Event name: 'notification:new'
   */
  broadcastNotification(payload: { title: string; message: string; link?: string | null }) {
    this.server.emit('notification:new', payload);
  }
}
