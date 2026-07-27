import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager, FindOptionsSelect } from 'typeorm';
import { User } from '../entities/user.entity';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // Helper: resolve the right query runner (transaction or root datasource)
  private db(tx?: EntityManager): { query: (sql: string, params?: any[]) => Promise<any> } {
    return tx ?? this.dataSource;
  }

  async createUser(data: Partial<User>, tx?: EntityManager): Promise<User> {
    const repo = tx ? tx.getRepository(User) : this.userRepository;
    return repo.save(repo.create(data));
  }

  async assignRoleToUser(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean> {
    // Atomically append role to the JSONB array only if not already present
    await this.db(tx).query(
      `UPDATE users
       SET roles = CASE
         WHEN roles @> $1::jsonb THEN roles
         ELSE COALESCE(roles, '[]'::jsonb) || $1::jsonb
       END
       WHERE id = $2`,
      [JSON.stringify([roleKey]), userId],
    );
    return true;
  }

  async removeRoleFromUser(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean> {
    // The '-' text operator removes the matching string element from a JSONB array
    await this.db(tx).query(
      `UPDATE users SET roles = roles - $1 WHERE id = $2`,
      [roleKey, userId],
    );
    return true;
  }

  async hasRole(userId: string, roleKey: RoleKey, tx?: EntityManager): Promise<boolean> {
    // Single SQL containment check — no extra round-trips
    const rows: any[] = await this.db(tx).query(
      `SELECT 1 FROM users WHERE id = $1 AND roles @> $2::jsonb`,
      [userId, JSON.stringify([roleKey])],
    );
    return rows.length > 0;
  }

  async findUserByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { keycloakId } });
  }

  async findUserByEmail(email: string, select?: FindOptionsSelect<User>): Promise<User | null> {
    return this.userRepository.findOne({ where: { email }, select });
  }

  async findUserById(userId: string, select?: FindOptionsSelect<User>): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId }, select });
  }

  async updateUserById(userId: string, data: Partial<User>): Promise<User> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set(data)
      .where('id = :id', { id: userId })
      .returning('*')
      .execute();
    return result.raw[0];
  }

  async updateIsActive(userId: string): Promise<Partial<User>> {
    // Toggle isActive in-place with RETURNING — no read before the write
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ isActive: () => 'NOT is_active' })
      .where('id = :id', { id: userId })
      .returning('id, name, email, is_active AS "isActive"')
      .execute();
    if (!result.raw[0]) throw new NotFoundException('User not found');
    return result.raw[0];
  }

  async findAndUpdateUserByEmail(userId: string, email: string, data: Partial<User>): Promise<User> {
    const result = await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set(data)
      .where('id = :id AND email = :email', { id: userId, email })
      .returning('*')
      .execute();
    return result.raw[0];
  }
}
