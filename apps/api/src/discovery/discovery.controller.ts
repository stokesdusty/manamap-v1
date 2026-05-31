import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { DiscoveryService } from './discovery.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('nearby')
  nearby(@Req() req: AuthRequest) {
    return this.discovery.nearby(req.user.sub);
  }
}
