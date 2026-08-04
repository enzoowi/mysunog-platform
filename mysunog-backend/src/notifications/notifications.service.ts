import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { User } from '../users/user.entity';
import { Camera } from '../detection/camera.entity';
import { AiIncident } from '../ai-incidents/ai-incident.entity';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(Camera)
    private cameraRepository: Repository<Camera>,
    @InjectRepository(AiIncident)
    private aiIncidentRepository: Repository<AiIncident>,
  ) {}

  async createNotification(
    user: User,
    title: string,
    message: string,
    type: NotificationType = 'general',
    link: string | null = null,
    imageUrl: string | null = null,
  ) {
    const notification = this.notificationsRepository.create({
      user,
      title,
      message,
      isRead: false,
      type,
      link,
      imageUrl,
    });

    return this.notificationsRepository.save(notification);
  }

  async getMyNotifications(userId: number) {
    return this.notificationsRepository.find({
      where: {
        user: { id: userId },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id: notificationId,
        user: { id: userId },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    return this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: number) {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
        isRead: false,
      },
    });

    for (const notification of notifications) {
      notification.isRead = true;
    }

    return this.notificationsRepository.save(notifications);
  }

  async getUnreadCount(userId: number) {
    return this.notificationsRepository.count({
      where: {
        user: { id: userId },
        isRead: false,
      },
    });
  }

  async clearAll(userId: number) {
    const notifications = await this.notificationsRepository.find({
      where: { user: { id: userId } },
    });
    if (notifications.length > 0) {
      await this.notificationsRepository.remove(notifications);
    }
  }

  async getAiAdvice(notificationId: number, userId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

    if (!apiKey) {
      return { advice: 'AI advice service is currently unavailable. Please contact your system administrator (Missing GEMINI_API_KEY).' };
    }

    // ── Enrich with AI Incident data if available ──
    let incidentContext = '';
    try {
      const cameraMatch = notification.message.match(/\(([^)]+)\)/);
      if (cameraMatch) {
        const cameraName = cameraMatch[1];
        const camera = await this.cameraRepository.findOne({ where: { name: cameraName } });
        if (camera) {
          const recentIncident = await this.aiIncidentRepository.findOne({
            where: { cameraId: camera.id.toString() },
            order: { createdAt: 'DESC' },
          });
          if (recentIncident) {
            incidentContext = this._buildIncidentContext(recentIncident);
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Could not enrich AI advice with incident data: ${e.message}`);
    }

    const systemPrompt = this._buildVisualAnalysisSystemPrompt();

    const now = new Date();
    const hour = now.getHours();
    const timeContext = hour >= 6 && hour < 18 ? 'DAYTIME operation' : 'NIGHTTIME operation — limited visibility, residents likely sleeping';

    const userPromptText = `ALERT: ${notification.title}
DETAILS: ${notification.message}
TIME: ${new Date(notification.createdAt).toLocaleString()}
TIME CONTEXT: ${timeContext}
${incidentContext}

A CCTV frame image is attached (if available). Perform your two-phase visual analysis on this image and the data above, then give situation-specific tactical advice for the responding fire team.`;

    const userParts: any[] = [{ text: userPromptText }];

    // Always try to include the captured frame for visual analysis
    if (notification.imageUrl) {
      const imgData = this._loadImageAsBase64(notification.imageUrl);
      if (imgData) {
        userParts.push({
          inlineData: {
            mimeType: imgData.mimeType,
            data: imgData.data,
          }
        });
      }
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: userParts,
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const advice = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate advice at this time.';

      // Try to extract the camera name from the notification message and look up its GPS coordinates
      let latitude: number | null = null;
      let longitude: number | null = null;
      const cameraMatch = notification.message.match(/\(([^)]+)\)/);
      if (cameraMatch) {
        const cameraName = cameraMatch[1];
        const camera = await this.cameraRepository.findOne({ where: { name: cameraName } });
        if (camera?.latitude && camera?.longitude) {
          latitude = Number(camera.latitude);
          longitude = Number(camera.longitude);
        }
      }

      return { advice, latitude, longitude, imageUrl: notification.imageUrl };
    } catch (error) {
      this.logger.error('Gemini AI advice error:', error?.response?.data || error.message);
      return { advice: 'AI advice service is temporarily unavailable. Please try again in a moment.' };
    }
  }

  async getAiAdviceFromAlert(data: {
    title: string;
    message: string;
    detectionType?: string;
    confidence?: number;
    severity?: string;
    cameraSource?: string;
    latitude?: number;
    longitude?: number;
    rawDetections?: any[];
    imageUrl?: string;
  }) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

    if (!apiKey) {
      return { advice: 'AI advice service is currently unavailable. Please contact your system administrator (Missing GEMINI_API_KEY).' };
    }

    // ── Build CCTV situational analysis from raw detection data ──
    const raws = data.rawDetections || [];
    const fireZones = raws.filter((d: any) => d.detection_type === 'fire');
    const smokeZones = raws.filter((d: any) => d.detection_type === 'smoke');
    const totalFireArea = fireZones.reduce((s: number, d: any) => s + (d.area_percentage || 0), 0);
    const totalSmokeArea = smokeZones.reduce((s: number, d: any) => s + (d.area_percentage || 0), 0);
    const maxFireConf = fireZones.length > 0 ? Math.max(...fireZones.map((d: any) => d.confidence || 0)) : 0;
    const maxSmokeConf = smokeZones.length > 0 ? Math.max(...smokeZones.map((d: any) => d.confidence || 0)) : 0;
    const confPct = Math.round((data.confidence || 0) * 100);

    let cctvReport = `CCTV AI DETECTION DATA:\n`;
    cctvReport += `- Detection type: ${(data.detectionType || 'unknown').toUpperCase()}\n`;
    cctvReport += `- Overall confidence: ${confPct}%\n`;
    cctvReport += `- Severity level: ${(data.severity || 'unknown').toUpperCase()}\n`;
    cctvReport += `- Camera: ${data.cameraSource || 'Unknown'}\n`;
    if (data.latitude && data.longitude) cctvReport += `- GPS coordinates: ${data.latitude}, ${data.longitude}\n`;
    cctvReport += `- Fire zones detected: ${fireZones.length} (covering ${totalFireArea.toFixed(1)}% of camera frame)\n`;
    cctvReport += `- Smoke zones detected: ${smokeZones.length} (covering ${totalSmokeArea.toFixed(1)}% of camera frame)\n`;
    if (fireZones.length > 0) cctvReport += `- Highest fire confidence: ${(maxFireConf * 100).toFixed(0)}%\n`;
    if (smokeZones.length > 0) cctvReport += `- Highest smoke confidence: ${(maxSmokeConf * 100).toFixed(0)}%\n`;

    // Situation flags
    if (fireZones.length > 2) cctvReport += `- ⚠️ MULTIPLE fire sources detected — fire may be spreading\n`;
    if (totalFireArea > 15) cctvReport += `- ⚠️ Fire covers LARGE portion of frame — active blaze likely\n`;
    if (totalFireArea > 0 && totalFireArea <= 5) cctvReport += `- Fire is SMALL/localized — may still be containable\n`;
    if (smokeZones.length > 0 && fireZones.length === 0) cctvReport += `- ⚠️ SMOKE ONLY — no visible flame. Fire source is hidden, developing, or smoldering\n`;
    if (totalSmokeArea > 20) cctvReport += `- ⚠️ Heavy smoke — expect LOW VISIBILITY conditions\n`;
    if (data.severity === 'critical') cctvReport += `- 🔴 CRITICAL severity — immediate full response required\n`;

    const now = new Date();
    const hour = now.getHours();
    const timeContext = hour >= 6 && hour < 18 ? 'DAYTIME operation' : 'NIGHTTIME operation — limited visibility, residents likely sleeping';
    cctvReport += `- Time context: ${timeContext}\n`;

    // ── Enrich with AI Incident data if available ──
    let incidentContext = '';
    try {
      if (data.cameraSource) {
        // Try to find matching camera by name
        const camera = await this.cameraRepository.findOne({ where: { name: data.cameraSource } });
        const cameraId = camera ? camera.id.toString() : data.cameraSource;
        const recentIncident = await this.aiIncidentRepository.findOne({
          where: { cameraId },
          order: { createdAt: 'DESC' },
        });
        if (recentIncident) {
          incidentContext = this._buildIncidentContext(recentIncident);
        }
      }
    } catch (e) {
      this.logger.warn(`Could not enrich AI advice with incident data: ${e.message}`);
    }

    const systemPrompt = this._buildVisualAnalysisSystemPrompt();

    const userPromptText = `${cctvReport}${incidentContext}\nALERT TITLE: ${data.title}\nALERT MESSAGE: ${data.message}\n\nA CCTV frame image is attached (if available). Perform your two-phase visual analysis on the image and the detection data above, then give situation-specific tactical advice for the responding fire team.`;

    const userParts: any[] = [{ text: userPromptText }];

    // Always try to include the captured frame for visual analysis
    if (data.imageUrl) {
      const imgData = this._loadImageAsBase64(data.imageUrl);
      if (imgData) {
        userParts.push({
          inlineData: {
            mimeType: imgData.mimeType,
            data: imgData.data,
          }
        });
      }
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: userParts,
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const advice = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate advice at this time.';
      return { advice };
    } catch (error) {
      this.logger.error('Gemini AI advice error:', error?.response?.data || error.message);
      return { advice: 'AI advice service is temporarily unavailable. Please try again in a moment.' };
    }
  }

  // ── PRIVATE HELPERS: AI Advice ─────────────────────────────────────────────

  /**
   * Two-phase visual analysis system prompt.
   * Phase 1 forces the model to describe what it sees in the CCTV frame.
   * Phase 2 generates tactical advice grounded in those observations.
   */
  private _buildVisualAnalysisSystemPrompt(): string {
    return `You are an expert fire scene analyst and tactical advisor for the Bureau of Fire Protection (BFP) Malvar, Batangas, Philippines. You are assisting firefighters responding to a fire/smoke detection from a CCTV camera.

You will receive TWO types of input:
1. A CCTV frame image captured at the moment of detection (if available)
2. AI detection data (fire/smoke zones, confidence scores, area coverage, severity, growth trends)

You MUST perform a TWO-PHASE analysis. You must output your final response EXACTLY matching the Phase 2 sections below. DO NOT skip any sections.

═══ PHASE 1: VISUAL ASSESSMENT ═══
(Internal thought process - do not output this phase directly, but use it to inform Phase 2)
Carefully examine the CCTV image and identify materials burning, flame/smoke characteristics, environment, and signs of spread.

═══ PHASE 2: TACTICAL ADVICE ═══
You MUST provide ALL of the following sections in your response:

🔍 **VISUAL ASSESSMENT**: 2-3 sentences describing exactly what you see in the CCTV image — flame location, smoke behavior, structure type, and environment. Reference specific visual details.

🚨 **SITUATION SEVERITY**: Classify as INCIPIENT / GROWING / FULLY DEVELOPED / DECAY based on visual cues and AI growth data. Explain why.

⚡ **IMMEDIATE ACTIONS**:
1. (specific action based on what you see)
2. (action based on fire behavior)
3. (action based on environment)

⚠️ **HAZARDS**: Specific hazards you can identify from the image.

📋 **DEPLOYMENT RECOMMENDATION**: Team size and specific equipment.

🔄 **FIRE BEHAVIOR PREDICTION**: Predict how this fire will develop in the next 5-10 minutes.

📞 **COORDINATION**: Specific agencies to alert.

CRITICAL RULES:
- You MUST output ALL the sections listed above (Visual Assessment, Severity, Actions, Hazards, Deployment, Prediction, Coordination).
- Your advice MUST be grounded in what you SEE in the image — do NOT give generic advice.
- Keep total response under 350 words.
- Use **bold** for critical information.
- Do NOT use angle brackets (< or >) in your text.`;
  }

  /**
   * Build enrichment context from an AI incident record (growth trends, area history, severity reasons).
   */
  private _buildIncidentContext(incident: AiIncident): string {
    let ctx = `\nAI INCIDENT ENRICHMENT DATA:\n`;
    ctx += `- Incident ID: ${incident.id}\n`;
    ctx += `- Detection type: ${incident.detectionType}\n`;
    ctx += `- Detection confidence: ${(Number(incident.detectionConfidence) * 100).toFixed(0)}%\n`;
    ctx += `- Duration: ${Number(incident.durationSeconds).toFixed(0)} seconds of continuous detection\n`;
    ctx += `- Consecutive frames: ${incident.consecutiveFrameCount}\n`;
    ctx += `- Fire growth status: ${incident.growthStatus}\n`;
    ctx += `- Severity score: ${incident.severityScore}/100\n`;
    ctx += `- Priority: ${incident.priority}\n`;

    if (incident.fireAreaHistory && incident.fireAreaHistory.length > 0) {
      const history = incident.fireAreaHistory;
      const latest = history[history.length - 1];
      const earliest = history[0];
      const trend = latest > earliest ? 'INCREASING' : latest < earliest ? 'DECREASING' : 'STABLE';
      ctx += `- Fire area trend: ${trend} (${earliest.toFixed(1)}% → ${latest.toFixed(1)}% over ${history.length} samples)\n`;
    }

    if (incident.smokeAreaHistory && incident.smokeAreaHistory.length > 0) {
      const history = incident.smokeAreaHistory;
      const latest = history[history.length - 1];
      const earliest = history[0];
      const trend = latest > earliest ? 'INCREASING' : latest < earliest ? 'DECREASING' : 'STABLE';
      ctx += `- Smoke area trend: ${trend} (${earliest.toFixed(1)}% → ${latest.toFixed(1)}% over ${history.length} samples)\n`;
    }

    if (incident.severityReasons && incident.severityReasons.length > 0) {
      ctx += `- Severity reasons: ${incident.severityReasons.join('; ')}\n`;
    }

    return ctx;
  }

  /**
   * Load an image from the uploads directory and return as an object with mimeType and raw base64 data for Gemini API.
   */
  private _loadImageAsBase64(imageUrl: string): { mimeType: string, data: string } | null {
    try {
      const fs = require('fs');
      const path = require('path');
      const imgPath = path.join(__dirname, '..', '..', imageUrl);
      if (fs.existsSync(imgPath)) {
        const imgBase64 = fs.readFileSync(imgPath).toString('base64');
        const mime = imgPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return { mimeType: mime, data: imgBase64 };
      }
    } catch (e) {
      this.logger.warn(`Failed to load image for AI advice: ${e.message}`);
    }
    return null;
  }

  /**
   * Emergency Route Optimization — calls OpenRouteService to get the fastest
   * driving route from the BFP Malvar Fire Station to the incident location.
   */
  async getEmergencyRoute(incidentLat: number, incidentLng: number) {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return { error: 'Route service not configured. Missing ORS_API_KEY.' };
    }

    // BFP Malvar Fire Station coordinates (fallback from env)
    const stationLat = parseFloat(process.env.BFP_STATION_LAT || '14.043095');
    const stationLng = parseFloat(process.env.BFP_STATION_LNG || '121.156819');

    try {
      const response = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          coordinates: [
            [stationLng, stationLat],   // Origin: BFP Station (lon, lat)
            [incidentLng, incidentLat], // Destination: Incident (lon, lat)
          ],
          instructions: true,
          language: 'en',
        },
        {
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const feature = response.data?.features?.[0];
      if (!feature) {
        return { error: 'No route found between the station and incident location.' };
      }

      const props = feature.properties?.summary || {};
      const segments = feature.properties?.segments || [];

      // Extract turn-by-turn steps
      const steps: { instruction: string; distance: number; duration: number }[] = [];
      for (const segment of segments) {
        for (const step of segment.steps || []) {
          steps.push({
            instruction: step.instruction || '',
            distance: Math.round(step.distance || 0),
            duration: Math.round(step.duration || 0),
          });
        }
      }

      return {
        origin: { lat: stationLat, lng: stationLng, label: 'BFP Malvar Fire Station' },
        destination: { lat: incidentLat, lng: incidentLng, label: 'Incident Location' },
        geometry: feature.geometry, // GeoJSON LineString
        distance: Math.round(props.distance || 0), // meters
        duration: Math.round(props.duration || 0), // seconds
        steps,
      };
    } catch (error) {
      console.warn('OpenRouteService failed, falling back to OSRM:', error?.response?.data || error.message);
      
      try {
        // Fallback to OSRM Public API
        const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${stationLng},${stationLat};${incidentLng},${incidentLat}?geometries=geojson&overview=full&steps=true`;
        const osrmResponse = await axios.get(osrmUrl, { timeout: 10000 });
        
        const route = osrmResponse.data?.routes?.[0];
        if (!route) {
          return { error: 'No route found between the station and incident location.' };
        }

        const steps: { instruction: string; distance: number; duration: number }[] = [];
        const legs = route.legs || [];
        for (const leg of legs) {
          for (const step of leg.steps || []) {
            let instruction = '';
            if (step.maneuver) {
              const type = step.maneuver.type || '';
              const modifier = step.maneuver.modifier || '';
              instruction = `${type.charAt(0).toUpperCase() + type.slice(1)} ${modifier}`.trim();
              if (step.name) instruction += ` onto ${step.name}`;
            }
            steps.push({
              instruction: instruction || 'Continue along route',
              distance: Math.round(step.distance || 0),
              duration: Math.round(step.duration || 0),
            });
          }
        }

        return {
          origin: { lat: stationLat, lng: stationLng, label: 'BFP Malvar Fire Station' },
          destination: { lat: incidentLat, lng: incidentLng, label: 'Incident Location' },
          geometry: route.geometry,
          distance: Math.round(route.distance || 0),
          duration: Math.round(route.duration || 0),
          steps,
        };
      } catch (osrmError) {
        console.error('OSRM fallback error:', osrmError.message);
        return { error: 'Failed to calculate emergency route. The routing services are temporarily unavailable.' };
      }
    }
  }
}
