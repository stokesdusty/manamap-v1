import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import type { DiscoveryService } from './discovery.service';
import { type NearbyFilters } from './discovery.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('nearby')
  nearby(
    @Req() req: AuthRequest,
    @Query('format') format?: string,
    @Query('colors') colorsStr?: string,
    @Query('powerMin') powerMinStr?: string,
    @Query('powerMax') powerMaxStr?: string,
    @Query('vibe') vibe?: string,
  ) {
    const filters: NearbyFilters = {};
    if (format) filters.format = format;
    if (colorsStr) filters.colors = colorsStr.split(',').filter(Boolean);
    if (powerMinStr) filters.powerMin = parseInt(powerMinStr, 10);
    if (powerMaxStr) filters.powerMax = parseInt(powerMaxStr, 10);
    if (vibe) filters.vibe = vibe;
    return this.discovery.nearby(req.user.sub, filters);
  }

  @Get('suggestions')
  suggestions(@Req() req: AuthRequest) {
    return this.discovery.suggestions(req.user.sub);
  }
}
