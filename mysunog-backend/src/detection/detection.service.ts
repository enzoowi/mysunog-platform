import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DetectionEvent,
  DetectionType,
  SeverityLevel,
} from './detection-event.entity';
import { Camera } from './camera.entity';
import { CreateDetectionEventDto } from './dto/create-detection-event.dto';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { EmailAlertsService } from '../email-alerts/email-alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DetectionService implements OnModuleInit {
  private readonly logger = new Logger(DetectionService.name);

  /** URL of the Python AI microservice */
  private readonly aiServiceUrl: string;

  /** Shared API key for authenticating with the AI service */
  private readonly serviceApiKey: string;

  /** Throttle emails per camera to avoid spamming on every broadcast-alert frame */
  private lastEmailSentAt: Map<string, number> = new Map();

  constructor(
    @InjectRepository(DetectionEvent)
    private detectionEventRepository: Repository<DetectionEvent>,
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
    private readonly emailAlertsService: EmailAlertsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.serviceApiKey =
      process.env.SERVICE_API_KEY || 'mysunog-ai-secret-key-2024';
  }

  async onModuleInit() {
    this.logger.log('Syncing active cameras with AI Service...');
    // Small delay to ensure AI service is up
    setTimeout(() => this.syncCameras(), 5000);
  }

  async syncCameras() {
    try {
      const activeCameras = await this.cameraRepository.find({
        where: { isActive: true },
      });
      for (const cam of activeCameras) {
        if (cam.streamUrl) {
          await this.connectExternalCamera(
            cam.id.toString(),
            cam.streamUrl,
            cam.name,
            cam.location,
            cam.latitude,
            cam.longitude,
          );
        }
      }
      this.logger.log(`Synced ${activeCameras.length} cameras with AI service.`);
    } catch (err) {
      this.logger.error(`Failed to sync cameras: ${err.message}`);
    }
  }

  // ─── AI SERVICE COMMUNICATION ──────────────────────────────────

  /**
   * Send a single frame to the Python AI service for analysis.
   * If fire/smoke is detected, saves the event to the database.
   */
  async analyzeFrame(
    imageBase64: string,
    cameraId?: string,
    latitude?: number,
    longitude?: number,
  ) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/detect/frame`,
        {
          image_base64: imageBase64,
          camera_id: cameraId || 'webcam',
          latitude,
          longitude,
        },
        {
          headers: { 'X-API-Key': this.serviceApiKey },
          timeout: 10000,
        },
      );

      const data = response.data;

      if (data.success && data.result?.detected) {
        // Save detection event to database
        const event = await this.createDetectionEvent({
          detectionType: this.mapDetectionType(data.result.detection_types),
          confidence: data.result.max_confidence,
          severity: this.mapSeverity(data.result.severity),
          cameraSource: cameraId || 'webcam',
          latitude,
          longitude,
          rawDetections: data.result.detections,
        });

        this.logger.log(`Detection received. Confidence: ${event.confidence}, Type: ${event.detectionType}`);
        
        if (Number(event.confidence) >= 0.70) {
          this.logger.log(`Confidence ${event.confidence} is >= 0.70. Triggering email and in-app alerts...`);
          let cameraName = cameraId || 'webcam';
          let location = 'Unknown';
          if (cameraId && !isNaN(parseInt(cameraId))) {
            const cam = await this.cameraRepository.findOne({ where: { id: parseInt(cameraId) } });
            if (cam) {
              cameraName = cam.name;
              location = cam.location;
            }
          }
          let aiAdviceText = '';
          try {
            const aiAdviceResult = await this.notificationsService.getAiAdviceFromAlert({
              title: 'Detection Alert',
              message: '',
              detectionType: event.detectionType,
              confidence: event.confidence,
              severity: event.severity,
              cameraSource: cameraName,
              latitude: event.latitude,
              longitude: event.longitude,
              rawDetections: event.rawDetections,
            });
            aiAdviceText = aiAdviceResult.advice;
          } catch (e) {
            this.logger.warn(`Could not generate AI advice for email: ${e.message}`);
          }
          this.emailAlertsService.sendDetectionAlert(event, cameraName, location, aiAdviceText).catch(err => this.logger.error(`Email Error: ${err.message}`));

          // Notify Admins and BFP Personnel
          try {
            const personnel = await this.usersService.findAdminsAndBfp();
            const dateStr = new Date(event.createdAt).toLocaleString();
            const confPct = Math.round(Number(event.confidence) * 100);

            // Build CCTV analysis summary from raw detections
            const raws = event.rawDetections || [];
            const fireZones = raws.filter((d: any) => d.detection_type === 'fire');
            const smokeZones = raws.filter((d: any) => d.detection_type === 'smoke');
            const totalFireArea = fireZones.reduce((s: number, d: any) => s + (d.area_percentage || 0), 0);
            const totalSmokeArea = smokeZones.reduce((s: number, d: any) => s + (d.area_percentage || 0), 0);

            let detailMsg = `${event.detectionType.toUpperCase()} detected at ${location} (${cameraName}). Confidence: ${confPct}%. Severity: ${event.severity.toUpperCase()}. Time: ${dateStr}.`;
            detailMsg += ` | CCTV Analysis: ${fireZones.length} fire zone(s) covering ${totalFireArea.toFixed(1)}% of frame, ${smokeZones.length} smoke zone(s) covering ${totalSmokeArea.toFixed(1)}% of frame.`;
            if (totalFireArea > 10) detailMsg += ' Fire is spreading across a large area.';
            if (smokeZones.length > 0 && fireZones.length === 0) detailMsg += ' Smoke only — fire source may be hidden or developing.';

            for (const p of personnel) {
              await this.notificationsService.createNotification(
                p,
                'AI Detection Alert',
                detailMsg,
                'alert',
                '/admin/ai-detection'
              );
            }
          } catch (error) {
            this.logger.error(`Notification Error: ${error.message}`);
          }
        }

        return {
          detected: true,
          event,
          result: data.result,
        };
      }

      return {
        detected: false,
        result: data.result,
      };
    } catch (error) {
      this.logger.error(`AI service error: ${error.message}`);
      return {
        detected: false,
        error: 'AI service unavailable',
      };
    }
  }

  /**
   * Forward an uploaded video file to the Python AI service for analysis.
   */
  async analyzeVideo(filePath: string) {
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(
        `${this.aiServiceUrl}/detect/video`,
        formData,
        {
          headers: {
            'X-API-Key': this.serviceApiKey,
            ...formData.getHeaders(),
          },
          timeout: 600000, // 10 min timeout for video processing
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      const data = response.data;

      if (data.success && data.detection_events?.length > 0) {
        // Save each detection event to the database
        const savedEvents: DetectionEvent[] = [];

        for (const det of data.detection_events) {
          const event = await this.createDetectionEvent({
            detectionType: this.mapDetectionType(det.detection_types),
            confidence: det.max_confidence,
            severity: this.mapSeverity(det.severity),
            cameraSource: 'upload',
            rawDetections: det.detections,
          });

          this.logger.log(`Video detection received. Confidence: ${event.confidence}`);
          if (Number(event.confidence) >= 0.70) {
            this.logger.log(`Video detection confidence ${event.confidence} is >= 0.70. Triggering email and in-app alerts...`);
            let aiAdviceText = '';
            try {
              const aiAdviceResult = await this.notificationsService.getAiAdviceFromAlert({
                title: 'Detection Alert',
                message: '',
                detectionType: event.detectionType,
                confidence: event.confidence,
                severity: event.severity,
                cameraSource: 'Uploaded Video',
                latitude: event.latitude,
                longitude: event.longitude,
                rawDetections: event.rawDetections,
              });
              aiAdviceText = aiAdviceResult.advice;
            } catch (e) {
              this.logger.warn(`Could not generate AI advice for video upload email: ${e.message}`);
            }
            this.emailAlertsService.sendDetectionAlert(event, 'Uploaded Video', 'Unknown', aiAdviceText).catch(err => this.logger.error(`Email Error: ${err.message}`));

            // Notify Admins and BFP Personnel
            try {
              const personnel = await this.usersService.findAdminsAndBfp();
              const dateStr = new Date(event.createdAt).toLocaleString();
              const confPct = Math.round(Number(event.confidence) * 100);
              for (const p of personnel) {
                await this.notificationsService.createNotification(
                  p,
                  'AI Video Detection Alert',
                  `${event.detectionType.toUpperCase()} detected in uploaded video. Confidence: ${confPct}%. Time: ${dateStr}.`,
                  'alert',
                  '/admin/ai-detection'
                );
              }
            } catch (error) {
              this.logger.error(`Notification Error: ${error.message}`);
            }
          }

          savedEvents.push(event);
        }

        return {
          success: true,
          totalFramesProcessed: data.total_frames_processed,
          totalDetections: savedEvents.length,
          events: savedEvents,
        };
      }

      return {
        success: true,
        totalFramesProcessed: data.total_frames_processed || 0,
        totalDetections: 0,
        events: [],
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        error.message ||
        'Unknown error';
      this.logger.error(`Video analysis error: ${errMsg}`);
      return {
        success: false,
        error: `Video analysis failed: ${errMsg}`,
      };
    }
  }

  // ─── CRUD OPERATIONS ──────────────────────────────────────────

  async createDetectionEvent(
    dto: CreateDetectionEventDto,
  ): Promise<DetectionEvent> {
    const event = this.detectionEventRepository.create(dto);
    return this.detectionEventRepository.save(event);
  }

  async findAllEvents(limit = 50, offset = 0) {
    return this.detectionEventRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findEventById(id: number) {
    return this.detectionEventRepository.findOne({ where: { id } });
  }

  async deleteEvent(id: number) {
    return this.detectionEventRepository.delete(id);
  }

  async getDetectionStats() {
    const events = await this.detectionEventRepository.find();

    const totalDetections = events.length;
    const fireCount = events.filter(
      (e) => e.detectionType === DetectionType.FIRE,
    ).length;
    const smokeCount = events.filter(
      (e) => e.detectionType === DetectionType.SMOKE,
    ).length;

    const severityCounts = {
      low: events.filter((e) => e.severity === SeverityLevel.LOW).length,
      medium: events.filter((e) => e.severity === SeverityLevel.MEDIUM).length,
      high: events.filter((e) => e.severity === SeverityLevel.HIGH).length,
      critical: events.filter((e) => e.severity === SeverityLevel.CRITICAL)
        .length,
    };

    // Detections in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDetections = events.filter(
      (e) => new Date(e.createdAt) > oneDayAgo,
    ).length;

    // Average confidence
    const avgConfidence =
      totalDetections > 0
        ? events.reduce((sum, e) => sum + Number(e.confidence), 0) /
          totalDetections
        : 0;

    return {
      totalDetections,
      fireCount,
      smokeCount,
      severityCounts,
      recentDetections,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
    };
  }

  // ─── CAMERA MANAGEMENT ────────────────────────────────────────

  async createCamera(dto: CreateCameraDto): Promise<Camera> {
    const camera = this.cameraRepository.create(dto);
    const saved = await this.cameraRepository.save(camera);
    if (saved.isActive && saved.streamUrl) {
      await this.connectExternalCamera(
        saved.id.toString(),
        saved.streamUrl,
        saved.name,
        saved.location,
        saved.latitude,
        saved.longitude,
      );
    }
    return saved;
  }

  async updateCamera(id: number, dto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.cameraRepository.findOne({ where: { id } });
    if (!camera) throw new Error('Camera not found');
    
    await this.disconnectExternalCamera(id.toString());
    
    Object.assign(camera, dto);
    const updated = await this.cameraRepository.save(camera);
    
    if (updated.isActive && updated.streamUrl) {
      await this.connectExternalCamera(
        updated.id.toString(),
        updated.streamUrl,
        updated.name,
        updated.location,
        updated.latitude,
        updated.longitude,
      );
    }
    
    return updated;
  }

  async findAllCameras() {
    return this.cameraRepository.find({ order: { createdAt: 'DESC' } });
  }

  async deleteCamera(id: number) {
    await this.disconnectExternalCamera(id.toString());
    return this.cameraRepository.delete(id);
  }

  // ─── AI SERVICE HEALTH ────────────────────────────────────────

  async checkAiServiceHealth() {
    try {
      const response = await axios.get(`${this.aiServiceUrl}/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch {
      return { status: 'unavailable', model_loaded: false };
    }
  }

  // ─── EXTERNAL CAMERA STREAM ───────────────────────────────────

  /**
   * Connect the AI service to an external camera (RTSP, HTTP MJPEG, etc.)
   */
  async connectExternalCamera(
    cameraId: string,
    cameraUrl: string,
    cameraName?: string,
    cameraLocation?: string,
    latitude?: number,
    longitude?: number,
  ) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/stream/connect`,
        {
          camera_id: cameraId,
          url: cameraUrl,
          camera_name: cameraName,
          camera_location: cameraLocation,
          latitude,
          longitude,
        },
        {
          headers: { 'X-API-Key': this.serviceApiKey },
          timeout: 15000,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to connect external camera ${cameraId}: ${error.message}`);
      return { success: false, message: 'AI service unavailable' };
    }
  }

  /**
   * Disconnect the current external camera from the AI service.
   */
  async disconnectExternalCamera(cameraId: string) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/stream/disconnect/${cameraId}`,
        {},
        {
          headers: { 'X-API-Key': this.serviceApiKey },
          timeout: 5000,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to disconnect camera ${cameraId}: ${error.message}`);
      return { success: false, message: 'AI service unavailable' };
    }
  }

  /**
   * Get the current external camera stream status from the AI service.
   */
  async getStreamStatus() {
    try {
      const response = await axios.get(`${this.aiServiceUrl}/stream/status`, {
        timeout: 5000,
      });
      return response.data; // returns dict of camera_id -> status
    } catch {
      return {};
    }
  }

  /**
   * Called by the real-time broadcast-alert endpoint.
   * Sends an email but throttles it to once every 2 minutes per camera.
   */
  async triggerBroadcastEmail(body: any): Promise<void> {
    if (body.confidence < 0.70) return;

    const cameraId = body.cameraId || 'unknown';
    const now = Date.now();
    const lastSent = this.lastEmailSentAt.get(cameraId) || 0;

    // Cooldown: 2 minutes
    if (now - lastSent < 2 * 60 * 1000) {
      return;
    }
    this.lastEmailSentAt.set(cameraId, now);

    this.logger.log(`[Broadcast Email] Triggering email for camera ${cameraId} (Confidence: ${body.confidence})`);

    const mockEvent = new DetectionEvent();
    mockEvent.detectionType = body.detectionType === 'smoke' ? DetectionType.SMOKE : DetectionType.FIRE;
    mockEvent.confidence = body.confidence;
    mockEvent.severity = body.severity || 'high';
    mockEvent.createdAt = new Date();
    mockEvent.cameraSource = body.cameraName || body.cameraId || 'External Camera';

    this.emailAlertsService.sendDetectionAlert(
      mockEvent,
      mockEvent.cameraSource,
      'Live Camera Stream'
    ).catch(err => this.logger.error(`Broadcast Email Error: ${err.message}`));
  }

  // ─── ANALYZE FRAME (Base64) ────────────────────────────────────────────────

  // ─── PRIVATE HELPERS ──────────────────────────────────────────

  private mapDetectionType(types: string[]): DetectionType {
    if (types?.includes('fire')) return DetectionType.FIRE;
    if (types?.includes('smoke')) return DetectionType.SMOKE;
    return DetectionType.FIRE;
  }

  private mapSeverity(severity: string): SeverityLevel {
    const map: Record<string, SeverityLevel> = {
      low: SeverityLevel.LOW,
      medium: SeverityLevel.MEDIUM,
      high: SeverityLevel.HIGH,
      critical: SeverityLevel.CRITICAL,
    };
    return map[severity] || SeverityLevel.LOW;
  }
}
