import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailRecipient } from './email-recipient.entity';
import { DetectionEvent } from '../detection/detection-event.entity';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailAlertsService implements OnModuleInit {
  private readonly logger = new Logger(EmailAlertsService.name);
  private resend: Resend | null = null;

  constructor(
    @InjectRepository(EmailRecipient)
    private emailRecipientRepository: Repository<EmailRecipient>,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not found in environment variables. Email alerts will not be sent.');
    }
  }

  async getAllRecipients(): Promise<EmailRecipient[]> {
    return this.emailRecipientRepository.find({ order: { createdAt: 'DESC' } });
  }

  async addRecipient(emailAddress: string, name?: string): Promise<EmailRecipient> {
    const recipient = this.emailRecipientRepository.create({ emailAddress, name });
    return this.emailRecipientRepository.save(recipient);
  }

  async removeRecipient(id: number): Promise<void> {
    await this.emailRecipientRepository.delete(id);
  }

  async sendDetectionAlert(event: DetectionEvent, cameraName: string, location: string): Promise<void> {
    const recipients = await this.emailRecipientRepository.find({ where: { isActive: true } });
    if (recipients.length === 0) {
      this.logger.log('No active email recipients to notify.');
      return;
    }

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not found. Cannot send emails. Logging what would be sent:');
    }

    const typeLabel = event.detectionType.toUpperCase();
    const emoji = event.detectionType === 'fire' ? '🔥' : '💨';
    const confidencePct = Math.round(Number(event.confidence) * 100);
    const severityLabel = event.severity.toUpperCase();
    const dateStr = new Date(event.createdAt).toISOString().split('T')[0];
    const timeStr = new Date(event.createdAt).toTimeString().split(' ')[0] + ' PHT';

    const subject = `🚨 MYSUNOG ALERT: ${emoji} ${typeLabel} DETECTED`;
    const htmlContent = `
      <h2>🚨 MySunog AI Detection Alert</h2>
      <p><strong>${emoji} ${typeLabel} DETECTED</strong></p>
      <ul>
        <li><strong>📍 Camera:</strong> ${cameraName || event.cameraSource || 'Unknown'}</li>
        <li><strong>🏢 Location:</strong> ${location || 'Unknown'}</li>
        <li><strong>📊 Confidence:</strong> ${confidencePct}% (${severityLabel} Severity)</li>
        <li><strong>📅 Date:</strong> ${dateStr}</li>
        <li><strong>⏰ Time:</strong> ${timeStr}</li>
      </ul>
      <p>⚠️ <strong>Please check the dashboard immediately.</strong></p>
    `;

    this.logger.log(`Preparing to send email alert to ${recipients.length} recipients...`);

    if (!this.resend) {
      this.logger.log(`Subject: ${subject}`);
      return;
    }

    for (const recipient of recipients) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: 'MySunog Alerts <onboarding@resend.dev>',
          to: recipient.emailAddress,
          subject: subject,
          html: htmlContent,
        });

        if (error) {
          this.logger.error(`Resend API Error for ${recipient.emailAddress}: ${error.name} - ${error.message}`);
        } else {
          this.logger.log(`Successfully sent email to ${recipient.emailAddress} (ID: ${data?.id})`);
        }
      } catch (error) {
        this.logger.error(`Exception while sending email to ${recipient.emailAddress}: ${error.message}`);
      }
    }
  }
}
