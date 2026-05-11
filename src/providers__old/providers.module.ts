import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DuffelService } from './duffel.service';

@Module({
    imports: [HttpModule],
    providers: [
        DuffelService,
        {
            provide: 'FLIGHT_PROVIDERS',
            useFactory: (duffel: DuffelService) => [duffel],
            inject: [DuffelService],
        }
    ],
    exports: [DuffelService, 'FLIGHT_PROVIDERS']
})
export class ProvidersModule {}
