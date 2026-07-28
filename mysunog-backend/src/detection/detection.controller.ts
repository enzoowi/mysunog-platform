import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { DetectionService } from './detection.service';
import { DetectionGateway } from './detection.gateway';
import { AnalyzeFrameDto } from './dto/analyze-frame.dto';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { UploadService } from '../upload/upload.service';
@Controller('detection')
export class DetectionController {
  constructor(
    private readonly detectionService: DetectionService,
    private readonly detectionGateway: DetectionGateway,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * POST /detection/analyze-frame
   * Receives a base64 frame from the frontend, forwards to Python AI service.
   * If fire/smoke is detected, saves event and broadcasts via WebSocket.
   */
  @Post('analyze-frame')
  @UseGuards(AuthGuard('jwt'))
  async analyzeFrame(@Body() dto: AnalyzeFrameDto) {
    const result = await this.detectionService.analyzeFrame(
      dto.imageBase64,
      dto.cameraId,
      dto.latitude,
      dto.longitude,
    );

    // Broadcast via WebSocket if fire/smoke was detected
    if (result.detected && result.event) {
      this.detectionGateway.broadcastFireAlert(result.event);
    }

    return result;
  }

  /**
   * POST /detection/upload-video
   * Receives a video file, forwards to Python AI for analysis.
   */
  @Post('upload-video')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(mp4|avi|mov|webm|mkv)$/i;
        if (allowed.test(extname(file.originalname))) {
          cb(null, true);
        } else {
          cb(new Error('Only video files are allowed'), false);
        }
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    const videoUrl = await this.uploadService.uploadFile(file, 'videos');
    // We now send the Cloudinary URL to analyzeVideo instead of local file.path
    // Note: The Python backend will need to download or stream this URL.
    const result = await this.detectionService.analyzeVideo(videoUrl);

    // Broadcast each detection via WebSocket
    if (result.success && result.events && result.events.length > 0) {
      for (const event of result.events) {
        this.detectionGateway.broadcastFireAlert(event);
      }
    }

    return result;
  }

  /**
   * GET /detection/events
   * List all detection events with optional pagination.
   */
  @Get('events')
  @UseGuards(AuthGuard('jwt'))
  async findAllEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.detectionService.findAllEvents(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  /**
   * GET /detection/events/:id
   * Get a single detection event by ID.
   */
  @Get('events/:id')
  @UseGuards(AuthGuard('jwt'))
  async findEventById(@Param('id') id: string) {
    return this.detectionService.findEventById(+id);
  }

  /**
   * DELETE /detection/events/:id
   * Delete a single detection event by ID.
   */
  @Delete('events/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteEvent(@Param('id') id: string) {
    return this.detectionService.deleteEvent(+id);
  }

  /**
   * GET /detection/stats
   * Get detection statistics for the dashboard.
   */
  @Get('stats')
  @UseGuards(AuthGuard('jwt'))
  async getStats() {
    return this.detectionService.getDetectionStats();
  }

  /**
   * GET /detection/health
   * Check the AI service health status.
   */
  @Get('health')
  async checkHealth() {
    return this.detectionService.checkAiServiceHealth();
  }

  // ─── CAMERA MANAGEMENT ────────────────────────────────────────

  /**
   * POST /detection/cameras
   * Register a new camera source.
   */
  @Post('cameras')
  @UseGuards(AuthGuard('jwt'))
  async createCamera(@Body() dto: CreateCameraDto) {
    return this.detectionService.createCamera(dto);
  }

  @Patch('cameras/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateCamera(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.detectionService.updateCamera(+id, dto);
  }

  /**
   * GET /detection/cameras
   * List all registered cameras.
   */
  @Get('cameras')
  @UseGuards(AuthGuard('jwt'))
  async findAllCameras() {
    return this.detectionService.findAllCameras();
  }

  @Delete('cameras/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteCamera(@Param('id') id: string) {
    return this.detectionService.deleteCamera(+id);
  }

  // ─── EXTERNAL CAMERA STREAM ───────────────────────────────────

  /**
   * GET /detection/stream/status
   * Get the status of all active camera streams from the AI service.
   */
  @Get('stream/status')
  @UseGuards(AuthGuard('jwt'))
  async getStreamStatus() {
    return this.detectionService.getStreamStatus();
  }

  // ─── LIGHTWEIGHT REAL-TIME ALERT ──────────────────────────────

  /**
   * POST /detection/broadcast-alert
   * Called by the Python AI service when fire/smoke is confirmed on a camera.
   * Broadcasts a Socket.IO event immediately — no DB write, no incident creation.
   * This ensures the frontend gets a real-time popup even if the full incident
   * webhook pipeline is slow or fails.
   *
   * Secured via X-API-Key (same as the AI webhook).
   */
  @Post('broadcast-alert')
  async broadcastAlert(
    @Body()
    body: {
      cameraId: string;
      cameraName?: string;
      detectionType: string;
      confidence: number;
      severity?: string;
      latitude?: number;
      longitude?: number;
    },
    @Query('api_key') apiKeyQuery?: string,
  ) {
    const serviceApiKey =
      process.env.SERVICE_API_KEY || 'mysunog-ai-secret-key-2024';

    // Accept API key from query param (simpler for sync HTTP from Python threads)
    if (apiKeyQuery !== serviceApiKey) {
      return { success: false, message: 'Invalid API key' };
    }

    // Broadcast a fire alert event to all connected clients
    this.detectionGateway.server.emit('detection:fire-alert', {
      id: Date.now(),
      detectionType: body.detectionType || 'fire',
      confidence: body.confidence || 0,
      severity: body.severity || 'high',
      cameraSource: body.cameraName || body.cameraId || 'External Camera',
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      createdAt: new Date().toISOString(),
    });

    // Fire-and-forget throttled email alert (no await to avoid blocking)
    this.detectionService.triggerBroadcastEmail(body).catch(err => {
      console.error(`Error triggering broadcast email: ${err.message}`);
    });

    return { success: true };
  }
}
