import { Controller, Get, Post, Body, Delete, Param, UseGuards } from '@nestjs/common';
import { EmailAlertsService } from './email-alerts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('email-alerts')
@UseGuards(AuthGuard('jwt'))
export class EmailAlertsController {
  constructor(private readonly emailService: EmailAlertsService) {}

  @Get('recipients')
  async getRecipients() {
    return this.emailService.getAllRecipients();
  }

  @Post('recipients')
  async addRecipient(@Body() body: { emailAddress: string; name?: string }) {
    return this.emailService.addRecipient(body.emailAddress, body.name);
  }

  @Delete('recipients/:id')
  async removeRecipient(@Param('id') id: string) {
    return this.emailService.removeRecipient(+id);
  }
}
