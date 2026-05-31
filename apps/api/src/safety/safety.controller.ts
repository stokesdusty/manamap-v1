import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BlockBodySchema, ReportBodySchema, type BlockBody, type ReportBody } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { SafetyService } from './safety.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1')
@UseGuards(AuthGuard)
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Post('blocks')
  @HttpCode(201)
  block(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(BlockBodySchema)) body: BlockBody,
  ) {
    return this.safety.block(req.user.sub, body.userId);
  }

  @Delete('blocks/:userId')
  @HttpCode(200)
  unblock(@Req() req: AuthRequest, @Param('userId') userId: string) {
    return this.safety.unblock(req.user.sub, userId);
  }

  @Get('blocks')
  listBlocked(@Req() req: AuthRequest) {
    return this.safety.listBlocked(req.user.sub);
  }

  @Post('reports')
  @HttpCode(201)
  report(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ReportBodySchema)) body: ReportBody,
  ) {
    return this.safety.report(req.user.sub, body);
  }
}
