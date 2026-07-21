import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingProviderConfig } from './messaging-provider-config.entity';
import { MessagingConfigService } from './messaging-config.service';
import { MessagingService } from './messaging.service';
import { MessagingProvidersController } from './messaging.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MessagingProviderConfig])],
  providers: [MessagingConfigService, MessagingService],
  controllers: [MessagingProvidersController],
  exports: [MessagingService, MessagingConfigService],
})
export class MessagingModule {}
