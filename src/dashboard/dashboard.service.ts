import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere } from 'typeorm';
import { Transit } from '../transits/transit.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Sector } from '../sectors/sector.entity';
import { City } from '../cities/city.entity';
import { TransitStatus } from '../common/enums';
import { DEFAULT_CITY_CONFIG } from '../cities/city-operational-config';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transit) private readonly transitRepo: Repository<Transit>,
    @InjectRepository(Ambulance) private readonly ambulanceRepo: Repository<Ambulance>,
    @InjectRepository(Sector) private readonly sectorRepo: Repository<Sector>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
  ) {}

  private todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return Between(start, end);
  }

  private async getCityConfig(cityId?: string) {
    if (!cityId) return DEFAULT_CITY_CONFIG;
    const city = await this.cityRepo.findOne({ where: { id: cityId } });
    return city?.operationalConfig ?? DEFAULT_CITY_CONFIG;
  }

  private transitWhere(cityId?: string): FindOptionsWhere<Transit> {
    return cityId ? { cityId } : {};
  }

  async getHospitalDashboard(hospitalId: string) {
    const incoming = await this.transitRepo.find({
      where: {
        hospitalId,
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
      },
      relations: {
        ambulance: { provider: true },
        emergencyType: true,
        triageCode: true,
        sector: true,
        city: true,
      } as never,
      order: { etaMinutes: 'ASC' },
    });

    const completedHistory = await this.transitRepo.find({
      where: {
        hospitalId,
        status: TransitStatus.COMPLETED,
      },
      relations: {
        ambulance: { provider: true },
        emergencyType: true,
        triageCode: true,
        sector: true,
        city: true,
      } as never,
      order: { completedAt: 'DESC' },
      take: 20,
    });

    const todayCompleted = await this.transitRepo.count({
      where: { hospitalId, status: TransitStatus.COMPLETED, completedAt: this.todayRange() },
    });

    const emergencyBreakdown = await this.transitRepo
      .createQueryBuilder('t')
      .leftJoin('t.emergencyType', 'et')
      .select('et.name', 'name')
      .addSelect('et.code', 'code')
      .addSelect('COUNT(*)', 'count')
      .where('t.hospital_id = :hospitalId', { hospitalId })
      .andWhere('t.created_at >= CURRENT_DATE')
      .groupBy('et.id')
      .addGroupBy('et.name')
      .addGroupBy('et.code')
      .getRawMany();

    return {
      stats: {
        totalIncoming: incoming.length,
        todayCompleted,
        staffAlertActive: incoming.some((t) => t.triageCode?.priority === 1),
      },
      incomingQueue: incoming,
      completedHistory,
      emergencyBreakdown,
    };
  }

  async getSafeCityDashboard(cityId: string, permittedProviderIds?: string[]) {
    const config = await this.getCityConfig(cityId);
    const activeTransits = await this.transitRepo.find({
      where: {
        cityId,
        status: In([TransitStatus.EN_ROUTE]),
        ...(permittedProviderIds && permittedProviderIds.length > 0 ? {
          ambulance: { providerId: In(permittedProviderIds) }
        } : {}),
      },
      relations: {
        ambulance: { provider: true },
        hospital: true,
        sector: true,
        triageCode: true,
      } as never,
      order: { createdAt: 'DESC' },
    });

    const sectors = await this.sectorRepo.find({ where: { cityId }, order: { name: 'ASC' } });
    const ambulances = await this.ambulanceRepo.find({
      where: {
        cityId,
        ...(permittedProviderIds && permittedProviderIds.length > 0 ? {
          providerId: In(permittedProviderIds)
        } : {}),
      },
      relations: { provider: true } as never,
    });

    const threshold = config.latencySpeedThresholdKmh;
    const activeCorridors = activeTransits.map((t) => {
      const transitSpeed = Number(t.currentSpeed);
      const ambulanceSpeed = Number(t.ambulance?.currentSpeed);
      const resolvedSpeed =
        Number.isFinite(transitSpeed) && transitSpeed > 0
          ? transitSpeed
          : Number.isFinite(ambulanceSpeed)
            ? ambulanceSpeed
            : 0;
      return {
        ...t,
        currentSpeed: resolvedSpeed,
        ambulance: t.ambulance
          ? {
              ...t.ambulance,
              currentSpeed: Number.isFinite(ambulanceSpeed) ? ambulanceSpeed : resolvedSpeed,
              currentLat: t.ambulance.currentLat ?? t.currentLat,
              currentLng: t.ambulance.currentLng ?? t.currentLng,
            }
          : t.ambulance,
      };
    });

    const latencyBreaches = activeCorridors.filter(
      (t) => Number(t.currentSpeed) < threshold,
    );

    return {
      cityId,
      config,
      activeCorridors,
      sectors,
      fleetPositions: ambulances,
      latencyBreaches,
      stats: {
        activeCorridorsCount: activeCorridors.length,
        fleetEnRoute: ambulances.length,
        maxConcurrent: config.maxConcurrentTransits,
      },
    };
  }

  async getHqDashboard(cityId: string, options?: { sectorId?: string | null; isCityOverseer?: boolean; permittedProviderIds?: string[] }) {
    const activeTransits = await this.transitRepo.find({
      where: {
        cityId,
        status: In([TransitStatus.PENDING, TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
        ...(options?.permittedProviderIds && options.permittedProviderIds.length > 0 ? {
          ambulance: { providerId: In(options.permittedProviderIds) }
        } : {}),
      },
      relations: {
        ambulance: { provider: true },
        hospital: true,
        emergencyType: true,
        triageCode: true,
        sector: true,
        claimedBy: true,
      } as never,
      order: { createdAt: 'DESC' },
    });

    const isOverseer = options?.isCityOverseer === true || !options?.sectorId;
    const scoped = isOverseer
      ? activeTransits
      : activeTransits.filter((t) => !t.sectorId || t.sectorId === options!.sectorId);

    const unclaimed = scoped.filter(
      (t) => t.status === TransitStatus.EN_ROUTE && !t.claimedById,
    );

    const ambulances = await this.ambulanceRepo.find({
      where: {
        cityId,
        ...(options?.permittedProviderIds && options.permittedProviderIds.length > 0 ? {
          providerId: In(options.permittedProviderIds)
        } : {}),
      },
      relations: { provider: true } as never,
    });
    const todayCompleted = await this.transitRepo.count({
      where: { cityId, status: TransitStatus.COMPLETED, createdAt: this.todayRange() },
    });

    return {
      cityId,
      sectorId: options?.sectorId ?? null,
      isCityOverseer: isOverseer,
      activeEmergencies: scoped.length,
      activeTransits: scoped,
      unclaimedCorridors: unclaimed,
      fleet: ambulances,
      todayCompleted,
      stats: {
        activeEmergencies: scoped.length,
        greenCorridors: scoped.filter((t) => t.status === TransitStatus.EN_ROUTE).length,
        unclaimed: unclaimed.length,
        todayCompleted,
      },
    };
  }

  async getVvipDashboard(cityId?: string) {
    const cities = cityId
      ? [await this.cityRepo.findOneOrFail({ where: { id: cityId } })]
      : await this.cityRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });

    const citySummaries = await Promise.all(
      cities.map(async (city) => {
        const config = city.operationalConfig ?? DEFAULT_CITY_CONFIG;
        const activeTransits = await this.transitRepo.find({
          where: {
            cityId: city.id,
            status: In([TransitStatus.EN_ROUTE, TransitStatus.ARRIVED]),
          },
          relations: {
            ambulance: { provider: true },
            hospital: true,
            emergencyType: true,
            triageCode: true,
            sector: true,
          } as never,
          order: { createdAt: 'DESC' },
        });

        const todayTransits = await this.transitRepo.find({
          where: { cityId: city.id, createdAt: this.todayRange() },
        });

        const providerTrips = await this.transitRepo
          .createQueryBuilder('t')
          .leftJoin('t.ambulance', 'a')
          .leftJoin('a.provider', 'p')
          .select('p.name', 'provider')
          .addSelect('p.code', 'code')
          .addSelect('p.shape', 'shape')
          .addSelect('p.color', 'color')
          .addSelect('COUNT(*)', 'count')
          .where('t.city_id = :cityId', { cityId: city.id })
          .andWhere('t.created_at >= CURRENT_DATE')
          .groupBy('p.id')
          .addGroupBy('p.name')
          .addGroupBy('p.code')
          .addGroupBy('p.shape')
          .addGroupBy('p.color')
          .getRawMany();

        const hospitalLoad = await this.transitRepo
          .createQueryBuilder('t')
          .leftJoin('t.hospital', 'h')
          .select('h.name', 'hospital')
          .addSelect('COUNT(*)', 'count')
          .where('t.city_id = :cityId', { cityId: city.id })
          .andWhere('t.status = :status', { status: TransitStatus.COMPLETED })
          .andWhere('t.completed_at >= CURRENT_DATE')
          .groupBy('h.id')
          .addGroupBy('h.name')
          .orderBy('count', 'DESC')
          .getRawMany();

        const hospitalEmergencies = await this.transitRepo
          .createQueryBuilder('t')
          .leftJoin('t.hospital', 'h')
          .leftJoin('t.emergencyType', 'et')
          .select('h.name', 'hospital')
          .addSelect('et.name', 'emergencyType')
          .addSelect('et.code', 'code')
          .addSelect('COUNT(*)', 'count')
          .where('t.city_id = :cityId', { cityId: city.id })
          .andWhere('t.created_at >= CURRENT_DATE')
          .groupBy('h.id')
          .addGroupBy('h.name')
          .addGroupBy('et.id')
          .addGroupBy('et.name')
          .addGroupBy('et.code')
          .getRawMany();

        const sectorEmergencies = await this.transitRepo
          .createQueryBuilder('t')
          .leftJoin('t.sector', 's')
          .leftJoin('t.emergencyType', 'et')
          .select('s.name', 'sectorName')
          .addSelect('et.name', 'emergencyType')
          .addSelect('et.code', 'code')
          .addSelect('COUNT(*)', 'count')
          .where('t.city_id = :cityId', { cityId: city.id })
          .andWhere('t.created_at >= CURRENT_DATE')
          .groupBy('s.id')
          .addGroupBy('s.name')
          .addGroupBy('et.id')
          .addGroupBy('et.name')
          .addGroupBy('et.code')
          .getRawMany();

        const completedToday = todayTransits.filter((t) => t.status === TransitStatus.COMPLETED);
        const enRouteToday = todayTransits.filter((t) =>
          [TransitStatus.EN_ROUTE, TransitStatus.ARRIVED, TransitStatus.COMPLETED].includes(t.status),
        );
        const transitRate = config.enableTransitRateKpi && enRouteToday.length
          ? Math.round((completedToday.length / enRouteToday.length) * 100)
          : null;

        let avgTimeSaved = 0;
        const savedSamples = completedToday.filter((t) => t.baselineEtaMinutes && t.startedAt && t.completedAt);
        if (savedSamples.length) {
          const totalSaved = savedSamples.reduce((sum, t) => {
            const actual = (t.completedAt!.getTime() - t.startedAt!.getTime()) / 60000;
            return sum + (Number(t.baselineEtaMinutes) - actual);
          }, 0);
          avgTimeSaved = Math.round(totalSaved / savedSamples.length);
        }

        const threshold = config.latencySpeedThresholdKmh;
        const latencyBreaches = activeTransits.filter((t) => Number(t.currentSpeed) < threshold);

        return {
          city: { id: city.id, name: city.name, code: city.code, config },
          operationsTable: activeTransits.map((t) => ({
            transitId: t.transitId,
            provider: t.ambulance?.provider?.name,
            destination: t.hospital?.name,
            triageLevel: t.triageCode?.name,
            sector: t.sector?.name,
            status: t.status,
            emergencyType: t.emergencyType?.name,
            elapsedMinutes: t.startedAt
              ? Math.round((Date.now() - t.startedAt.getTime()) / 60000)
              : 0,
          })),
          kpis: {
            activeCorridors: activeTransits.length,
            avgTimeSavedMinutes: avgTimeSaved,
            transitRate,
            corridorsClearedToday: completedToday.length,
            latencyBreaches: latencyBreaches.length,
            maxConcurrent: config.maxConcurrentTransits,
          },
          providerTrips,
          hospitalLoad,
          hospitalEmergencies,
          sectorEmergencies,
          latencyBreaches,
        };
      }),
    );

    if (cityId && citySummaries[0]) {
      return { multiCity: false, ...citySummaries[0] };
    }

    const allOperations = citySummaries.flatMap((s) =>
      s.operationsTable.map((op) => ({ ...op, cityName: s.city.name })),
    );

    return {
      multiCity: true,
      cities: citySummaries,
      operationsTable: allOperations,
      kpis: {
        activeCorridors: citySummaries.reduce((sum, s) => sum + s.kpis.activeCorridors, 0),
        corridorsClearedToday: citySummaries.reduce((sum, s) => sum + s.kpis.corridorsClearedToday, 0),
        latencyBreaches: citySummaries.reduce((sum, s) => sum + s.kpis.latencyBreaches, 0),
      },
      providerTrips: citySummaries.flatMap((s) => s.providerTrips),
      hospitalLoad: citySummaries.flatMap((s) => s.hospitalLoad),
      hospitalEmergencies: citySummaries.flatMap((s) => s.hospitalEmergencies),
      sectorEmergencies: citySummaries.flatMap((s) => s.sectorEmergencies),
    };
  }
}
