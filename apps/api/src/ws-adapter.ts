import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { Server, type ServerOptions } from 'socket.io';

export class WsAdapter extends IoAdapter {
  private ioServer: Server | null = null;

  constructor(app: INestApplication) { super(app); }

  createIOServer(_port: number, options?: ServerOptions): Server {
    if (!this.ioServer) {
      this.ioServer = new Server(this.httpServer, {
        path: '/ws/socket.io',
        cors: { origin: process.env['CORS_ORIGIN']?.split(',') ?? [] },
        ...options,
      });
    }
    return this.ioServer;
  }
}
