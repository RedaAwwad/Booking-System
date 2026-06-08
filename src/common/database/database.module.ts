import { Global, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('DATABASE_HOST', 'localhost');
        const isLocalHost =
          host === 'localhost' || host === '127.0.0.1' || host === '::1';
        const port = isLocalHost
          ? Number(
              configService.get<string>('DATABASE_LOCAL_PORT') ??
                configService.get<string>('DATABASE_PORT') ??
                5432,
            )
          : Number(configService.get<string>('DATABASE_PORT') ?? 5432);

        return {
        type: 'postgres',
        host,
        port,
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASSWORD', 'password'),
        database: configService.get<string>('DATABASE_NAME', 'booking_system'),
        // url: configService.get<string>('DATABASE_URL'),
        entities: [__dirname + '../../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: true, // Auto-sync for dev environment
        };
      },
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Ensure necessary extensions exist
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    try {
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS pg_cron;`);

      // Attempt to schedule the pg_cron job for outbox relay
      await this.dataSource.query(`
        SELECT cron.schedule(
          'outbox-relay',
          '*/5 * * * *',
          $$
            DO $body$ DECLARE rec RECORD;
            BEGIN
              FOR rec IN SELECT * FROM outbox_messages WHERE status = 'READY' ORDER BY created_at ASC
              LOOP
                PERFORM pg_notify('outbox_channel', row_to_json(rec)::text);
              END LOOP;
            END; $body$;
          $$
        );
      `);
      console.log('Outbox relay pg_cron job scheduled.');
    } catch (e) {
      console.warn(
        'Could not initialize pg_cron or schedule the outbox relay.',
        e.message,
      );
    }
  }
}
