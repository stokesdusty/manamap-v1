import {
  Body, Controller, Get, HttpCode, Param, Post, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminStoresService } from './admin-stores.service';

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
}
