import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  afterInit() {
    console.log('WebSocket gateway initialized');
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
