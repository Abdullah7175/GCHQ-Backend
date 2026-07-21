export interface CityOperationalConfig {
  /** Speed (km/h) below which a vehicle triggers a latency breach alert */
  latencySpeedThresholdKmh: number;
  /** Max simultaneous active transits allowed in this city */
  maxConcurrentTransits: number;
  /** Default Google Maps baseline ETA used for time-saved KPI */
  defaultBaselineEtaMinutes: number;
  /** Prefix for transit IDs, e.g. LHE → LHE-0042 */
  transitIdPrefix: string;
  enableSurgeProtocol: boolean;
  enableTransitRateKpi: boolean;
  privacyRedactPatientData: boolean;
  /** Higher = shown first on multi-city VVIP overview */
  commandPriority: number;
  /** When enabled, EN_ROUTE transits auto-complete after delay inside hospital geofence */
  geofenceAutoCompleteEnabled: boolean;
  /** Seconds ambulance must stay inside geofence before auto-complete */
  geofenceAutoCompleteDelaySeconds: number;
}

export const DEFAULT_CITY_CONFIG: CityOperationalConfig = {
  latencySpeedThresholdKmh: 10,
  maxConcurrentTransits: 50,
  defaultBaselineEtaMinutes: 15,
  transitIdPrefix: 'LHE',
  enableSurgeProtocol: true,
  enableTransitRateKpi: true,
  privacyRedactPatientData: true,
  commandPriority: 1,
  geofenceAutoCompleteEnabled: false,
  geofenceAutoCompleteDelaySeconds: 10,
};
