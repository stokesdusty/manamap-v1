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
  ReorderSocialLinksSchema,
  SocialLinkInputSchema,
  UpdateSocialLinkSchema,
  type ReorderSocialLinks,
  type SocialLinkInput,
  type UpdateSocialLink,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { SocialsService } from './socials.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/me/socials')
@UseGuards(AuthGuard)
export class SocialsController {
  constructor(private readonly socials: SocialsService) {}

  @Get()
  list(@Req() req: AuthRequest) {
    return this.socials.list(req.user.sub);
  }

  @Post()
  @HttpCode(201)
  add(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(SocialLinkInputSchema)) body: SocialLinkInput,
  ) {
    return this.socials.add(req.user.sub, body);
  }

  @Patch('reorder')
  @HttpCode(200)
  reorder(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(ReorderSocialLinksSchema)) body: ReorderSocialLinks,
  ) {
    return this.socials.reorder(req.user.sub, body.order);
  }

  @Patch(':id')
  @HttpCode(200)
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSocialLinkSchema)) body: UpdateSocialLink,
  ) {
    return this.socials.update(req.user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.socials.remove(req.user.sub, id);
  }
}
