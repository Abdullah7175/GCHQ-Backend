import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { LatencyModule } from '../latency/latency.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Ambulance, Transit]),
    EventsModule,
    AuditModule,
    LatencyModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '8h') as never,
          issuer: 'gchq-api',
          audience: 'gchq-clients',
        },
      }),
    }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, JwtModule],
})
export class UsersModule {}
