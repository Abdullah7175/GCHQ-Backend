import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey && typeof apiKey === 'string' && apiKey.length >= 16 && apiKey.length <= 128) {
      const user = await this.usersService.findByApiKey(apiKey);
      if (user && user.isActive) {
        request.user = {
          sub: user.id,
          email: user.email,
          role: user.role,
          cityId: user.cityId,
          hospitalId: user.hospitalId,
          providerId: user.providerId,
          sectorId: user.sectorId,
          isCityOverseer: user.isCityOverseer,
          tokenVersion: user.tokenVersion,
        };
        return true;
      }
      throw new UnauthorizedException('Invalid API key');
    }

    const result = await super.canActivate(context);
    return result as boolean;
  }
}
