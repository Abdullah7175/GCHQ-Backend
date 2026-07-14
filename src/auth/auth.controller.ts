import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../users/dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto);
  }
}
