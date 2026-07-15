import { Repository, ObjectLiteral, FindOptionsWhere, FindOptionsRelations, FindManyOptions } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

export class BaseCrudService<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  async findAll(options?: FindManyOptions<T>, page?: number, limit?: number): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number } | T[]> {
    if (page && limit) {
      const skip = (page - 1) * limit;
      const [data, total] = await this.repository.findAndCount({
        ...options,
        skip,
        take: limit,
        order: options?.order || ({ createdAt: 'DESC' } as never),
      });
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    return this.repository.find({
      ...options,
      order: options?.order || ({ createdAt: 'DESC' } as never),
    });
  }

  async findOne(id: string, relations?: FindOptionsRelations<T>): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
      ...(relations ? { relations } : {}),
    });
    if (!entity) throw new NotFoundException(`Record ${id} not found`);
    return entity;
  }

  async create(data: Partial<T>): Promise<T> {
    const entity = this.repository.create(data as T);
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    await this.findOne(id);
    await this.repository.update(id, data as never);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
