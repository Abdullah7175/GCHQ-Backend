import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions.enum';
import { MessagingConfigService } from './messaging-config.service';
import { MessagingService } from './messaging.service';
import {
  CreateMessagingProviderDto,
  TestMessagingDto,
  UpdateMessagingProviderDto,
} from './dto/messaging.dto';

@Controller('messaging-providers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MessagingProvidersController {
  constructor(
    private readonly configService: MessagingConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.configService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  findOne(@Param('id') id: string) {
    return this.configService.findOne(id);
  }

  @Post('test')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  testSend(@Body() dto: TestMessagingDto) {
    return this.messagingService.testSend(dto);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  create(@Body() dto: CreateMessagingProviderDto) {
    return this.configService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  update(@Param('id') id: string, @Body() dto: UpdateMessagingProviderDto) {
    return this.configService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SYSTEM)
  remove(@Param('id') id: string) {
    return this.configService.remove(id);
  }
}
