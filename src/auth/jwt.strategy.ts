import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  cityId?: string;
  hospitalId?: string;
  providerId?: string;
  sectorId?: string;
  permittedSectorIds?: string[];
  isCityOverseer?: boolean;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          if (!req?.cookies) return null;
          return req.cookies['gchq_token'] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      issuer: 'gchq-api',
      audience: 'gchq-clients',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findRawById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session expired');
    }
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Session revoked — please sign in again');
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      cityId: user.cityId,
      hospitalId: user.hospitalId,
      providerId: user.providerId,
      sectorId: user.sectorId,
      permittedSectorIds: user.permittedSectorIds ?? undefined,
      isCityOverseer: user.isCityOverseer,
      tokenVersion: user.tokenVersion,
    };
  }
}
