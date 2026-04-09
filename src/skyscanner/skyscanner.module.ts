import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SkyscannerController } from './skyscanner.controller';
import { SkyscannerService } from './skyscanner.service';

@Module({
  imports: [HttpModule],
  controllers: [SkyscannerController],
  providers: [SkyscannerService],
})
export class SkyscannerModule {}
