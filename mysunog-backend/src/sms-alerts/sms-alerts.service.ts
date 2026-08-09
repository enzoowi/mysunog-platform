import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsRecipient } from './sms-recipient.entity';
import { DetectionEvent } from '../detection/detection-event.entity';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsAlertsService implements OnModuleInit {
  private readonly logger = new Logger(SmsAlertsService.name);
  private twilioClient: Twilio | null = null;
  private twilioFromNumber: string | null = null;

  constructor(
    @InjectRepository(SmsRecipient)
    private smsRecipientRepository: Repository<SmsRecipient>,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioFromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || null;

    if (accountSid && authToken && this.twilioFromNumber) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized successfully.');
    } else {
      this.logger.warn('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) not fully configured. SMS alerts will not be sent, only logged.');
    }
  }

  async getAllRecipients(): Promise<SmsRecipient[]> {
    return this.smsRecipientRepository.find({ order: { createdAt: 'DESC' } });
  }

  async addRecipient(phoneNumber: string, name?: string): Promise<SmsRecipient> {
    const recipient = this.smsRecipientRepository.create({ phoneNumber, name });
    return this.smsRecipientRepository.save(recipient);
  }

  async updateRecipient(id: number, phoneNumber: string, name?: string): Promise<SmsRecipient> {
    const recipient = await this.smsRecipientRepository.findOneBy({ id });
    if (!recipient) {
      throw new HttpException('Recipient not found', HttpStatus.NOT_FOUND);
    }
    recipient.phoneNumber = phoneNumber;
    if (name !== undefined) {
      recipient.name = name;
    }
    return this.smsRecipientRepository.save(recipient);
  }

  async removeRecipient(id: number): Promise<void> {
    await this.smsRecipientRepository.delete(id);
  }

  async sendDetectionAlert(event: DetectionEvent, cameraName: string, location: string): Promise<void> {
    const recipients = await this.smsRecipientRepository.find({ where: { isActive: true } });
    if (recipients.length === 0) {
      this.logger.log('No active SMS recipients to notify.');
      return;
    }

    const typeLabel = event.detectionType.toUpperCase();
    const confidencePct = Math.round(Number(event.confidence) * 100);
    const dateObj = new Date(event.createdAt);
    
    // Convert to PHT (UTC+8)
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: 'Asia/Manila',
      hour12: false,
      hour: '2-digit', 
      minute:'2-digit' 
    };
    const timeStr = dateObj.toLocaleTimeString('en-US', options) + ' PHT';

    const smsBody = `🚨 MYSUNOG ALERT 🚨
${typeLabel} DETECTED!
Conf: ${confidencePct}%
Cam: ${cameraName || event.cameraSource || 'Unknown'}
Loc: ${location || 'Unknown'}
Time: ${timeStr}

Please check the MySunog dashboard immediately.`;

    this.logger.log(`Preparing to send SMS alert to ${recipients.length} recipients...`);

    if (!this.twilioClient || !this.twilioFromNumber) {
      this.logger.warn('Twilio not configured. Logging SMS message instead:');
      this.logger.log(`\n=== SMS START ===\n${smsBody}\n=== SMS END ===`);
      return;
    }

    for (const recipient of recipients) {
      try {
        const message = await this.twilioClient.messages.create({
          body: smsBody,
          from: this.twilioFromNumber,
          to: recipient.phoneNumber
        });
        this.logger.log(`Successfully sent SMS to ${recipient.phoneNumber} (SID: ${message.sid})`);
      } catch (error) {
        this.logger.error(`Exception while sending SMS to ${recipient.phoneNumber}: ${error.message}`);
      }
    }
  }
}
