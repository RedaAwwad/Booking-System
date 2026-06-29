import { Global, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
 
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5434),
        username: configService.get<string>('DATABASE_USER', 'booking'),
        password: configService.get<string>('DATABASE_PASSWORD', 'booking'),
        database: configService.get<string>('DATABASE_NAME', 'booking'),
        // url: configService.get<string>('DATABASE_URL'),
        entities: [__dirname + '../../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: true, // Auto-sync for dev environment
      }),
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
      await this.dataSource.query(`SELECT cron.unschedule('outbox-relay');`).catch(() => {});
    } catch (e) {
      console.warn('Could not initialize pg_cron.', e.message);
    }
  }
}
