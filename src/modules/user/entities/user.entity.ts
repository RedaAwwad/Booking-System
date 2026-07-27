import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Keycloak user UUID (the `sub` claim from the KC JWT). Single source of identity. */
  @Column({ type: 'varchar', length: 255, unique: true })
  keycloakId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * Whether this account is active.
   * Set to false when an admin blocks the user via the KC Admin API.
   * We keep this locally so a single DB read can gate access without
   * calling KC on every request.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Denormalised convenience flag — mirrored from KC realm role `admin`.
   * Updated by KeycloakSyncService on first login; authoritative check
   * always uses the token's realm_access.roles at runtime.
   */
  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
