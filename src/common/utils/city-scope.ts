import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../../auth/jwt.strategy';
import { UserRole } from '../enums';

/** Roles that can query any city when cityId is passed explicitly */
const MULTI_CITY_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.VVIP, UserRole.HQ_1122];

export function resolveCityId(user: JwtPayload, requestedCityId?: string): string | undefined {
  if (requestedCityId) {
    if (!user.cityId && MULTI_CITY_ROLES.includes(user.role as UserRole)) {
      return requestedCityId;
    }
    if (user.cityId && user.cityId !== requestedCityId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Cannot access data for another city');
    }
    return requestedCityId;
  }
  return user.cityId;
}

export function requireCityId(user: JwtPayload, requestedCityId?: string): string {
  const cityId = resolveCityId(user, requestedCityId);
  if (!cityId) {
    throw new ForbiddenException('City context is required. Select a city or assign user to a city.');
  }
  return cityId;
}
