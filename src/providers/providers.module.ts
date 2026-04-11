import { Module } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { SkyscannerService } from './skyscanner.service';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [HttpModule],
    providers: [AmadeusService , SkyscannerService],
    exports: [AmadeusService , SkyscannerService]
})
export class ProvidersModule {}
