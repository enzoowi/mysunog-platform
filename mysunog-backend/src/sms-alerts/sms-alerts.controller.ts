import { Controller, Get, Post, Put, Body, Delete, Param, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { SmsAlertsService } from './sms-alerts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sms-alerts')
@UseGuards(AuthGuard('jwt'))
export class SmsAlertsController {
  constructor(private readonly smsService: SmsAlertsService) {}

  @Get('recipients')
  async getRecipients() {
    return this.smsService.getAllRecipients();
  }

  @Post('recipients')
  async addRecipient(@Body() body: { phoneNumber: string; name?: string }) {
    if (!body.phoneNumber) {
      throw new HttpException('Phone number is required', HttpStatus.BAD_REQUEST);
    }
    return this.smsService.addRecipient(body.phoneNumber, body.name);
  }

  @Put('recipients/:id')
  async updateRecipient(
    @Param('id') id: string,
    @Body() body: { phoneNumber: string; name?: string }
  ) {
    if (!body.phoneNumber) {
      throw new HttpException('Phone number is required', HttpStatus.BAD_REQUEST);
    }
    return this.smsService.updateRecipient(+id, body.phoneNumber, body.name);
  }

  @Delete('recipients/:id')
  async removeRecipient(@Param('id') id: string) {
    return this.smsService.removeRecipient(+id);
  }
}
