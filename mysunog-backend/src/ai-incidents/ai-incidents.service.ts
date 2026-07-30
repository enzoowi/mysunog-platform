import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AiIncident } from './ai-incident.entity';
import { AiIncidentStatusHistory } from './ai-incident-status-history.entity';
import { CreateAiIncidentDto } from './dto/create-ai-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import * as fs from 'fs';
import * as path from 'path';
import {
  AiIncidentStatus,
  AiDetectionType,
  FireGrowthStatus,
  IncidentPriority,
  ACTIVE_STATUSES,
} from './enums';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DetectionGateway } from '../detection/detection.gateway';
import { EmailAlertsService } from '../email-alerts/email-alerts.service';
import { DetectionEvent, DetectionType, SeverityLevel } from '../detection/detection-event.entity';

/**
 * AiIncidentsService — Business logic for the AI incident lifecycle.
 *
 * Responsibilities:
 * 1. Create incidents from AI webhook payloads (with deduplication).
 * 2. Update incidents as the AI sends growth/severity updates.
 * 3. Transition incident status at the direction of BFP officers.
 * 4. Write every status transition to the audit trail.
 * 5. Provide paginated queries for the dashboard.
 * 6. Provide aggregated analytics.
 *
 * Deduplication logic:
 * - If the same camera_id has an existing ACTIVE incident (status not in
 *   terminal states), the new payload UPDATES that incident rather than
 *   creating a duplicate. This prevents the dashboard flooding with
 *   repeated alerts for the same ongoing fire.
 */
@Injectable()
export class AiIncidentsService {
  private readonly logger = new Logger(AiIncidentsService.name);

  constructor(
    @InjectRepository(AiIncident)
    private readonly incidentRepo: Repository<AiIncident>,

    @InjectRepository(AiIncidentStatusHistory)
    private readonly historyRepo: Repository<AiIncidentStatusHistory>,

    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: DetectionGateway,
    private readonly emailAlertsService: EmailAlertsService,
  ) {}

  // ── WEBHOOK: Create or update incident ──────────────────────────────────

  /**
   * Called by POST /ai/incident/create (AI service webhook).
   * Returns { incident, isNew } so the controller can emit the correct
   * Socket.IO event (ai_incident:new vs ai_incident:updated).
   */
  async createOrUpdate(
    dto: CreateAiIncidentDto,
  ): Promise<{ incident: AiIncident; isNew: boolean }> {

    let imageUrl: string | null = null;
    if (dto.frame_base64) {
      imageUrl = await this._saveFrameBase64(dto.frame_base64);
    }

    // If the AI is explicitly referencing an existing incident, update it
    if (dto.existing_incident_id && dto.existing_incident_id !== '__pending__') {
      const existing = await this.incidentRepo.findOne({
        where: { id: dto.existing_incident_id },
      });
      if (existing) {
        const updated = await this._updateIncidentFromPayload(existing, dto, imageUrl);
        return { incident: updated, isNew: false };
      }
    }

    // Deduplication: check for an active incident on the same camera
    const activeIncident = await this.incidentRepo.findOne({
      where: {
        cameraId: dto.camera_id,
        status: In(ACTIVE_STATUSES),
      },
      order: { createdAt: 'DESC' },
    });

    if (activeIncident) {
      // Update the existing active incident with new AI data
      const updated = await this._updateIncidentFromPayload(activeIncident, dto, imageUrl);
      this.logger.log(
        `[UPDATE] incident=${updated.id} camera=${dto.camera_id} ` +
        `severity=${updated.severityScore} priority=${updated.priority}`,
      );
      return { incident: updated, isNew: false };
    }

    // No active incident — create a new one
    const incident = await this._createNewIncident(dto, imageUrl);
    this.logger.warn(
      `[NEW INCIDENT] id=${incident.id} camera=${dto.camera_id} ` +
      `priority=${incident.priority} severity=${incident.severityScore}`,
    );

    // Notify Admins and BFP Personnel
    try {
      const targetUsers = await this.usersService.findAdminsAndBfp();
      const title = `🔥 AI Fire Detection Alert`;
      const detectionLabel = dto.detection_type === 'FIRE_AND_SMOKE'
        ? 'Fire & Smoke'
        : dto.detection_type === 'SMOKE' ? 'Smoke' : 'Fire';
      const message = `${detectionLabel} detected by AI on camera "${dto.camera_name || dto.camera_id}". Priority: ${incident.priority}. Please review the dashboard immediately.`;
      const link = `/admin/ai-incidents/${incident.id}`;

      for (const user of targetUsers) {
        await this.notificationsService.createNotification(
          user,
          title,
          message,
          'ai_alert',
          link,
          imageUrl,
        );
      }
      this.logger.log(`Sent ai_alert notifications to ${targetUsers.length} admin/BFP users.`);

      // Push a real-time socket event so the bell counter updates instantly
      // for all currently connected dashboard clients.
      this.gateway.broadcastNotification({ title, message, link });
    } catch (err) {
      this.logger.error(`Failed to send notifications: ${err.message}`, err.stack);
    }

    if (dto.max_confidence >= 0.70) {
      try {
        const mockEvent = new DetectionEvent();
        mockEvent.detectionType = (dto.detection_type === 'SMOKE' ? DetectionType.SMOKE : DetectionType.FIRE);
        mockEvent.confidence = dto.max_confidence;
        mockEvent.severity = incident.priority.toLowerCase() as SeverityLevel;
        mockEvent.createdAt = incident.createdAt;
        mockEvent.cameraSource = incident.cameraId;

        this.emailAlertsService.sendDetectionAlert(
          mockEvent,
          dto.camera_name || dto.camera_id,
          dto.camera_location || 'Unknown'
        ).catch(err => this.logger.error(`Email Error: ${err.message}`));
      } catch (err) {
        this.logger.error(`Failed to process email alerts: ${err.message}`, err.stack);
      }
    }

    return { incident, isNew: true };
  }

  // ── QUERIES ─────────────────────────────────────────────────────────────

  async findAll(limit = 50, offset = 0): Promise<AiIncident[]> {
    return this.incidentRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Active incidents — everything NOT in a terminal status.
   * Sorted by priority (CRITICAL first) then by creation date.
   */
  async findActive(): Promise<AiIncident[]> {
    return this.incidentRepo
      .createQueryBuilder('i')
      .where('i.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .orderBy(
        `CASE i.priority
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH'     THEN 2
          WHEN 'MODERATE' THEN 3
          ELSE 4
        END`,
      )
      .addOrderBy('i.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<AiIncident> {
    const incident = await this.incidentRepo.findOne({ where: { id } });
    if (!incident) throw new NotFoundException(`AI incident ${id} not found`);
    return incident;
  }

  async findHistory(incidentId: string): Promise<AiIncidentStatusHistory[]> {
    return this.historyRepo.find({
      where: { incidentId },
      order: { changedAt: 'ASC' },
    });
  }

  // ── STATUS TRANSITIONS ───────────────────────────────────────────────────

  /**
   * Called by PATCH /ai/incidents/:id/status
   * Transitions the incident status and writes an audit trail record.
   */
  async updateStatus(
    id: string,
    dto: UpdateIncidentStatusDto,
    performedById: number,
    performedByName: string,
  ): Promise<AiIncident> {
    const incident = await this.findById(id);
    const previousStatus = incident.status;

    // Apply the status transition
    incident.status = dto.status;
    const now = new Date();

    // Set specific timestamps
    if (dto.status === AiIncidentStatus.ACKNOWLEDGED && !incident.acknowledgedAt) {
      incident.acknowledgedById   = performedById;
      incident.acknowledgedByName = performedByName;
      incident.acknowledgedAt     = now;
    }
    if (
      [
        AiIncidentStatus.VERIFIED_FIRE,
        AiIncidentStatus.POSSIBLE_FIRE,
        AiIncidentStatus.FALSE_ALARM,
        AiIncidentStatus.SMOKE_ONLY,
      ].includes(dto.status)
    ) {
      incident.verifiedById   = performedById;
      incident.verifiedByName = performedByName;
      incident.verifiedAt     = now;
    }
    if (dto.status === AiIncidentStatus.RESOLVED) {
      incident.resolvedAt = now;
    }

    await this.incidentRepo.save(incident);

    // Write audit trail record
    await this._writeHistory({
      incidentId:      incident.id,
      performedById,
      performedByName,
      previousStatus,
      newStatus:       dto.status,
      remarks:         dto.remarks,
    });

    this.logger.log(
      `[STATUS] incident=${id} ${previousStatus} → ${dto.status} ` +
      `by user=${performedById}`,
    );

    return incident;
  }



  // ── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private async _saveFrameBase64(base64Str: string): Promise<string | null> {
    if (!base64Str) return null;
    try {
      // Remove data URI prefix if present
      const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `incident-${Date.now()}.jpg`;
      const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'detections');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);
      return `/uploads/detections/${filename}`;
    } catch (e) {
      this.logger.error(`Failed to save frame image: ${e.message}`);
      return null;
    }
  }

  private async _createNewIncident(dto: CreateAiIncidentDto, imageUrl: string | null = null): Promise<AiIncident> {
    const incident = this.incidentRepo.create({
      cameraId:            dto.camera_id,
      cameraName:          dto.camera_name,
      cameraLocation:      dto.camera_location,
      latitude:            dto.latitude,
      longitude:           dto.longitude,
      detectionType:       this._mapDetectionType(dto.detection_type),
      detectionConfidence: dto.max_confidence,

      firstDetectionTime:   new Date(dto.temporal.first_detection_time),
      lastDetectionTime:    new Date(dto.temporal.last_detection_time),
      durationSeconds:      dto.temporal.duration_seconds,
      consecutiveFrameCount: dto.temporal.consecutive_count,
      growthStatus:         this._mapGrowthStatus(dto.temporal.growth_status),
      fireAreaHistory:      dto.temporal.fire_area_history,
      smokeAreaHistory:     dto.temporal.smoke_area_history,

      severityScore:   dto.severity.score,
      severityLevel:   this._mapPriority(dto.severity.level),
      severityReasons: dto.severity.reasons,

      priority: this._mapPriority(dto.priority),
      status:   AiIncidentStatus.UNVERIFIED,
      imageUrl,
    });

    const saved = await this.incidentRepo.save(incident);

    // Write initial system audit record
    await this._writeHistory({
      incidentId:      saved.id,
      performedById:   null,
      performedByName: 'System (AI)',
      previousStatus:  null,
      newStatus:       AiIncidentStatus.UNVERIFIED,
      remarks:         `AI detected ${dto.detection_type} | confidence: ${(dto.max_confidence * 100).toFixed(0)}% | severity: ${dto.severity.score}`,
    });

    return saved;
  }

  private async _updateIncidentFromPayload(
    incident: AiIncident,
    dto: CreateAiIncidentDto,
    imageUrl: string | null = null,
  ): Promise<AiIncident> {
    // Update temporal data
    incident.lastDetectionTime    = new Date(dto.temporal.last_detection_time);
    incident.durationSeconds      = dto.temporal.duration_seconds;
    incident.consecutiveFrameCount = dto.temporal.consecutive_count;
    incident.growthStatus         = this._mapGrowthStatus(dto.temporal.growth_status);
    incident.fireAreaHistory      = dto.temporal.fire_area_history;
    incident.smokeAreaHistory     = dto.temporal.smoke_area_history;

    // Update severity (AI may refine it as fire grows)
    incident.severityScore   = dto.severity.score;
    incident.severityLevel   = this._mapPriority(dto.severity.level);
    incident.severityReasons = dto.severity.reasons;

    if (imageUrl) {
      incident.imageUrl = imageUrl;
    }

    // Escalate priority (never lower it automatically — only BFP can de-escalate)
    const newPriority = this._mapPriority(dto.priority);
    const priorityRank = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
    if (priorityRank[newPriority] > priorityRank[incident.priority]) {
      incident.priority = newPriority;
    }

    return this.incidentRepo.save(incident);
  }

  private async _writeHistory(data: {
    incidentId:      string;
    performedById:   number | null;
    performedByName: string;
    previousStatus:  AiIncidentStatus | null;
    newStatus:       AiIncidentStatus;
    remarks?:        string;
  }): Promise<void> {
    const history = this.historyRepo.create();
    history.incidentId      = data.incidentId;
    history.performedByName = data.performedByName;
    history.newStatus       = data.newStatus;
    if (data.performedById !== null) history.performedById = data.performedById;
    if (data.previousStatus !== null) history.previousStatus = data.previousStatus;
    if (data.remarks)                 history.remarks = data.remarks;
    await this.historyRepo.save(history);
  }

  private _mapDetectionType(raw: string): AiDetectionType {
    const map: Record<string, AiDetectionType> = {
      FIRE:          AiDetectionType.FIRE,
      SMOKE:         AiDetectionType.SMOKE,
      FIRE_AND_SMOKE: AiDetectionType.FIRE_AND_SMOKE,
    };
    return map[raw?.toUpperCase()] ?? AiDetectionType.FIRE;
  }

  private _mapGrowthStatus(raw: string): FireGrowthStatus {
    const map: Record<string, FireGrowthStatus> = {
      STABLE:     FireGrowthStatus.STABLE,
      INCREASING: FireGrowthStatus.INCREASING,
      DECREASING: FireGrowthStatus.DECREASING,
      SPREADING:  FireGrowthStatus.SPREADING,
      UNKNOWN:    FireGrowthStatus.UNKNOWN,
    };
    return map[raw?.toUpperCase()] ?? FireGrowthStatus.UNKNOWN;
  }

  private _mapPriority(raw: string): IncidentPriority {
    const map: Record<string, IncidentPriority> = {
      LOW:      IncidentPriority.LOW,
      MODERATE: IncidentPriority.MODERATE,
      HIGH:     IncidentPriority.HIGH,
      CRITICAL: IncidentPriority.CRITICAL,
    };
    return map[raw?.toUpperCase()] ?? IncidentPriority.LOW;
  }
}
