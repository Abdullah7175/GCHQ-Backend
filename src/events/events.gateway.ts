import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized (JWT-required)');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.headers?.authorization?.toString().replace(/^Bearer\s+/i, '') ?? undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
        issuer: 'gchq-api',
        audience: 'gchq-clients',
      });
      client.data.authenticated = true;
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected ${client.id}`);
  }

  broadcastTransitUpdate(transit: unknown) {
    this.server?.emit('transit:update', transit);
  }

  broadcastGpsUpdate(data: unknown) {
    this.server?.emit('gps:update', data);
  }

  broadcastDashboardRefresh() {
    this.server?.emit('dashboard:refresh');
  }
}
