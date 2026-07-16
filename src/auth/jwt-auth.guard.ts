import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey) {
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
        };
        return true;
      }
    }

    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (_) {
      return false;
    }
  }
}
