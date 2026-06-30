import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ResolveReportSchema, type ResolveReport } from '@manamap/shared';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminModerationService } from './admin-moderation.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/admin/moderation')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminModerationController {
  constructor(private readonly svc: AdminModerationService) {}

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }

  @Get('reports')
  listReports(@Query('status') status?: string) {
    const valid = ['OPEN', 'REVIEWED', 'ACTIONED', 'ALL'];
    const s = valid.includes(status ?? '')
      ? (status as 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'ALL')
      : 'OPEN';
    return this.svc.listReports(s);
  }

  @Get('reports/:id')
  getReport(@Param('id') id: string) {
    return this.svc.getReport(id);
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  resolveReport(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ResolveReportSchema)) body: ResolveReport,
  ) {
    return this.svc.resolveReport(id, req.user.sub, body);
  }
}
