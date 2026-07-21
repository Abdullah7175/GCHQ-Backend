import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserAwareThrottlerGuard } from './common/security/user-aware-throttler.guard';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProvidersModule } from './providers/providers.module';
import { SectorsModule } from './sectors/sectors.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { EmergencyTypesModule } from './emergency-types/emergency-types.module';
import { TriageCodesModule } from './triage-codes/triage-codes.module';
import { AmbulancesModule } from './ambulances/ambulances.module';
import { TransitsModule } from './transits/transits.module';
import { GpsModule } from './gps/gps.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { CitiesModule } from './cities/cities.module';
import { SeedModule } from './seed/seed.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { LatencyModule } from './latency/latency.module';
import { MessagingModule } from './messaging/messaging.module';
import { GeofencesModule } from './geofences/geofences.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1_000,
        limit: 20,
      },
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'long',
        ttl: 900_000,
        limit: 1_000,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    CitiesModule,
    ProvidersModule,
    SectorsModule,
    HospitalsModule,
    EmergencyTypesModule,
    TriageCodesModule,
    AmbulancesModule,
    TransitsModule,
    GpsModule,
    DashboardModule,
    EventsModule,
    AuditModule,
    LatencyModule,
    MessagingModule,
    GeofencesModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserAwareThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
