import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AmadeusController } from './amadeus.controller';
import { AmadeusService } from './amadeus.service';

@Module({
  imports: [HttpModule],
  controllers: [AmadeusController],
  providers: [AmadeusService],
})
export class AmadeusModule {}
