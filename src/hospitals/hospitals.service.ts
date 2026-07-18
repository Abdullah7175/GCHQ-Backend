import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hospital } from './hospital.entity';
import { EmergencyType } from '../emergency-types/emergency-type.entity';
import { User } from '../users/user.entity';
import { Transit } from '../transits/transit.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { AmbulanceStatus, TransitStatus } from '../common/enums';
import { CreateHospitalDto, UpdateHospitalDto } from './dto/hospital.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class HospitalsService extends BaseCrudService<Hospital> {
  constructor(
    @InjectRepository(Hospital) private readonly hospitalRepo: Repository<Hospital>,
    @InjectRepository(EmergencyType) private readonly emergencyTypeRepo: Repository<EmergencyType>,
  ) {
    super(hospitalRepo);
  }

  private readonly relations = { sector: true, city: true, emergencyTypes: true } as never;

  findByCity(cityId?: string, page?: number, limit?: number) {
    return super.findAll(
      {
        where: cityId ? { cityId } : {},
        relations: this.relations,
        order: { name: 'ASC' },
      },
      page,
      limit
    );
  }

  findOne(id: string) {
    return super.findOne(id, this.relations);
  }

  async findSuitable(
    cityId: string,
    emergencyTypeId: string,
    latitude?: number,
    longitude?: number,
  ) {
    const hospitals = await this.hospitalRepo
      .createQueryBuilder('hospital')
      .leftJoinAndSelect('hospital.emergencyTypes', 'emergencyType')
      .leftJoinAndSelect('hospital.sector', 'sector')
      .where('hospital.cityId = :cityId', { cityId })
      .orderBy('hospital.name', 'ASC')
      .getMany();

    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
    const choices = hospitals
      .map((hospital) => {
        const catersSelectedEmergency = hospital.emergencyTypes.some(
          (type) => type.id === emergencyTypeId,
        );
        return {
          id: hospital.id,
          name: hospital.name,
          address: hospital.address,
          latitude: Number(hospital.latitude),
          longitude: Number(hospital.longitude),
          sectorId: hospital.sectorId,
          sector: hospital.sector,
          emergencyTypes: hospital.emergencyTypes,
          catersSelectedEmergency,
          distanceKm: hasLocation
            ? this.distanceKm(
                latitude as number,
                longitude as number,
                Number(hospital.latitude),
                Number(hospital.longitude),
              )
            : null,
        };
      })
      .sort((a, b) => {
        if (a.distanceKm == null || b.distanceKm == null) {
          return a.name.localeCompare(b.name);
        }
        return a.distanceKm - b.distanceKm;
      });

    const recommended =
      choices.find((hospital) => hospital.catersSelectedEmergency) ??
      choices[0];

    return {
      emergencyTypeId,
      cityId,
      recommendedHospitalId: recommended?.id ?? null,
      selectionReason: hasLocation
        ? recommended?.catersSelectedEmergency
          ? 'Nearest hospital that caters the selected emergency type'
          : 'Nearest hospital; no hospital is configured for the selected emergency type'
        : 'First suitable hospital alphabetically; send latitude and longitude for nearest recommendation',
      patientConsentOverrideAllowed: true,
      hospitals: choices,
    };
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  }

  private async resolveEmergencyTypes(ids?: string[]): Promise<EmergencyType[] | undefined> {
    if (ids === undefined) return undefined;
    if (!ids.length) return [];
    return this.emergencyTypeRepo.findBy({ id: In(ids) });
  }

  async create(dto: CreateHospitalDto) {
    const { emergencyTypeIds, ...rest } = dto;
    const hospital = this.hospitalRepo.create(rest as Partial<Hospital>);
    const types = await this.resolveEmergencyTypes(emergencyTypeIds);
    if (types !== undefined) hospital.emergencyTypes = types;
    const saved = await this.hospitalRepo.save(hospital);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateHospitalDto) {
    const { emergencyTypeIds, ...rest } = dto;
    if (Object.keys(rest).length) {
      await super.update(id, rest as Partial<Hospital>);
    }
    const types = await this.resolveEmergencyTypes(emergencyTypeIds);
    if (types !== undefined) {
      const hospital = await this.hospitalRepo.findOneOrFail({ where: { id }, relations: { emergencyTypes: true } });
      hospital.emergencyTypes = types;
      await this.hospitalRepo.save(hospital);
    }
    return this.findOne(id);
  }

  /**
   * Safe delete: unassign hospital users, remove only ACTIVE cases (+ GPS),
   * preserve completed/cancelled history by detaching hospital_id, then delete.
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.hospitalRepo.manager.transaction(async (em) => {
      await em.update(User, { hospitalId: id }, { hospitalId: null });

      const active = await em.find(Transit, {
        where: {
          hospitalId: id,
          status: In([
            TransitStatus.PENDING,
            TransitStatus.EN_ROUTE,
            TransitStatus.ARRIVED,
          ]),
        },
        select: { id: true, ambulanceId: true },
      });

      if (active.length > 0) {
        const transitIds = active.map((t) => t.id);
        const ambulanceIds = [...new Set(active.map((t) => t.ambulanceId).filter(Boolean))] as string[];
        await em.query(`DELETE FROM gps_locations WHERE transit_id = ANY($1::uuid[])`, [transitIds]);
        await em.delete(Transit, { id: In(transitIds) });
        if (ambulanceIds.length) {
          await em.update(
            Ambulance,
            { id: In(ambulanceIds) },
            { status: AmbulanceStatus.AVAILABLE, currentSpeed: 0 },
          );
        }
      }

      // Keep completed/cancelled cases — detach from this hospital
      await em.update(Transit, { hospitalId: id }, { hospitalId: null });
      await em.query(`DELETE FROM hospital_emergency_types WHERE hospital_id = $1`, [id]);
      await em.delete(Hospital, { id });
    });
  }
}
