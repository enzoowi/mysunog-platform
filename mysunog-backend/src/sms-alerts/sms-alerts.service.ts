import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsRecipient } from './sms-recipient.entity';
import { DetectionEvent } from '../detection/detection-event.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsAlertsService implements OnModuleInit {
  private readonly logger = new Logger(SmsAlertsService.name);
  private smsApiPhKey: string | null = null;
  private smsApiPhEndpoint = 'https://smsapiph.onrender.com/api/v1/send/sms';

  constructor(
    @InjectRepository(SmsRecipient)
    private smsRecipientRepository: Repository<SmsRecipient>,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    this.smsApiPhKey = this.configService.get<string>('SMSAPIPH_API_KEY') || 'sk-2b10iqxgq469hq1i0bhc5hjml2zn6iti';
    this.logger.log('SMS API PH initialized with ' + (this.smsApiPhKey ? 'provided key.' : 'no key.'));
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

    if (!this.smsApiPhKey) {
      this.logger.warn('SMSAPIPH_API_KEY not configured. Logging SMS message instead:');
      this.logger.log(`\n=== SMS START ===\n${smsBody}\n=== SMS END ===`);
      return;
    }

    for (const recipient of recipients) {
      try {
        const response = await axios.post(
          this.smsApiPhEndpoint,
          {
            recipient: recipient.phoneNumber,
            message: smsBody
          },
          {
            headers: {
              'x-api-key': this.smsApiPhKey,
              'Content-Type': 'application/json'
            }
          }
        );
        this.logger.log(`Successfully sent SMS to ${recipient.phoneNumber}. Response: ${JSON.stringify(response.data)}`);
      } catch (error) {
        this.logger.error(`Exception while sending SMS to ${recipient.phoneNumber}: ${error.response?.data?.error || error.message}`);
      }
    }
  }
}
