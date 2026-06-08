import * as http from 'http';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { Server, type ServerOptions } from 'socket.io';

export class WsAdapter extends IoAdapter {
  private readonly wsPort: number;
  private ioServer: Server | null = null;

  constructor(app: INestApplication, wsPort: number) {
    super(app);
    this.wsPort = wsPort;
  }

  createIOServer(_port: number, options?: ServerOptions): Server {
    if (!this.ioServer) {
      const httpServer = http.createServer();
      this.ioServer = new Server(httpServer, {
        cors: { origin: '*' },
        ...options,
      });
      httpServer.listen(this.wsPort);
    }
    return this.ioServer;
  }
}
