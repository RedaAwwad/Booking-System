import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async createRole(data: { name: string; desc?: string; key: RoleKey }): Promise<Role> {
    const role = this.roleRepository.create({
      name: data.name,
      desc: data.desc,
      key: data.key,
    });
    return this.roleRepository.save(role);
  }

  async findRoleByKey(key: RoleKey): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { key } });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  async removeRoleById(id: string): Promise<void> {
    await this.roleRepository.delete(id);
  }

  async removeRoleByKey(key: RoleKey): Promise<void> {
    await this.roleRepository.delete({ key });
  }
}
