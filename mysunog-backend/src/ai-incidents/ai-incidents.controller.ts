import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiIncidentsService } from './ai-incidents.service';
import { DetectionGateway } from '../detection/detection.gateway';
import { CreateAiIncidentDto } from './dto/create-ai-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';

/**
 * AiIncidentsController — REST endpoints for the AI incident system.
 *
 * Endpoint groups:
 * 1. AI Service Webhook  (no JWT, secured by X-API-Key header)
 * 2. Dashboard Queries   (JWT required, all authenticated roles)
 * 3. Status Transitions  (JWT required, BFP_STAFF or ADMIN only)
 * 4. Analytics           (JWT required, ADMIN only)
 */
@Controller('ai/incidents')
export class AiIncidentsController {
  private readonly logger = new Logger(AiIncidentsController.name);
  private readonly serviceApiKey =
    process.env.SERVICE_API_KEY || 'mysunog-ai-secret-key-2024';

  constructor(
    private readonly service: AiIncidentsService,
    private readonly gateway: DetectionGateway,
  ) {}

  // ─── 1. AI Service Webhook ──────────────────────────────────────────────

  /**
   * POST /ai/incidents/create
   * Called exclusively by the Python AI service (machine-to-machine).
   * Authenticated via X-API-Key header (not JWT).
   *
   * On success, broadcasts a Socket.IO event to all connected dashboard clients.
   */
  @Post('create')
  async createFromWebhook(
    @Body() dto: CreateAiIncidentDto,
    @Headers('x-api-key') apiKey: string,
  ) {
    if (apiKey !== this.serviceApiKey) {
      throw new UnauthorizedException('Invalid service API key');
    }

    const { incident, isNew } = await this.service.createOrUpdate(dto);

    // Broadcast to all connected React dashboard clients
    if (isNew) {
      this.gateway.broadcastAiIncidentNew(incident);
      this.logger.warn(
        `🔥 NEW AI INCIDENT — ${incident.id} | ${incident.priority} | camera: ${incident.cameraId}`,
      );
    } else {
      this.gateway.broadcastAiIncidentUpdated(incident);
    }

    return {
      success:     true,
      incident_id: incident.id,
      is_new:      isNew,
      message:     isNew ? 'New incident created' : 'Existing incident updated',
    };
  }

  // ─── 2. Dashboard Queries ───────────────────────────────────────────────

  /** GET /ai/incidents — paginated list of all incidents */
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.service.findAll(Number(limit), Number(offset));
  }

  /** GET /ai/incidents/active — active incidents sorted by priority */
  @UseGuards(AuthGuard('jwt'))
  @Get('active')
  async findActive() {
    return this.service.findActive();
  }

  /** GET /ai/incidents/:id — single incident details */
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  /** GET /ai/incidents/:id/history — full status audit trail */
  @UseGuards(AuthGuard('jwt'))
  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    return this.service.findHistory(id);
  }

  // ─── 3. Status Transitions ──────────────────────────────────────────────

  /**
   * PATCH /ai/incidents/:id/status
   * BFP officers use this to acknowledge, verify, or resolve incidents.
   * The requesting user's ID and name are extracted from the JWT payload.
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BFP_STAFF, UserRole.FIRE_INVESTIGATOR)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @Req() req: any,
  ) {
    const user = req.user;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    const updated = await this.service.updateStatus(
      id,
      dto,
      user.userId,
      fullName,
    );

    // Broadcast the update to all dashboard clients
    this.gateway.broadcastAiIncidentUpdated(updated);

    return updated;
  }

  /**
   * PATCH /ai/incidents/:id/acknowledge
   * Convenience shortcut — equivalent to PATCH /status with { status: ACKNOWLEDGED }
   */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BFP_STAFF, UserRole.FIRE_INVESTIGATOR)
  @Patch(':id/acknowledge')
  async acknowledge(@Param('id') id: string, @Req() req: any) {
    return this.updateStatus(
      id,
      { status: 'ACKNOWLEDGED' as any },
      req,
    );
  }
}
