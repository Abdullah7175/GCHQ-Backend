import { UserRole } from '../common/enums';
import { Permission } from './permissions.enum';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission), // Admin has all permissions
  [UserRole.HOSPITAL]: [
    Permission.VIEW_DASHBOARD_HOSPITAL,
    Permission.READ_TRANSIT,
    Permission.PREP_READY_TRANSIT,
  ],
  [UserRole.SAFE_CITY]: [
    Permission.VIEW_DASHBOARD_HQ, // Safe City uses the HQ dashboard logic (Table/Guiding)
    Permission.READ_TRANSIT,
    Permission.CREATE_TRANSIT,
    Permission.CLAIM_TRANSIT,
    Permission.RELEASE_TRANSIT,
    Permission.START_TRANSIT,
    Permission.COMPLETE_TRANSIT,
    Permission.ARRIVE_TRANSIT,
    Permission.UPDATE_TRANSIT,
    Permission.TOGGLE_OVERRIDE,
  ],
  [UserRole.HQ_1122]: [
    Permission.VIEW_DASHBOARD_SAFE_CITY, // HQ_1122 uses the Safe City dashboard logic (Map/Overseer)
    Permission.READ_TRANSIT,
    Permission.TOGGLE_OVERRIDE,
  ],
  [UserRole.VVIP]: [
    Permission.VIEW_DASHBOARD_VVIP,
    Permission.READ_TRANSIT,
  ],
  [UserRole.PARAMEDIC]: [
    Permission.CREATE_TRANSIT,
    Permission.START_TRANSIT,
    Permission.COMPLETE_TRANSIT,
    Permission.ARRIVE_TRANSIT,
    Permission.UPDATE_GPS,
    Permission.READ_TRANSIT,
  ],
};
