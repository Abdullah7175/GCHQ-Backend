export enum Permission {
  // System Configurations (Admin actions)
  MANAGE_SYSTEM = 'manage:system',

  // Dashboards access
  VIEW_DASHBOARD_HOSPITAL = 'view:dashboard:hospital',
  VIEW_DASHBOARD_SAFE_CITY = 'view:dashboard:safe_city',
  VIEW_DASHBOARD_HQ = 'view:dashboard:hq',
  VIEW_DASHBOARD_VVIP = 'view:dashboard:vvip',

  // Transit operations
  READ_TRANSIT = 'read:transit',
  CREATE_TRANSIT = 'create:transit',
  CLAIM_TRANSIT = 'claim:transit',
  RELEASE_TRANSIT = 'release:transit',
  START_TRANSIT = 'start:transit',
  COMPLETE_TRANSIT = 'complete:transit',
  ARRIVE_TRANSIT = 'arrive:transit',
  PREP_READY_TRANSIT = 'prep_ready:transit',
  UPDATE_TRANSIT = 'update:transit',
  DELETE_TRANSIT = 'delete:transit',

  // Telemetry & GPS
  UPDATE_GPS = 'update:gps',
  READ_GPS = 'read:gps',

  // Sector grid overrides
  TOGGLE_OVERRIDE = 'toggle:override',
}
