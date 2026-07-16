import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { City } from '../cities/city.entity';
import { DEFAULT_CITY_CONFIG } from '../cities/city-operational-config';
import { Provider } from '../providers/provider.entity';
import { Sector } from '../sectors/sector.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { TriageCode } from '../triage-codes/triage-code.entity';
import { User } from '../users/user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import {
  UserRole,
  ProviderShape,
  AmbulanceStatus,
  TransitStatus,
  PrepStatus,
  SectorGridStatus,
} from '../common/enums';

interface DemoTransitSpec {
  transitId: string;
  ambulanceIndex: number;
  hospitalIndex: number;
  emergencyTypeIndex: number;
  triageIndex: number;
  sectorIndex: number;
  status: TransitStatus;
  prepStatus?: PrepStatus;
  notes: string;
  etaMinutes: number;
  baselineEtaMinutes: number;
  originLat: number;
  originLng: number;
  currentLat: number;
  currentLng: number;
  currentSpeed: number;
  startedMinutesAgo: number;
  arrivedMinutesAgo?: number;
  completedMinutesAgo?: number;
}

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    @InjectRepository(Provider) private readonly providerRepo: Repository<Provider>,
    @InjectRepository(Sector) private readonly sectorRepo: Repository<Sector>,
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(EmergencyType) private readonly emergencyTypeRepo: Repository<EmergencyType>,
    @InjectRepository(TriageCode) private readonly triageCodeRepo: Repository<TriageCode>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(Transit) private readonly transitRepo: Repository<Transit>,
  ) {}

  async onModuleInit() {
    await this.ensureCityMapCenters();
    const count = await this.userRepo.count();
    if (count > 0) return;
    await this.seed();
  }

  /** Backfill map viewport for known cities (and leave custom cities to Admin). */
  private async ensureCityMapCenters() {
    const defaults: Record<string, { lat: number; lng: number; zoom: number }> = {
      LHE: { lat: 31.5497, lng: 74.3436, zoom: 12 },
      ISB: { lat: 33.6844, lng: 73.0479, zoom: 12 },
      KHI: { lat: 24.8607, lng: 67.0011, zoom: 12 },
      RWP: { lat: 33.5651, lng: 73.0169, zoom: 12 },
      FSD: { lat: 31.4504, lng: 73.1350, zoom: 12 },
      PEW: { lat: 34.0151, lng: 71.5249, zoom: 12 },
      QTA: { lat: 30.1798, lng: 66.9750, zoom: 12 },
      MUL: { lat: 30.1575, lng: 71.5249, zoom: 12 },
    };
    const cities = await this.cityRepo.find();
    for (const city of cities) {
      const d = defaults[city.code?.toUpperCase()];
      if (!d) continue;
      if (city.mapCenterLat != null && city.mapCenterLng != null) continue;
      await this.cityRepo.update(city.id, {
        mapCenterLat: d.lat,
        mapCenterLng: d.lng,
        mapDefaultZoom: city.mapDefaultZoom || d.zoom,
      });
    }
  }

  async seed() {
    const lahore = await this.cityRepo.save({
      name: 'Lahore',
      code: 'LHE',
      province: 'Punjab',
      mapCenterLat: 31.5497,
      mapCenterLng: 74.3436,
      mapDefaultZoom: 12,
      operationalConfig: { ...DEFAULT_CITY_CONFIG, maxConcurrentTransits: 50, transitIdPrefix: 'LHE' },
    });

    const islamabad = await this.cityRepo.save({
      name: 'Islamabad',
      code: 'ISB',
      province: 'ICT',
      mapCenterLat: 33.6844,
      mapCenterLng: 73.0479,
      mapDefaultZoom: 12,
      operationalConfig: { ...DEFAULT_CITY_CONFIG, maxConcurrentTransits: 30, transitIdPrefix: 'ISB' },
    });

    const providers = await this.providerRepo.save([
      { name: 'Rescue 1122', code: '1122', shape: ProviderShape.CIRCLE, color: '#d93343' },
      { name: 'Edhi Network', code: 'EDHI', shape: ProviderShape.TRIANGLE, color: '#f59e0b' },
      { name: 'Chhipa Organization', code: 'CHIPPA', shape: ProviderShape.SQUARE, color: '#2563eb' },
      { name: 'Al-Khidmat Foundation', code: 'ALKHIDMAT', shape: ProviderShape.DIAMOND, color: '#16a34a' },
    ]);

    const sectors = await this.sectorRepo.save([
      { name: 'Mall Road', code: 'A', cityId: lahore.id, color: '#0056b3', gridStatus: SectorGridStatus.SATURATING, latitude: 31.5497, longitude: 74.3436, overrideActive: true },
      { name: 'Jail Road', code: 'B', cityId: lahore.id, color: '#16a34a', gridStatus: SectorGridStatus.FLOWING, latitude: 31.5204, longitude: 74.3587 },
      { name: 'Canal Bank', code: 'C', cityId: lahore.id, color: '#d93343', gridStatus: SectorGridStatus.GRIDLOCKED, latitude: 31.4700, longitude: 74.3200 },
      { name: 'Main Boulevard', code: 'D', cityId: lahore.id, color: '#f59e0b', gridStatus: SectorGridStatus.MODERATE, latitude: 31.5100, longitude: 74.3400 },
      { name: 'Shahdara', code: 'E', cityId: lahore.id, color: '#705575', gridStatus: SectorGridStatus.MODERATE, latitude: 31.5900, longitude: 74.2900 },
      { name: 'Model Town', code: 'F', cityId: lahore.id, color: '#00663c', gridStatus: SectorGridStatus.FLOWING, latitude: 31.4800, longitude: 74.3200 },
      { name: 'Blue Area', code: 'A', cityId: islamabad.id, color: '#0056b3', gridStatus: SectorGridStatus.MODERATE, latitude: 33.7077, longitude: 73.0650 },
      { name: 'F-10 Sector', code: 'B', cityId: islamabad.id, color: '#16a34a', gridStatus: SectorGridStatus.FLOWING, latitude: 33.6910, longitude: 73.0190 },
    ]);

    const hospitals = await this.hospitalRepo.save([
      { name: 'Mayo Hospital', cityId: lahore.id, address: 'Hospital Road, Anarkali, Lahore', latitude: 31.5704500, longitude: 74.3089200, sectorId: sectors[0].id, specialties: ['Neurosurgery', 'Advanced Trauma', 'Cardiac Suspected', 'Pediatrics'] },
      { name: 'Jinnah Hospital', cityId: lahore.id, address: 'Usmani Gate Rd, Lahore', latitude: 31.4847200, longitude: 74.3015800, sectorId: sectors[2].id, specialties: ['Advanced Trauma', 'Burn Care', 'Orthopedics'] },
      { name: 'Services Hospital', cityId: lahore.id, address: 'Jail Road, Lahore', latitude: 31.5389100, longitude: 74.3336400, sectorId: sectors[1].id, specialties: ['Neurosurgery', 'Cardiac Suspected', 'Obstetrics'] },
      { name: 'General Hospital', cityId: lahore.id, address: 'Ferozepur Road, Lahore', latitude: 31.4912500, longitude: 74.3168800, sectorId: sectors[3].id, specialties: ['Cardiac Suspected', 'Obstetrics', 'Pediatrics'] },
      { name: 'Shifa International', cityId: islamabad.id, address: 'H-8/4, Islamabad', latitude: 33.6630500, longitude: 73.0652100, sectorId: sectors[6].id, specialties: ['Neurosurgery', 'Cardiac Suspected'] },
      { name: 'PIMS Hospital', cityId: islamabad.id, address: 'G-8/3, Islamabad', latitude: 33.6951200, longitude: 73.0550400, sectorId: sectors[7].id, specialties: ['Advanced Trauma', 'Neurosurgery'] },
    ]);


    const emergencyTypes = await this.emergencyTypeRepo.save([
      { name: 'Trauma/Cardiac', code: 'TRAUMA', severityLevel: 1 },
      { name: 'Myocardial Infarction', code: 'MI', severityLevel: 1 },
      { name: 'Burns', code: 'BURNS', severityLevel: 1 },
      { name: 'Respiratory Distress', code: 'RESP', severityLevel: 2 },
      { name: 'Obstetric Emergency', code: 'OBST', severityLevel: 2 },
      { name: 'Stroke', code: 'STROKE', severityLevel: 1 },
      { name: 'Minor Orthopedic', code: 'ORTHO', severityLevel: 3 },
      { name: 'Poisoning', code: 'POISON', severityLevel: 2 },
    ]);

    const triageCodes = await this.triageCodeRepo.save([
      { name: 'Code Red', code: 'RED', color: '#ba1a1a', priority: 1 },
      { name: 'Code Amber', code: 'AMBER', color: '#f59e0b', priority: 2 },
      { name: 'Code Green', code: 'GREEN', color: '#16a34a', priority: 3 },
    ]);

    const md5Hash = crypto.createHash('md5').update('password123').digest('hex');
    const password = await bcrypt.hash(md5Hash, 10);

    const users: User[] = await this.userRepo.save([
      { email: 'admin@gchq.pk', password, name: 'System Admin', role: UserRole.ADMIN, apiKey: 'key_admin_secret' },
      { email: 'hospital@services.pk', password, name: 'Services ER Lead', role: UserRole.HOSPITAL, cityId: lahore.id, hospitalId: hospitals[2].id, apiKey: 'key_hospital_services' },
      { email: 'hospital@mayo.pk', password, name: 'Mayo ER Lead', role: UserRole.HOSPITAL, cityId: lahore.id, hospitalId: hospitals[0].id },
      { email: 'hospital@jinnah.pk', password, name: 'Jinnah ER Lead', role: UserRole.HOSPITAL, cityId: lahore.id, hospitalId: hospitals[1].id },
      { email: 'safecity@psca.pk', password, name: 'Traffic Controller', role: UserRole.SAFE_CITY, cityId: lahore.id, apiKey: 'key_safecity_controller' },
      { email: 'hq@1122.pk', password, name: 'City HQ Overseer', role: UserRole.HQ_1122, cityId: lahore.id, isCityOverseer: true, apiKey: 'key_hq_overseer' },
      { email: 'vvip@gov.pk', password, name: 'VVIP Command', role: UserRole.VVIP },
      { email: 'driver@1122.pk', password, name: 'Paramedic Ali', role: UserRole.PARAMEDIC, cityId: lahore.id, providerId: providers[0].id, apiKey: 'key_paramedic_ali' },
      { email: 'driver2@1122.pk', password, name: 'Paramedic Sara', role: UserRole.PARAMEDIC, cityId: lahore.id, providerId: providers[1].id },
    ]);

    const ambulances = await this.ambulanceRepo.save([
      { unitNumber: 'RESCUE-782', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5450, currentLng: 74.3350, currentSpeed: 0, driverId: users[7].id },
      { unitNumber: 'RESCUE-104', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5850, currentLng: 74.2950, currentSpeed: 0 },
      { unitNumber: 'RESCUE-429', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5480, currentLng: 74.3400, currentSpeed: 0 },
      { unitNumber: 'RESCUE-312', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.4780, currentLng: 74.3180, currentSpeed: 0 },
      { unitNumber: 'RESCUE-518', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5620, currentLng: 74.3250, currentSpeed: 0 },
      { unitNumber: 'RESCUE-633', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5150, currentLng: 74.3550, currentSpeed: 0 },
      { unitNumber: 'RESCUE-901', cityId: lahore.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5300, currentLng: 74.3450, currentSpeed: 0 },
      { unitNumber: 'EDHI-45', cityId: lahore.id, providerId: providers[1].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5200, currentLng: 74.3500, currentSpeed: 0, driverId: users[8].id },
      { unitNumber: 'EDHI-12', cityId: lahore.id, providerId: providers[1].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5750, currentLng: 74.3100, currentSpeed: 0 },
      { unitNumber: 'CHIPPA-22', cityId: lahore.id, providerId: providers[2].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5000, currentLng: 74.3300, currentSpeed: 0 },
      { unitNumber: 'CHIPPA-07', cityId: lahore.id, providerId: providers[2].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.4920, currentLng: 74.3150, currentSpeed: 0 },
      { unitNumber: 'ALKHIDMAT-08', cityId: lahore.id, providerId: providers[3].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5600, currentLng: 74.3100, currentSpeed: 0 },
      { unitNumber: 'ALKHIDMAT-19', cityId: lahore.id, providerId: providers[3].id, status: AmbulanceStatus.AVAILABLE, currentLat: 31.5380, currentLng: 74.3380, currentSpeed: 0 },
      { unitNumber: 'RESCUE-ISB-01', cityId: islamabad.id, providerId: providers[0].id, status: AmbulanceStatus.AVAILABLE, currentLat: 33.7000, currentLng: 73.0600, currentSpeed: 0 },
      { unitNumber: 'EDHI-ISB-03', cityId: islamabad.id, providerId: providers[1].id, status: AmbulanceStatus.AVAILABLE, currentLat: 33.6900, currentLng: 73.0500, currentSpeed: 0 },
    ]);

    await this.insertDemoTransits(lahore.id, hospitals.slice(0, 4), sectors.slice(0, 6), emergencyTypes, triageCodes, ambulances.slice(0, 13));

    console.log('Database seeded successfully');
    console.log('Login: admin@gchq.pk / password123');
  }

  async refreshDemoData(cityCode = 'LHE') {
    const city = await this.cityRepo.findOne({ where: { code: cityCode } });
    if (!city) {
      const userCount = await this.userRepo.count();
      if (userCount === 0) {
        await this.seed();
        return { message: 'Full database seed completed', cityCode, transits: 0 };
      }
      throw new Error(`City ${cityCode} not found. Create it in Admin first.`);
    }

    const hospitals = await this.hospitalRepo.find({ where: { cityId: city.id }, order: { name: 'ASC' } });
    const sectors = await this.sectorRepo.find({ where: { cityId: city.id }, order: { name: 'ASC' } });
    const emergencyTypes = await this.emergencyTypeRepo.find({ order: { severityLevel: 'ASC' } });
    const triageCodes = await this.triageCodeRepo.find({ order: { priority: 'ASC' } });
    let ambulances = await this.ambulanceRepo.find({ where: { cityId: city.id }, order: { unitNumber: 'ASC' } });

    await this.transitRepo.delete({ cityId: city.id });
    await this.ambulanceRepo.update(
      { cityId: city.id },
      { status: AmbulanceStatus.AVAILABLE, currentSpeed: 0 },
    );

    if (ambulances.length < 10) {
      const providers = await this.providerRepo.find();
      const extra = await this.ensureAmbulances(city.id, providers, ambulances.length);
      ambulances = [...ambulances, ...extra];
    }

    await this.ensureHqDemoUsers(city.id, sectors);
    await this.syncHospitalCoordinates(city.id);

    const hospitalsFresh = await this.hospitalRepo.find({ where: { cityId: city.id }, order: { name: 'ASC' } });
    const count = await this.insertDemoTransits(city.id, hospitalsFresh, sectors, emergencyTypes, triageCodes, ambulances);

    return {
      message: `Demo data refreshed for ${city.name}`,
      cityCode,
      transits: count,
      hospitals: hospitalsFresh.length,
      ambulances: ambulances.length,
    };
  }

  /** Keep ER GPS up to date for driver shortest-path routing */
  private async syncHospitalCoordinates(cityId: string) {
    const coords: Record<string, { latitude: number; longitude: number; address?: string }> = {
      Mayo: { latitude: 31.57045, longitude: 74.30892, address: 'Hospital Road, Anarkali, Lahore' },
      Jinnah: { latitude: 31.48472, longitude: 74.30158, address: 'Usmani Gate Rd, Lahore' },
      Services: { latitude: 31.53891, longitude: 74.33364, address: 'Jail Road, Lahore' },
      General: { latitude: 31.49125, longitude: 74.31688, address: 'Ferozepur Road, Lahore' },
      Shifa: { latitude: 33.66305, longitude: 73.06521 },
      PIMS: { latitude: 33.69512, longitude: 73.05504 },
    };

    const list = await this.hospitalRepo.find({ where: { cityId } });
    for (const h of list) {
      const key = Object.keys(coords).find((k) => h.name.includes(k));
      if (!key) continue;
      const c = coords[key];
      await this.hospitalRepo.update(h.id, {
        latitude: c.latitude,
        longitude: c.longitude,
        ...(c.address ? { address: c.address } : {}),
      });
    }
  }

  private async ensureHqDemoUsers(cityId: string, sectors: Sector[]) {
    const md5Hash = crypto.createHash('md5').update('password123').digest('hex');
    const password = await bcrypt.hash(md5Hash, 10);
    const overseer = await this.userRepo.findOne({ where: { email: 'hq@1122.pk' } });
    if (overseer) {
      await this.userRepo.update(overseer.id, { isCityOverseer: true, cityId, sectorId: null });
    }
    if (sectors[0]) {
      const existing = await this.userRepo.findOne({ where: { email: 'csr.mall@1122.pk' } });
      if (!existing) {
        await this.userRepo.save({
          email: 'csr.mall@1122.pk',
          password,
          name: 'CSR Mall Road',
          role: UserRole.HQ_1122,
          cityId,
          sectorId: sectors[0].id,
          isCityOverseer: false,
        });
      } else {
        await this.userRepo.update(existing.id, { sectorId: sectors[0].id, cityId, isCityOverseer: false });
      }
    }
    if (sectors[1]) {
      const existing = await this.userRepo.findOne({ where: { email: 'csr.jail@1122.pk' } });
      if (!existing) {
        await this.userRepo.save({
          email: 'csr.jail@1122.pk',
          password,
          name: 'CSR Jail Road',
          role: UserRole.HQ_1122,
          cityId,
          sectorId: sectors[1].id,
          isCityOverseer: false,
        });
      } else {
        await this.userRepo.update(existing.id, { sectorId: sectors[1].id, cityId, isCityOverseer: false });
      }
    }
  }

  private async ensureAmbulances(cityId: string, providers: Provider[], existingCount: number) {
    const templates = [
      { unitNumber: 'RESCUE-518', providerIndex: 0, lat: 31.5620, lng: 74.3250 },
      { unitNumber: 'RESCUE-633', providerIndex: 0, lat: 31.5150, lng: 74.3550 },
      { unitNumber: 'EDHI-12', providerIndex: 1, lat: 31.5750, lng: 74.3100 },
      { unitNumber: 'CHIPPA-07', providerIndex: 2, lat: 31.4920, lng: 74.3150 },
      { unitNumber: 'ALKHIDMAT-19', providerIndex: 3, lat: 31.5380, lng: 74.3380 },
    ];

    const needed = Math.max(0, 10 - existingCount);
    if (needed === 0) return [];

    const existing = await this.ambulanceRepo.find({ where: { cityId } });
    const existingUnits = new Set(existing.map((a) => a.unitNumber));

    const toCreate = templates
      .filter((t) => !existingUnits.has(t.unitNumber))
      .slice(0, needed)
      .map((t) => ({
        unitNumber: t.unitNumber,
        cityId,
        providerId: providers[t.providerIndex]?.id ?? providers[0].id,
        status: AmbulanceStatus.AVAILABLE,
        currentLat: t.lat,
        currentLng: t.lng,
        currentSpeed: 0,
      }));

    if (toCreate.length === 0) return [];
    return this.ambulanceRepo.save(toCreate);
  }

  private demoTransitSpecs(): DemoTransitSpec[] {
    return [
      // En route — Services Hospital
      { transitId: 'LHE-0001', ambulanceIndex: 0, hospitalIndex: 2, emergencyTypeIndex: 0, triageIndex: 0, sectorIndex: 0, status: TransitStatus.EN_ROUTE, notes: '34y Male, high velocity impact. BP 80/50, tachycardia. IV started, O2 15L.', etaMinutes: 2.75, baselineEtaMinutes: 8, originLat: 31.5600, originLng: 74.3200, currentLat: 31.5450, currentLng: 74.3350, currentSpeed: 45, startedMinutesAgo: 5 },
      { transitId: 'LHE-0002', ambulanceIndex: 1, hospitalIndex: 2, emergencyTypeIndex: 3, triageIndex: 1, sectorIndex: 4, status: TransitStatus.EN_ROUTE, notes: 'Elderly female, COPD exacerbation. Nebulizer active. Stabilizing.', etaMinutes: 5.2, baselineEtaMinutes: 12, originLat: 31.5900, originLng: 74.2900, currentLat: 31.5850, currentLng: 74.2950, currentSpeed: 38, startedMinutesAgo: 7 },
      { transitId: 'LHE-0003', ambulanceIndex: 2, hospitalIndex: 2, emergencyTypeIndex: 4, triageIndex: 1, sectorIndex: 0, status: TransitStatus.EN_ROUTE, notes: 'Active labor, 3 min contractions. G2P1. All vitals normal.', etaMinutes: 8.5, baselineEtaMinutes: 15, originLat: 31.5550, originLng: 74.3450, currentLat: 31.5480, currentLng: 74.3400, currentSpeed: 42, startedMinutesAgo: 6 },
      // En route — Mayo Hospital
      { transitId: 'LHE-0004', ambulanceIndex: 3, hospitalIndex: 0, emergencyTypeIndex: 1, triageIndex: 0, sectorIndex: 0, status: TransitStatus.EN_ROUTE, notes: 'STEMI suspected. Aspirin given. Chest pain 8/10. Monitor attached.', etaMinutes: 3.1, baselineEtaMinutes: 10, originLat: 31.5700, originLng: 74.3150, currentLat: 31.5650, currentLng: 74.3220, currentSpeed: 52, startedMinutesAgo: 4 },
      { transitId: 'LHE-0005', ambulanceIndex: 4, hospitalIndex: 0, emergencyTypeIndex: 5, triageIndex: 0, sectorIndex: 4, status: TransitStatus.EN_ROUTE, notes: 'Suspected stroke, FAST positive. Last known well 45 min ago.', etaMinutes: 6.8, baselineEtaMinutes: 14, originLat: 31.5950, originLng: 74.2850, currentLat: 31.5880, currentLng: 74.2920, currentSpeed: 6, startedMinutesAgo: 9 },
      { transitId: 'LHE-0006', ambulanceIndex: 5, hospitalIndex: 0, emergencyTypeIndex: 2, triageIndex: 0, sectorIndex: 3, status: TransitStatus.EN_ROUTE, notes: 'Kitchen fire burns 18% TBSA. Cooling measures applied.', etaMinutes: 11.0, baselineEtaMinutes: 18, originLat: 31.5050, originLng: 74.3500, currentLat: 31.5120, currentLng: 74.3420, currentSpeed: 40, startedMinutesAgo: 8 },
      // En route — Jinnah Hospital
      { transitId: 'LHE-0007', ambulanceIndex: 6, hospitalIndex: 1, emergencyTypeIndex: 7, triageIndex: 1, sectorIndex: 2, status: TransitStatus.EN_ROUTE, notes: 'Organophosphate ingestion. Atropine started per protocol.', etaMinutes: 4.5, baselineEtaMinutes: 11, originLat: 31.4650, originLng: 74.3050, currentLat: 31.4680, currentLng: 74.3080, currentSpeed: 48, startedMinutesAgo: 5 },
      { transitId: 'LHE-0008', ambulanceIndex: 7, hospitalIndex: 1, emergencyTypeIndex: 0, triageIndex: 0, sectorIndex: 2, status: TransitStatus.EN_ROUTE, notes: 'RTA motorcycle vs car. Head injury, GCS 13. C-spine immobilized.', etaMinutes: 7.2, baselineEtaMinutes: 13, originLat: 31.4550, originLng: 74.2980, currentLat: 31.4600, currentLng: 74.3010, currentSpeed: 35, startedMinutesAgo: 6 },
      // En route — General Hospital
      { transitId: 'LHE-0009', ambulanceIndex: 8, hospitalIndex: 3, emergencyTypeIndex: 6, triageIndex: 2, sectorIndex: 5, status: TransitStatus.EN_ROUTE, notes: 'Possible radius fracture. Splint applied. Patient stable.', etaMinutes: 14.2, baselineEtaMinutes: 20, originLat: 31.4700, originLng: 74.3100, currentLat: 31.4780, currentLng: 74.3180, currentSpeed: 35, startedMinutesAgo: 5 },
      { transitId: 'LHE-0010', ambulanceIndex: 9, hospitalIndex: 3, emergencyTypeIndex: 3, triageIndex: 1, sectorIndex: 3, status: TransitStatus.EN_ROUTE, notes: 'Pediatric asthma attack. Salbutamol nebulization ongoing.', etaMinutes: 9.0, baselineEtaMinutes: 16, originLat: 31.5000, originLng: 74.3350, currentLat: 31.5030, currentLng: 74.3320, currentSpeed: 44, startedMinutesAgo: 7 },
      { transitId: 'LHE-0011', ambulanceIndex: 10, hospitalIndex: 3, emergencyTypeIndex: 4, triageIndex: 1, sectorIndex: 1, status: TransitStatus.EN_ROUTE, notes: 'Pre-eclampsia, BP 160/110. Magnesium sulfate initiated.', etaMinutes: 5.5, baselineEtaMinutes: 12, originLat: 31.5250, originLng: 74.3600, currentLat: 31.5180, currentLng: 74.3520, currentSpeed: 50, startedMinutesAgo: 4 },
      { transitId: 'LHE-0012', ambulanceIndex: 11, hospitalIndex: 1, emergencyTypeIndex: 1, triageIndex: 0, sectorIndex: 5, status: TransitStatus.EN_ROUTE, notes: 'Cardiac arrest ROSC. Post-arrest care, ventilating.', etaMinutes: 2.0, baselineEtaMinutes: 7, originLat: 31.4850, originLng: 74.3250, currentLat: 31.4720, currentLng: 74.3060, currentSpeed: 58, startedMinutesAgo: 3 },
      // Arrived — hospital incoming queue
      { transitId: 'LHE-0013', ambulanceIndex: 12, hospitalIndex: 0, emergencyTypeIndex: 0, triageIndex: 0, sectorIndex: 0, status: TransitStatus.ARRIVED, prepStatus: PrepStatus.PENDING, notes: 'Multi-trauma from construction fall. Pelvic binder applied.', etaMinutes: 0.5, baselineEtaMinutes: 9, originLat: 31.5750, originLng: 74.3280, currentLat: 31.5810, currentLng: 74.3295, currentSpeed: 0, startedMinutesAgo: 12, arrivedMinutesAgo: 1 },
      { transitId: 'LHE-0014', ambulanceIndex: 0, hospitalIndex: 2, emergencyTypeIndex: 5, triageIndex: 0, sectorIndex: 1, status: TransitStatus.ARRIVED, prepStatus: PrepStatus.READY, notes: 'Acute stroke, tPA candidate. NIHSS 14.', etaMinutes: 0, baselineEtaMinutes: 11, originLat: 31.5400, originLng: 74.3500, currentLat: 31.5325, currentLng: 74.3415, currentSpeed: 0, startedMinutesAgo: 15, arrivedMinutesAgo: 2 },
      { transitId: 'LHE-0015', ambulanceIndex: 1, hospitalIndex: 1, emergencyTypeIndex: 2, triageIndex: 0, sectorIndex: 2, status: TransitStatus.ARRIVED, prepStatus: PrepStatus.PENDING, notes: 'Electrical burn both hands. IV fluids running.', etaMinutes: 0, baselineEtaMinutes: 14, originLat: 31.4680, originLng: 74.3000, currentLat: 31.4708, currentLng: 74.3048, currentSpeed: 0, startedMinutesAgo: 18, arrivedMinutesAgo: 3 },
      // Pending — HQ queue
      { transitId: 'LHE-0016', ambulanceIndex: 2, hospitalIndex: 3, emergencyTypeIndex: 6, triageIndex: 2, sectorIndex: 4, status: TransitStatus.PENDING, notes: 'Dispatched — ankle sprain, awaiting unit departure.', etaMinutes: 18.0, baselineEtaMinutes: 22, originLat: 31.5880, originLng: 74.2880, currentLat: 31.5880, currentLng: 74.2880, currentSpeed: 0, startedMinutesAgo: 0 },
      { transitId: 'LHE-0017', ambulanceIndex: 3, hospitalIndex: 0, emergencyTypeIndex: 3, triageIndex: 1, sectorIndex: 0, status: TransitStatus.PENDING, notes: 'Call received — respiratory distress, unit prepping.', etaMinutes: 15.0, baselineEtaMinutes: 20, originLat: 31.5500, originLng: 74.3400, currentLat: 31.5500, currentLng: 74.3400, currentSpeed: 0, startedMinutesAgo: 0 },
      // Completed today — stats & emergency breakdown
      { transitId: 'LHE-0091', ambulanceIndex: 4, hospitalIndex: 0, emergencyTypeIndex: 1, triageIndex: 0, sectorIndex: 0, status: TransitStatus.COMPLETED, notes: 'STEMI patient, thrombolysis initiated.', etaMinutes: 0, baselineEtaMinutes: 18, originLat: 31.5600, originLng: 74.3200, currentLat: 31.5820, currentLng: 74.3290, currentSpeed: 0, startedMinutesAgo: 120, completedMinutesAgo: 95 },
      { transitId: 'LHE-0092', ambulanceIndex: 5, hospitalIndex: 2, emergencyTypeIndex: 0, triageIndex: 0, sectorIndex: 1, status: TransitStatus.COMPLETED, notes: 'Road traffic accident, discharged to trauma bay.', etaMinutes: 0, baselineEtaMinutes: 15, originLat: 31.5200, originLng: 74.3550, currentLat: 31.5330, currentLng: 74.3420, currentSpeed: 0, startedMinutesAgo: 200, completedMinutesAgo: 175 },
      { transitId: 'LHE-0093', ambulanceIndex: 6, hospitalIndex: 1, emergencyTypeIndex: 3, triageIndex: 1, sectorIndex: 2, status: TransitStatus.COMPLETED, notes: 'COPD resolved with nebulizer. Admitted to ward.', etaMinutes: 0, baselineEtaMinutes: 12, originLat: 31.4600, originLng: 74.3100, currentLat: 31.4705, currentLng: 74.3045, currentSpeed: 0, startedMinutesAgo: 180, completedMinutesAgo: 160 },
      { transitId: 'LHE-0094', ambulanceIndex: 7, hospitalIndex: 3, emergencyTypeIndex: 6, triageIndex: 2, sectorIndex: 3, status: TransitStatus.COMPLETED, notes: 'Wrist fracture splinted. Outpatient follow-up.', etaMinutes: 0, baselineEtaMinutes: 20, originLat: 31.5100, originLng: 74.3300, currentLat: 31.5050, currentLng: 74.3280, currentSpeed: 0, startedMinutesAgo: 150, completedMinutesAgo: 130 },
      { transitId: 'LHE-0095', ambulanceIndex: 8, hospitalIndex: 0, emergencyTypeIndex: 5, triageIndex: 0, sectorIndex: 4, status: TransitStatus.COMPLETED, notes: 'Stroke — thrombectomy completed.', etaMinutes: 0, baselineEtaMinutes: 16, originLat: 31.5900, originLng: 74.2900, currentLat: 31.5820, currentLng: 74.3290, currentSpeed: 0, startedMinutesAgo: 90, completedMinutesAgo: 70 },
      { transitId: 'LHE-0096', ambulanceIndex: 9, hospitalIndex: 2, emergencyTypeIndex: 4, triageIndex: 1, sectorIndex: 0, status: TransitStatus.COMPLETED, notes: 'Normal delivery en route, diverted to maternity.', etaMinutes: 0, baselineEtaMinutes: 14, originLat: 31.5550, originLng: 74.3450, currentLat: 31.5330, currentLng: 74.3420, currentSpeed: 0, startedMinutesAgo: 240, completedMinutesAgo: 210 },
      { transitId: 'LHE-0097', ambulanceIndex: 10, hospitalIndex: 1, emergencyTypeIndex: 2, triageIndex: 0, sectorIndex: 2, status: TransitStatus.COMPLETED, notes: 'Thermal burns 12% — admitted to burn unit.', etaMinutes: 0, baselineEtaMinutes: 17, originLat: 31.4650, originLng: 74.2980, currentLat: 31.4705, currentLng: 74.3045, currentSpeed: 0, startedMinutesAgo: 300, completedMinutesAgo: 275 },
      { transitId: 'LHE-0098', ambulanceIndex: 11, hospitalIndex: 3, emergencyTypeIndex: 7, triageIndex: 1, sectorIndex: 5, status: TransitStatus.COMPLETED, notes: 'Drug overdose — Naloxone administered.', etaMinutes: 0, baselineEtaMinutes: 13, originLat: 31.4800, originLng: 74.3200, currentLat: 31.5050, currentLng: 74.3280, currentSpeed: 0, startedMinutesAgo: 60, completedMinutesAgo: 45 },
      { transitId: 'LHE-0099', ambulanceIndex: 0, hospitalIndex: 2, emergencyTypeIndex: 0, triageIndex: 0, sectorIndex: 1, status: TransitStatus.COMPLETED, notes: 'GSW to abdomen — emergency surgery.', etaMinutes: 0, baselineEtaMinutes: 10, originLat: 31.5250, originLng: 74.3580, currentLat: 31.5330, currentLng: 74.3420, currentSpeed: 0, startedMinutesAgo: 45, completedMinutesAgo: 30 },
      { transitId: 'LHE-0100', ambulanceIndex: 1, hospitalIndex: 0, emergencyTypeIndex: 1, triageIndex: 0, sectorIndex: 0, status: TransitStatus.COMPLETED, notes: 'NSTEMI — cardiac cath lab activated.', etaMinutes: 0, baselineEtaMinutes: 19, originLat: 31.5480, originLng: 74.3380, currentLat: 31.5820, currentLng: 74.3290, currentSpeed: 0, startedMinutesAgo: 30, completedMinutesAgo: 15 },
    ];
  }

  private async insertDemoTransits(
    cityId: string,
    hospitals: Hospital[],
    sectors: Sector[],
    emergencyTypes: EmergencyType[],
    triageCodes: TriageCode[],
    ambulances: Ambulance[],
  ): Promise<number> {
    const now = new Date();
    const specs = this.demoTransitSpecs();
    const prefix = cityId ? (await this.cityRepo.findOne({ where: { id: cityId } }))?.operationalConfig?.transitIdPrefix ?? 'LHE' : 'LHE';

    const records = specs.map((spec) => {
      const ambulance = ambulances[spec.ambulanceIndex % ambulances.length];
      const hospital = hospitals[spec.hospitalIndex % hospitals.length];
      const sector = sectors[spec.sectorIndex % sectors.length];
      const transitId = spec.transitId.replace(/^LHE/, prefix);

      const startedAt = new Date(now.getTime() - spec.startedMinutesAgo * 60000);
      const arrivedAt = spec.arrivedMinutesAgo != null
        ? new Date(now.getTime() - spec.arrivedMinutesAgo * 60000)
        : null;
      const completedAt = spec.completedMinutesAgo != null
        ? new Date(now.getTime() - spec.completedMinutesAgo * 60000)
        : null;

      return {
        transitId,
        cityId,
        ambulanceId: ambulance.id,
        hospitalId: hospital.id,
        emergencyTypeId: emergencyTypes[spec.emergencyTypeIndex % emergencyTypes.length].id,
        triageCodeId: triageCodes[spec.triageIndex % triageCodes.length].id,
        sectorId: sector?.id ?? null,
        status: spec.status,
        prepStatus: spec.prepStatus ?? PrepStatus.PENDING,
        paramedicNotes: spec.notes,
        etaMinutes: spec.etaMinutes,
        baselineEtaMinutes: spec.baselineEtaMinutes,
        originLat: spec.originLat,
        originLng: spec.originLng,
        currentLat: spec.currentLat,
        currentLng: spec.currentLng,
        currentSpeed: spec.currentSpeed,
        startedAt: spec.status !== TransitStatus.PENDING ? startedAt : null,
        arrivedAt,
        completedAt,
      };
    });

    await this.transitRepo.save(records);

    const statusPriority: Record<string, number> = {
      [TransitStatus.EN_ROUTE]: 3,
      [TransitStatus.ARRIVED]: 2,
      [TransitStatus.PENDING]: 1,
    };

    const ambulanceUpdates = new Map<string, {
      priority: number;
      status: AmbulanceStatus;
      currentLat: number;
      currentLng: number;
      currentSpeed: number;
    }>();

    for (const spec of specs) {
      if (![TransitStatus.EN_ROUTE, TransitStatus.ARRIVED, TransitStatus.PENDING].includes(spec.status)) {
        continue;
      }
      const ambulance = ambulances[spec.ambulanceIndex % ambulances.length];
      const priority = statusPriority[spec.status] ?? 0;
      const existing = ambulanceUpdates.get(ambulance.id);
      if (existing && existing.priority >= priority) continue;

      const status = spec.status === TransitStatus.PENDING
        ? AmbulanceStatus.AVAILABLE
        : spec.status === TransitStatus.ARRIVED
          ? AmbulanceStatus.BUSY
          : AmbulanceStatus.EN_ROUTE;

      ambulanceUpdates.set(ambulance.id, {
        priority,
        status,
        currentLat: spec.currentLat,
        currentLng: spec.currentLng,
        currentSpeed: spec.currentSpeed,
      });
    }

    for (const [ambulanceId, update] of ambulanceUpdates) {
      await this.ambulanceRepo.update(ambulanceId, {
        status: update.status,
        currentLat: update.currentLat,
        currentLng: update.currentLng,
        currentSpeed: update.currentSpeed,
      });
    }

    return records.length;
  }
}
