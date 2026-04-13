import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DuffelService } from './duffel.service';

@Module({
    imports: [HttpModule],
    providers: [DuffelService],
    exports: [DuffelService]
})
export class ProvidersModule {}
