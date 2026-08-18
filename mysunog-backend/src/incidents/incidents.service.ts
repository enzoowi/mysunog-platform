import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import axios from 'axios';
import { FireIncident } from './fire-incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(FireIncident)
    private incidentsRepository: Repository<FireIncident>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateIncidentDto) {
    const incident = this.incidentsRepository.create(dto);
    const savedIncident = await this.incidentsRepository.save(incident);

    // Notify BFP personnel and Admins
    try {
      const personnel = await this.usersService.findAdminsAndBfp();
      for (const p of personnel) {
        await this.notificationsService.createNotification(
          p,
          'New Incident Report',
          `A new fire incident in ${dto.barangay} was reported.`,
          'alert',
          '/reports'
        );
      }
    } catch (error) {
      console.error('Error sending incident notifications:', error);
    }

    return savedIncident;
  }

  async findAll(barangay?: string) {
    if (barangay && barangay !== 'All') {
      return this.incidentsRepository.find({
        where: { barangay },
        order: { createdAt: 'DESC' },
      });
    }

    return this.incidentsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async search(filters: {
    barangay?: string;
    cause?: string;
    propertyType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = this.incidentsRepository.createQueryBuilder('incident');

    if (filters.barangay && filters.barangay !== 'All') {
      query.andWhere('incident.barangay = :barangay', {
        barangay: filters.barangay,
      });
    }
    if (filters.cause) {
      query.andWhere('incident.cause ILIKE :cause', {
        cause: `%${filters.cause}%`,
      });
    }
    if (filters.propertyType) {
      query.andWhere('incident.propertyType ILIKE :propertyType', {
        propertyType: `%${filters.propertyType}%`,
      });
    }
    if (filters.startDate) {
      query.andWhere('incident.incidentDate >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      query.andWhere('incident.incidentDate <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('incident.incidentDate', 'DESC');
    return query.getMany();
  }

  async getDashboardSummary(period?: string) {
    let allIncidents = await this.incidentsRepository.find();

    // Filter by period if provided
    if (period && period !== 'all') {
      const now = new Date();
      let cutoff: Date;

      if (period === 'weekly') {
        cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 7);
      } else if (period === 'monthly') {
        cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 30);
      } else if (period === 'annually') {
        cutoff = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
      }

      if (cutoff!) {
        allIncidents = allIncidents.filter((incident) => {
          if (!incident.incidentDate) return false;
          const incidentDate = new Date(incident.incidentDate);
          return incidentDate >= cutoff;
        });
      }
    }

    const incidents = allIncidents;

    const totalIncidents = incidents.length;

    const totalEstimatedDamage = incidents.reduce(
      (sum, item) => sum + Number(item.estimatedDamage || 0),
      0,
    );

    const totalCasualties = incidents.reduce(
      (sum, item) => sum + Number(item.casualties || 0),
      0,
    );

    const totalInjuries = incidents.reduce(
      (sum, item) => sum + Number(item.injuries || 0),
      0,
    );

    const avgDamagePerIncident =
      totalIncidents > 0
        ? Math.round(totalEstimatedDamage / totalIncidents)
        : 0;

    const barangayCounts: Record<string, number> = {};
    const causeCounts: Record<string, number> = {};
    const propertyCounts: Record<string, number> = {};
    const monthlyCounts: Record<string, number> = {};
    const dayOfWeekCounts: Record<string, number> = {
      Sun: 0,
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
    };
    const timeOfDayCounts: Record<string, number> = {
      'Morning (6AM-12PM)': 0,
      'Afternoon (12PM-6PM)': 0,
      'Evening (6PM-12AM)': 0,
      'Night (12AM-6AM)': 0,
    };
    const damageSeverity: Record<string, number> = {
      'Minor (<₱10k)': 0,
      'Moderate (₱10k-₱100k)': 0,
      'Major (₱100k-₱500k)': 0,
      'Catastrophic (≥₱500k)': 0,
    };

    const currentYear = new Date().getFullYear();
    let thisYearCount = 0;
    let lastYearCount = 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    incidents.forEach((incident) => {
      barangayCounts[incident.barangay] =
        (barangayCounts[incident.barangay] || 0) + 1;

      if (incident.cause) {
        causeCounts[incident.cause] = (causeCounts[incident.cause] || 0) + 1;
      }

      if (incident.propertyType) {
        propertyCounts[incident.propertyType] =
          (propertyCounts[incident.propertyType] || 0) + 1;
      }

      // Monthly trend: group by YYYY-MM
      if (incident.incidentDate) {
        const month = incident.incidentDate.substring(0, 7);
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;

        // Day of week
        const date = new Date(incident.incidentDate);
        if (!isNaN(date.getTime())) {
          const dayName = dayNames[date.getDay()];
          dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + 1;
        }

        // Year-over-year
        const year = parseInt(incident.incidentDate.substring(0, 4));
        if (year === currentYear) thisYearCount++;
        if (year === currentYear - 1) lastYearCount++;
      }

      // Time of day
      if (incident.incidentTime) {
        const hour = parseInt(incident.incidentTime.split(':')[0]);
        if (hour >= 6 && hour < 12) timeOfDayCounts['Morning (6AM-12PM)']++;
        else if (hour >= 12 && hour < 18)
          timeOfDayCounts['Afternoon (12PM-6PM)']++;
        else if (hour >= 18) timeOfDayCounts['Evening (6PM-12AM)']++;
        else timeOfDayCounts['Night (12AM-6AM)']++;
      }

      // Damage severity
      const dmg = Number(incident.estimatedDamage || 0);
      if (dmg < 10000) damageSeverity['Minor (<₱10k)']++;
      else if (dmg < 100000) damageSeverity['Moderate (₱10k-₱100k)']++;
      else if (dmg < 500000) damageSeverity['Major (₱100k-₱500k)']++;
      else damageSeverity['Catastrophic (≥₱500k)']++;
    });

    return {
      totalIncidents,
      totalEstimatedDamage,
      totalCasualties,
      totalInjuries,
      avgDamagePerIncident,
      barangayCounts,
      causeCounts,
      propertyCounts,
      monthlyCounts,
      dayOfWeekCounts,
      timeOfDayCounts,
      damageSeverity,
      thisYearCount,
      lastYearCount,
    };
  }

  async getResponsePerformance() {
    const incidents = await this.incidentsRepository.find({
      order: { incidentDate: 'DESC' },
    });

    const withResponseData = incidents.filter(
      (i) => i.alarmTime && i.responseTime,
    );

    const responseTimesMinutes = withResponseData
      .map((i) => {
        const alarm = this.timeToMinutes(i.alarmTime!);
        const response = this.timeToMinutes(i.responseTime!);
        return response - alarm;
      })
      .filter((m) => m >= 0);

    const avgResponseTime =
      responseTimesMinutes.length > 0
        ? responseTimesMinutes.reduce((a, b) => a + b, 0) /
          responseTimesMinutes.length
        : 0;

    const recentIncidents = withResponseData.slice(0, 20).map((i) => ({
      id: i.id,
      barangay: i.barangay,
      date: i.incidentDate,
      alarmTime: i.alarmTime,
      responseTime: i.responseTime,
      controlTime: i.controlTime,
      fireOutTime: i.fireOutTime,
    }));

    return {
      totalWithResponseData: withResponseData.length,
      avgResponseTimeMinutes: Math.round(avgResponseTime * 10) / 10,
      recentIncidents,
    };
  }

  async generateDashboardInsights(summaryData: any) {
    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';

    if (!apiKey) {
      throw new InternalServerErrorException('Missing GROQ_API_KEY in .env');
    }

    const systemPrompt = `You are an expert fire safety data analyst and operational advisor for the Bureau of Fire Protection (BFP) Malvar, Batangas, Philippines.

Your task is to analyze fire incident statistics and produce a comprehensive, actionable analysis report for BFP commanders and firemen to improve their service.

Structure your response with the following sections (use the exact headers below):
**📊 Overview & Trend**
Summarize total incidents, year-over-year comparison (is it improving or worsening?), and overall damage impact in 2 sentences.

**⏰ Peak Danger Period**
Identify the most dangerous time of day and day of week. Give a staffing/readiness recommendation.

**📍 Highest Risk Areas**
Name the top 2 barangays with most incidents. Recommend targeted patrol, hydrant checks, or community action.

**🔥 Leading Fire Causes**
Identify the top 2 causes. Recommend specific prevention campaigns or public education priorities.

**🏠 Property Vulnerability**
Identify which property types are most fire-prone. Recommend inspection focus areas.

**💰 Damage Severity**
Analyze the mix of minor/moderate/major/catastrophic fires. Comment on whether damage levels are typical or concerning.

**🚒 Response Time Assessment**
If response time data is available, assess performance. Flag if the average response time is above the BFP national standard of 4 minutes. Give improvement tips.

**✅ Top 3 Priority Recommendations**
List exactly 3 specific, actionable priorities for the BFP commander to act on immediately.

Formatting rules:
- Use markdown bold (**) for key findings and numbers.
- Use bullet points under each section.
- Use relevant emojis to make it scannable.
- Keep each bullet to 1–2 sentences.
- Be specific: cite actual numbers and percentages from the data.
- Do NOT use generic advice — base every recommendation on the actual data provided.`;

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the current fire incident dashboard data for BFP Malvar:\n${JSON.stringify(summaryData, null, 2)}\n\nGenerate a full analysis report based on this data.` }
          ],
          temperature: 0.5,
          max_tokens: 1200,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return { insight: response.data.choices[0]?.message?.content || 'Unable to generate insights at this time.' };
    } catch (error: any) {
      console.error('Groq API Error in dashboard insights:', error?.response?.data || error.message);
      throw new InternalServerErrorException('Failed to generate AI insights');
    }
  }

  private timeToMinutes(time: string): number {
    const parts = time.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  async remove(id: number) {
    return this.incidentsRepository.softDelete(id);
  }

  async getDeleted() {
    return this.incidentsRepository.find({
      withDeleted: true,
      where: { deletedAt: Not(IsNull()) },
      order: { deletedAt: 'DESC' },
    });
  }

  async restore(id: number) {
    return this.incidentsRepository.restore(id);
  }

  async hardDelete(id: number) {
    return this.incidentsRepository.delete(id);
  }
}
