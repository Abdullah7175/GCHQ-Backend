import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriageCode } from './triage-code.entity';
import { TriageCodesService } from './triage-codes.service';
import { TriageCodesController } from './triage-codes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TriageCode])],
  providers: [TriageCodesService],
  controllers: [TriageCodesController],
  exports: [TriageCodesService],
})
export class TriageCodesModule {}
