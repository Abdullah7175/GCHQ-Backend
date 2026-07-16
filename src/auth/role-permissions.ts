import { UserRole } from '../common/enums';
import { Permission } from './permissions.enum';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.HOSPITAL]: [
    Permission.VIEW_DASHBOARD_HOSPITAL,
    Permission.READ_TRANSIT,
    Permission.PREP_READY_TRANSIT,
  ],
  [UserRole.HQ_1122]: [
    Permission.VIEW_DASHBOARD_HQ,
    Permission.READ_TRANSIT,
    Permission.CLAIM_TRANSIT,
    Permission.RELEASE_TRANSIT,
    Permission.TOGGLE_OVERRIDE,
  ],
  [UserRole.SAFE_CITY]: [
    Permission.VIEW_DASHBOARD_SAFE_CITY,
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
    Permission.UPDATE_ETA_TRANSIT,
    Permission.READ_TRANSIT,
  ],
};
