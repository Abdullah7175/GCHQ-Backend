import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
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
    SeedModule,
  ],
})
export class AppModule {}
