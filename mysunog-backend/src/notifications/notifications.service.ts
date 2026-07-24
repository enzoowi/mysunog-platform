import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { User } from '../users/user.entity';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
  ) {}

  async createNotification(
    user: User,
    title: string,
    message: string,
    type: NotificationType = 'general',
    link: string | null = null,
  ) {
    const notification = this.notificationsRepository.create({
      user,
      title,
      message,
      isRead: false,
      type,
      link,
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
    await this.notificationsRepository.delete({ user: { id: userId } });
  }

  async getAiAdvice(notificationId: number, userId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return { advice: 'AI advice service is currently unavailable. Please contact your system administrator.' };
    }

    const systemPrompt = `You are a rapid-response fire safety tactical advisor for BFP Malvar, Batangas, Philippines.

You are analyzing a stored detection alert notification. The notification message contains CCTV AI analysis data including: detection type, confidence, severity, location, fire/smoke zone counts, and frame coverage percentages. Use ALL of this data to give CUSTOMIZED advice.

CRITICAL RULES:
- Analyze the detection data in the message: fire/smoke zones, area coverage %, spread indicators, severity
- Your advice MUST differ based on the situation:
  * Small localized fire vs large spreading fire = different approach
  * Smoke-only (hidden fire) vs active flame = different priorities
  * High severity vs low severity = different urgency
  * Daytime vs nighttime = different considerations
- Use **bold** on critical information
- Be specific and actionable — NO generic fire safety tips
- Keep response under 200 words

FORMAT:

🚨 **SITUATION**: 1-2 sentences analyzing what the CCTV detected (reference actual data from the message).

⚡ **DO NOW**:
1. (action based on fire size/type)
2. (action based on location/camera)
3. (action based on severity)

⚠️ **HAZARDS**: Specific hazards based on the detection analysis.

📋 **DEPLOY**: Equipment and team size based on severity and coverage.

📞 **COORDINATE**: Who to notify based on location and severity.`;

    const userPrompt = `ALERT: ${notification.title}\nDETAILS: ${notification.message}\nTIME: ${new Date(notification.createdAt).toLocaleString()}\n\nAnalyze this detection alert and give situation-specific tactical advice.`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const advice = response.data?.choices?.[0]?.message?.content || 'Unable to generate advice at this time.';
      return { advice };
    } catch (error) {
      console.error('GROQ AI advice error:', error?.response?.data || error.message);
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
  }) {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      return { advice: 'AI advice service is currently unavailable. Please contact your system administrator.' };
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

    let cctvReport = `CCTV AI ANALYSIS REPORT:\n`;
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

    const systemPrompt = `You are a rapid-response fire safety tactical advisor for BFP Malvar, Batangas, Philippines.

You are receiving a REAL-TIME CCTV AI analysis report. The AI system has scanned the camera feed and detected fire/smoke. Your job is to analyze the SPECIFIC detection data below and give CUSTOMIZED tactical advice.

CRITICAL RULES:
- Analyze the CCTV data carefully: number of fire/smoke zones, area coverage, spread indicators, severity
- Your advice MUST differ based on the situation:
  * Small localized fire vs large spreading fire = different approach
  * Smoke-only (hidden fire) vs active flame = different priorities  
  * Single zone vs multiple zones = different deployment
  * Daytime vs nighttime = different considerations
  * High severity vs low severity = different urgency
- Use **bold** on critical information
- Be specific and actionable — NO generic fire safety tips
- Keep response under 200 words

FORMAT:

🚨 **SITUATION**: 1-2 sentences analyzing what the CCTV shows (use the actual data: zones, coverage %, spread indicators).

⚡ **DO NOW**:
1. (action based on fire size/type)
2. (action based on location/camera)
3. (action based on severity)

⚠️ **HAZARDS**: Specific hazards based on what the CCTV analysis reveals (smoke density, fire spread, etc.)

📋 **DEPLOY**: Equipment and team size based on the detected severity and coverage area.

📞 **COORDINATE**: Who to notify based on location and severity.`;

    const userPrompt = `${cctvReport}\nALERT TITLE: ${data.title}\nALERT MESSAGE: ${data.message}\n\nAnalyze this CCTV detection and give situation-specific tactical advice.`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const advice = response.data?.choices?.[0]?.message?.content || 'Unable to generate advice at this time.';
      return { advice };
    } catch (error) {
      console.error('GROQ AI advice error:', error?.response?.data || error.message);
      return { advice: 'AI advice service is temporarily unavailable. Please try again in a moment.' };
    }
  }
}
