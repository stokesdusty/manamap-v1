import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { UpdateStoreProfileSchema, type UpdateStoreProfile } from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AdminStoresService } from './admin-stores.service';

const RejectStoreBodySchema = z.object({
  reason: z.string().max(500).optional(),
});
type RejectStoreBody = z.infer<typeof RejectStoreBodySchema>;

@Controller('v1/admin/stores')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminStoresController {
  constructor(private readonly svc: AdminStoresService) {}

  @Get('submissions')
  listSubmissions() {
    return this.svc.listSubmissions();
  }

  @Post(':id/approve')
  @HttpCode(200)
  approveStore(@Param('id') id: string) {
    return this.svc.approveStore(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  rejectStore(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectStoreBodySchema)) body: RejectStoreBody,
  ) {
    return this.svc.rejectStore(id, body.reason);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  reactivateStore(@Param('id') id: string) {
    return this.svc.reactivateStore(id);
  }

  @Post(':id/claim-code')
  @HttpCode(200)
  generateClaimCode(@Param('id') id: string) {
    return this.svc.generateClaimCode(id);
  }

  @Delete(':id/owners/:userId')
  removeOwner(@Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeOwner(id, userId);
  }

  @Get()
  search(@Query('q') q?: string) {
    return this.svc.search(q);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.svc.getDetail(id);
  }

  @Patch(':id')
  updateProfile(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStoreProfileSchema)) body: UpdateStoreProfile,
  ) {
    return this.svc.updateProfile(id, body);
  }
}
