import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminUpdateUserSchema, AdminUserActionSchema } from '@manamap/shared';
import type { AdminUpdateUser, AdminUserAction } from '@manamap/shared';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AdminUsersService } from './admin-users.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.svc.search(q);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.svc.getDetail(id);
  }

  @Post(':id/moderation-action')
  @HttpCode(200)
  takeAction(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(AdminUserActionSchema)) body: AdminUserAction,
  ) {
    return this.svc.takeModerationAction(req.user.sub, id, body);
  }

  @Patch(':id')
  updateProfile(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(AdminUpdateUserSchema)) body: AdminUpdateUser,
  ) {
    return this.svc.updateProfile(req.user.sub, id, body);
  }
}
