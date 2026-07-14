import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sector } from './sector.entity';
import { SectorsService } from './sectors.service';
import { SectorsController } from './sectors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sector])],
  providers: [SectorsService],
  controllers: [SectorsController],
  exports: [SectorsService],
})
export class SectorsModule {}
