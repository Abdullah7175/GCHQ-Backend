import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

const GLOBAL_ROOM = 'global';
const REFRESH_DEBOUNCE_MS = 5_000;

interface SocketUser {
  sub: string;
  role: string;
  cityId?: string;
  hospitalId?: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  /** dashboard:refresh debounce state, keyed by city ('*' = system-wide) */
  private lastRefreshAt = new Map<string, number>();
  private pendingRefresh = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized (JWT-required, city rooms)');
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

      const payload = await this.jwtService.verifyAsync<SocketUser>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
        issuer: 'gchq-api',
        audience: 'gchq-clients',
      });
      client.data.user = payload;

      // City-scoped users only receive their own city's traffic;
      // admins / users without a city see everything via the global room.
      if (payload.cityId && payload.role !== 'admin') {
        await client.join(`city:${payload.cityId}`);
        if (payload.hospitalId) {
          await client.join(`hospital:${payload.hospitalId}`);
        }
      } else {
        await client.join(GLOBAL_ROOM);
      }
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected ${client.id}`);
  }

  onModuleDestroy() {
    for (const timer of this.pendingRefresh.values()) clearTimeout(timer);
    this.pendingRefresh.clear();
  }

  /** Emit to the city room + global observers; without a city, fall back to everyone. */
  private emitScoped(event: string, payload: unknown, cityId?: string | null) {
    if (!this.server) return;
    if (cityId) {
      this.server.to(`city:${cityId}`).to(GLOBAL_ROOM).emit(event, payload);
    } else {
      this.server.emit(event, payload);
    }
  }

  broadcastTransitUpdate(transit: unknown) {
    const cityId = (transit as { cityId?: string } | null)?.cityId;
    this.emitScoped('transit:update', transit, cityId);
  }

  broadcastGpsUpdate(data: unknown) {
    const cityId = (data as { cityId?: string } | null)?.cityId;
    this.emitScoped('gps:update', data, cityId);
  }

  /**
   * At most one dashboard:refresh per city per 5 s (leading + trailing),
   * so GPS bursts don't turn into dashboard refetch storms.
   */
  broadcastDashboardRefresh(cityId?: string | null) {
    const key = cityId || '*';
    const now = Date.now();
    const last = this.lastRefreshAt.get(key) ?? 0;
    const elapsed = now - last;

    if (elapsed >= REFRESH_DEBOUNCE_MS) {
      this.lastRefreshAt.set(key, now);
      this.emitScoped('dashboard:refresh', undefined, cityId);
      return;
    }

    if (!this.pendingRefresh.has(key)) {
      const timer = setTimeout(() => {
        this.pendingRefresh.delete(key);
        this.lastRefreshAt.set(key, Date.now());
        this.emitScoped('dashboard:refresh', undefined, cityId);
      }, REFRESH_DEBOUNCE_MS - elapsed);
      this.pendingRefresh.set(key, timer);
    }
  }
}
