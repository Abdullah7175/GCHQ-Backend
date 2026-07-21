import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LatencyBreachRule } from './latency-breach-rule.entity';
import { LatencyBreachRecipient } from './latency-breach-recipient.entity';
import { LatencyBreachRecord } from './latency-breach-record.entity';
import { LatencyNotification } from './latency-notification.entity';
import { UserPresence } from './user-presence.entity';
import { LatencyService } from './latency.service';
import { LatencyRulesService } from './latency-rules.service';
import {
  LatencyBreachesController,
  LatencyRecipientsController,
  LatencyRulesController,
  PresenceController,
} from './latency.controller';
import { Transit } from '../transits/transit.entity';
import { User } from '../users/user.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LatencyBreachRule,
      LatencyBreachRecipient,
      LatencyBreachRecord,
      LatencyNotification,
      UserPresence,
      Transit,
      User,
      Hospital,
    ]),
    MessagingModule,
  ],
  providers: [LatencyService, LatencyRulesService],
  controllers: [
    LatencyRulesController,
    LatencyRecipientsController,
    LatencyBreachesController,
    PresenceController,
  ],
  exports: [LatencyService],
})
export class LatencyModule {}
