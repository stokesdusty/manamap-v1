import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateLfgSchema,
  LfgLockBodySchema,
  UpdateLfgSchema,
  type CreateLfg,
  type LfgLockBody,
  type UpdateLfg,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { LfgService } from './lfg.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller()
@UseGuards(AuthGuard)
export class LfgController {
  constructor(private readonly lfg: LfgService) {}

  @Get('v1/lfg/me')
  getMySession(@Req() req: AuthRequest) {
    return this.lfg.getMySession(req.user.sub);
  }

  @Get('v1/lfg')
  feed(@Req() req: AuthRequest) {
    return this.lfg.feed(req.user.sub);
  }

  @Post('v1/lfg')
  @HttpCode(200)
  create(@Req() req: AuthRequest, @Body(new ZodValidationPipe(CreateLfgSchema)) body: CreateLfg) {
    return this.lfg.create(req.user.sub, body);
  }

  @Patch('v1/lfg')
  update(@Req() req: AuthRequest, @Body(new ZodValidationPipe(UpdateLfgSchema)) body: UpdateLfg) {
    return this.lfg.update(req.user.sub, body);
  }

  @Delete('v1/lfg')
  @HttpCode(204)
  async remove(@Req() req: AuthRequest) {
    await this.lfg.remove(req.user.sub);
  }

  @Post('v1/lfg/:hostUserId/invite')
  @HttpCode(200)
  invite(@Req() req: AuthRequest, @Param('hostUserId') hostUserId: string) {
    return this.lfg.invite(req.user.sub, hostUserId);
  }

  @Post('v1/lfg/:hostUserId/lock')
  @HttpCode(200)
  lock(
    @Req() req: AuthRequest,
    @Param('hostUserId') hostUserId: string,
    @Body(new ZodValidationPipe(LfgLockBodySchema)) body: LfgLockBody,
  ) {
    return this.lfg.lock(req.user.sub, hostUserId, body);
  }
}
