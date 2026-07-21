export enum UserRole {
  HOSPITAL = 'hospital',
  SAFE_CITY = 'safe_city',
  HQ_1122 = 'hq_1122',
  VVIP = 'vvip',
  PARAMEDIC = 'paramedic',
  ADMIN = 'admin',
}

export enum ProviderShape {
  CIRCLE = 'circle',
  TRIANGLE = 'triangle',
  SQUARE = 'square',
  DIAMOND = 'diamond',
  STAR = 'star',
  HEXAGON = 'hexagon',
  CROSS = 'cross',
  PENTAGON = 'pentagon',
}

export enum AmbulanceStatus {
  AVAILABLE = 'available',
  EN_ROUTE = 'en_route',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export enum TransitStatus {
  PENDING = 'pending',
  EN_ROUTE = 'en_route',
  ARRIVED = 'arrived',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PrepStatus {
  PENDING = 'pending',
  READY = 'ready',
}

/** Who chose the destination hospital for this corridor (driver must pick before create). */
export enum HospitalChoiceConsent {
  /** PC — Patient Choice */
  PATIENT_CHOICE = 'pc',
  /** AC — Ambulance Choice */
  AMBULANCE_CHOICE = 'ac',
}

export enum SectorGridStatus {
  FLOWING = 'flowing',
  MODERATE = 'moderate',
  SATURATING = 'saturating',
  GRIDLOCKED = 'gridlocked',
}
