import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('my')
  getMyNotifications(@Req() req: any) {
    return this.notificationsService.getMyNotifications(req.user.userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(
      req.user.userId,
    );

    return { count };
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(Number(id), req.user.userId);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Delete('clear-all')
  clearAll(@Req() req: any) {
    return this.notificationsService.clearAll(req.user.userId);
  }

  @Get(':id/ai-advice')
  getAiAdvice(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.getAiAdvice(Number(id), req.user.userId);
  }

  @Post('ai-advice-from-alert')
  getAiAdviceFromAlert(@Body() body: {
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
    return this.notificationsService.getAiAdviceFromAlert(body);
  }
}
