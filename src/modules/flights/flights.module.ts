import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { ExternalApiModule } from '../external-api/external-api.module';

@Module({
  imports: [ExternalApiModule],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}
