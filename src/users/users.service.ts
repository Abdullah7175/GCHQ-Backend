import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Ambulance } from '../ambulances/ambulance.entity';
import { Transit } from '../transits/transit.entity';
import { CreateUserDto, UpdateUserDto, LoginDto } from './dto/user.dto';
import { BaseCrudService } from '../common/services/base-crud.service';

@Injectable()
export class UsersService extends BaseCrudService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {
    super(userRepo);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    return super.create({ ...dto, password: hashed } as Partial<User>);
  }

  findAll(options?: any, page?: number, limit?: number) {
    return super.findAll(
      {
        ...options,
        relations: { hospital: true, provider: true, city: true, sector: true } as never,
        order: { createdAt: 'DESC' },
      },
      page,
      limit,
    );
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const data: Partial<User> = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    return super.update(id, data);
  }

  /** Unassign driver + clear claims, then delete user (avoids ambulance/transit FK errors). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userRepo.manager.transaction(async (em) => {
      await em.update(Ambulance, { driverId: id }, { driverId: null });
      await em.update(Transit, { claimedById: id }, { claimedById: null, claimedAt: null });
      await em.delete(User, { id });
    });
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: { hospital: true, provider: true, city: true, sector: true } as never,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password, ...profile } = user;
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      cityId: user.cityId,
      hospitalId: user.hospitalId,
      providerId: user.providerId,
      sectorId: user.sectorId,
      isCityOverseer: user.isCityOverseer,
    });

    return { user: profile, accessToken: token };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { apiKey },
      relations: { hospital: true, provider: true, city: true, sector: true } as never,
    });
  }
}
