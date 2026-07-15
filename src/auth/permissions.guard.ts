import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Permission } from './permissions.enum';
import { ROLE_PERMISSIONS } from './role-permissions';
import { UserRole } from '../common/enums';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    if (!user) return false;

    // Admin bypasses all permissions and scopes checks
    if (user.role === UserRole.ADMIN) return true;

    const userRole = user.role as UserRole;
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];

    // Verify user has all required permissions
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p));
    if (!hasPermission) return false;

    // --- ABAC / Resource-Level Scoping Checks ---
    const params = request.params || {};
    const query = request.query || {};

    // 1. City Scope check (ensure non-admins can only query within their assigned cityId)
    if (user.cityId) {
      if (params.cityId && params.cityId !== user.cityId) return false;
      if (query.cityId && query.cityId !== user.cityId) return false;
    }

    // 2. Hospital Scope check (hospital users must only access their own hospital dashboard/queues)
    if (user.role === UserRole.HOSPITAL && user.hospitalId) {
      if (params.hospitalId && params.hospitalId !== user.hospitalId) return false;
      if (query.hospitalId && query.hospitalId !== user.hospitalId) return false;
    }

    // 3. Sector Scope check (Sector CSRs can only modify/view transits in their assigned sector, unless overseer)
    if (user.role === UserRole.HQ_1122 && !user.isCityOverseer && user.sectorId) {
      if (params.sectorId && params.sectorId !== user.sectorId) return false;
      if (query.sectorId && query.sectorId !== user.sectorId) return false;
    }

    return true;
  }
}
