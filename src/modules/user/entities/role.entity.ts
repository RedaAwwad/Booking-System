import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { RoleKey } from '../../../common/enums/role-key.enum';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  key: RoleKey;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  desc: string | null;
}
