import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HospitalGeofence } from './hospital-geofence.entity';
import { HospitalGeofencePoint } from './hospital-geofence-point.entity';
import { Hospital } from '../hospitals/hospital.entity';
import { UpsertHospitalGeofenceDto } from './dto/geofence.dto';
import { GeofenceShapeType } from './geofence.enums';
import { buildCircleBoundary, polygonCentroid } from './geofence.util';

@Injectable()
export class HospitalGeofencesService {
  constructor(
    @InjectRepository(HospitalGeofence)
    private readonly geofenceRepo: Repository<HospitalGeofence>,
    @InjectRepository(HospitalGeofencePoint)
    private readonly pointRepo: Repository<HospitalGeofencePoint>,
    @InjectRepository(Hospital)
    private readonly hospitalRepo: Repository<Hospital>,
  ) {}

  async findByHospitalId(hospitalId: string) {
    const geofence = await this.geofenceRepo.findOne({
      where: { hospitalId },
      relations: { boundaryPoints: true },
    });
    if (!geofence) return null;
    if (geofence.boundaryPoints) {
      geofence.boundaryPoints.sort((a, b) => a.pointIndex - b.pointIndex);
    }
    return this.toPublic(geofence);
  }

  async upsert(hospitalId: string, dto: UpsertHospitalGeofenceDto) {
    await this.hospitalRepo.findOneOrFail({ where: { id: hospitalId } });

    const inputPoints = dto.points.map((p) => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
    }));

    let centerLat = dto.centerLat != null ? Number(dto.centerLat) : null;
    let centerLng = dto.centerLng != null ? Number(dto.centerLng) : null;
    let radiusMeters = dto.radiusMeters != null ? Number(dto.radiusMeters) : null;
    let storedPoints = inputPoints;

    if (dto.shapeType === GeofenceShapeType.CIRCLE) {
      if (centerLat == null || centerLng == null || radiusMeters == null) {
        throw new BadRequestException('Circle geofence requires center and radius');
      }
      storedPoints = buildCircleBoundary(centerLat, centerLng, radiusMeters);
    } else {
      if (inputPoints.length < 3) {
        throw new BadRequestException('Rectangle and polygon fences need at least 3 points');
      }
      const centroid = polygonCentroid(inputPoints);
      centerLat = centerLat ?? centroid.latitude;
      centerLng = centerLng ?? centroid.longitude;
      radiusMeters = null;
    }

    let geofence = await this.geofenceRepo.findOne({ where: { hospitalId } });
    if (!geofence) {
      geofence = this.geofenceRepo.create({ hospitalId });
    }
    geofence.shapeType = dto.shapeType;
    geofence.centerLat = centerLat!;
    geofence.centerLng = centerLng!;
    geofence.radiusMeters = radiusMeters;
    const saved = await this.geofenceRepo.save(geofence);

    await this.pointRepo.delete({ geofenceId: saved.id });
    await this.pointRepo.save(
      storedPoints.map((point, index) => ({
        geofenceId: saved.id,
        pointIndex: index,
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    );

    const full = await this.geofenceRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { boundaryPoints: true },
    });
    return this.toPublic(full);
  }

  async remove(hospitalId: string) {
    const geofence = await this.geofenceRepo.findOne({ where: { hospitalId } });
    if (!geofence) throw new NotFoundException('Geofence not found for this hospital');
    await this.geofenceRepo.remove(geofence);
    return { ok: true };
  }

  async findForHospital(hospitalId: string): Promise<HospitalGeofence | null> {
    return this.geofenceRepo.findOne({
      where: { hospitalId },
      relations: { boundaryPoints: true },
    });
  }

  private toPublic(geofence: HospitalGeofence) {
    const points = (geofence.boundaryPoints ?? []).sort((a, b) => a.pointIndex - b.pointIndex);
    return {
      id: geofence.id,
      hospitalId: geofence.hospitalId,
      shapeType: geofence.shapeType,
      centerLat: Number(geofence.centerLat),
      centerLng: Number(geofence.centerLng),
      radiusMeters: geofence.radiusMeters,
      boundaryPoints: points.map((p) => ({
        pointIndex: p.pointIndex,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
      })),
      updatedAt: geofence.updatedAt,
    };
  }
}
