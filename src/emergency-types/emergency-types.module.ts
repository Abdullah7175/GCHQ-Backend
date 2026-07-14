import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyType } from './emergency-type.entity';
import { EmergencyTypesService } from './emergency-types.service';
import { EmergencyTypesController } from './emergency-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyType])],
  providers: [EmergencyTypesService],
  controllers: [EmergencyTypesController],
  exports: [EmergencyTypesService],
})
export class EmergencyTypesModule {}
