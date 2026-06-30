import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AdminStoreClaimsService } from './admin-store-claims.service';

type AuthRequest = { user: AccessTokenPayload };

const RejectClaimBodySchema = z.object({
  reason: z.string().max(500).optional(),
});
type RejectClaimBody = z.infer<typeof RejectClaimBodySchema>;

@Controller('v1/admin/store-claims')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStoreClaimsController {
  constructor(private readonly svc: AdminStoreClaimsService) {}

  @Get()
  list() {
    return this.svc.listPending();
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.svc.approve(id, req.user.sub);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(RejectClaimBodySchema)) body: RejectClaimBody,
  ) {
    return this.svc.reject(id, req.user.sub, body.reason);
  }
}
