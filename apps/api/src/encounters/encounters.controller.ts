import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { EncountersService } from './encounters.service';

@Controller('v1/encounters')
@UseGuards(AuthGuard)
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Get()
  list(@Req() req: { user: AccessTokenPayload }) {
    return this.encounters.list(req.user.sub);
  }
}
