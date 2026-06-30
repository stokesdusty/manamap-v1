import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CreateConnectionSchema,
  type CreateConnection,
  UpdateConnectionNoteSchema,
  type UpdateConnectionNote,
} from '@manamap/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthGuard, type AccessTokenPayload } from '../auth/auth.guard';
import { Throttle } from '../throttle/throttle.decorator';
import {
  THROTTLE_CONNECTIONS_LIMIT,
  THROTTLE_CONNECTIONS_TTL,
} from '../throttle/throttle.constants';
import type { ConnectionsService } from './connections.service';

type AuthRequest = { user: AccessTokenPayload };

@Controller('v1/connections')
@UseGuards(AuthGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({
    name: 'connections',
    limit: THROTTLE_CONNECTIONS_LIMIT,
    ttl: THROTTLE_CONNECTIONS_TTL,
  })
  sendRequest(
    @Req() req: AuthRequest,
    @Body(new ZodValidationPipe(CreateConnectionSchema)) body: CreateConnection,
  ) {
    return this.connections.sendRequest(req.user.sub, body);
  }

  @Get()
  list(@Req() req: AuthRequest) {
    return this.connections.list(req.user.sub);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.connections.accept(req.user.sub, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.connections.decline(req.user.sub, id);
  }

  @Get(':id')
  getDetail(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.connections.getDetail(req.user.sub, id);
  }

  @Patch(':id/note')
  @HttpCode(200)
  updateNote(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateConnectionNoteSchema)) body: UpdateConnectionNote,
  ) {
    return this.connections.updateNote(req.user.sub, id, body);
  }
}
