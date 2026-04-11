import { Module } from '@nestjs/common';
import { AggregatorService } from './aggrecator.service';
import { AggrecatorController } from './aggrecator.controller';
import { ProvidersModule } from 'src/providers/providers.module';

@Module({
    providers: [AggregatorService],
    controllers: [AggrecatorController],
    exports: [AggregatorService],    
    imports: [ProvidersModule],
}) 
export class AggrecatorModule {}