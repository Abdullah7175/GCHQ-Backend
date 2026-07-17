import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../users/dto/user.dto';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  /** Strict login rate limit — OWASP brute-force / credential stuffing control */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 }, short: { limit: 3, ttl: 1_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: { user: JwtPayload }) {
    return this.usersService.logout(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(200)
  async me(@Req() req: { user: JwtPayload }) {
    const user = await this.usersService.findOne(req.user.sub, {
      hospital: true,
      provider: true,
      city: true,
      sector: true,
    } as never);
    return { user };
  }
}
