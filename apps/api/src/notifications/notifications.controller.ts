import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { NotificationsService } from './notifications.service';

@Controller('v1/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Request() req: { user: { sub: string } },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(
      req.user.sub,
      cursor,
      limit !== undefined ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  unreadCount(@Request() req: { user: { sub: string } }) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Post('read')
  markRead(@Request() req: { user: { sub: string } }, @Body() body: { ids?: string[] }) {
    return this.notifications.markRead(req.user.sub, body.ids);
  }

  @Post(':id/read')
  markOneRead(@Request() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, [id]);
  }
}
