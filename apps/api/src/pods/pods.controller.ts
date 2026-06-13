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
import {
  CreatePodSchema,
  PodMemberActionSchema,
  type CreatePod,
  type PodMemberAction,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { PodsService } from './pods.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/pods')
@UseGuards(AuthGuard)
export class PodsController {
  constructor(private readonly pods: PodsService) {}

  @Post()
  @HttpCode(200)
  create(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreatePodSchema)) body: CreatePod,
  ) {
    return this.pods.create(req.user.sub, body);
  }

  @Get()
  feed(@Req() req: AuthRequest) {
    return this.pods.feed(req.user.sub);
  }

  @Get(':id')
  detail(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.pods.detail(req.user.sub, id);
  }

  @Post(':id/request')
  @HttpCode(200)
  request(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.pods.request(req.user.sub, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PodMemberActionSchema)) body: PodMemberAction,
  ) {
    return this.pods.approve(req.user.sub, id, body);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PodMemberActionSchema)) body: PodMemberAction,
  ) {
    return this.pods.decline(req.user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async disband(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.pods.disband(req.user.sub, id);
  }

  @Post(':id/lock')
  @HttpCode(200)
  lock(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.pods.lock(req.user.sub, id);
  }
}
