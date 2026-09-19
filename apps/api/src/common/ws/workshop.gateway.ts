import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Live workshop board updates (Feature Spec §2.1 "Real-time updates via WebSocket"). Production
 * runs this behind AWS API Gateway WebSocket + ElastiCache Redis pub/sub so it scales across
 * multiple Fargate tasks; locally, Socket.IO's in-memory adapter is sufficient for a single
 * instance and rooms are keyed by dealerId to preserve tenant isolation.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: 'workshop' })
export class WorkshopGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WorkshopGateway.name);

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ?? client.handshake.query?.token;
      const payload = this.jwt.decode(String(token)) as { dealerId?: string } | null;
      if (!payload?.dealerId) {
        client.disconnect();
        return;
      }
      client.join(`dealer:${payload.dealerId}`);
    } catch (err) {
      this.logger.warn(`Rejected workshop socket connection: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect() {
    // no-op: room membership is cleaned up automatically by socket.io on disconnect
  }

  emitJobCardChanged(dealerId: string, jobCard: unknown) {
    this.server.to(`dealer:${dealerId}`).emit('job-card.changed', jobCard);
  }

  emitCapacityChanged(dealerId: string) {
    this.server.to(`dealer:${dealerId}`).emit('capacity.changed');
  }
}
