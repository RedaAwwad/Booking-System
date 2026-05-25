import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxMessage } from './entities/outbox-message.entity';
import { OutboxService } from './outbox.service';
import { EventDispatcherService } from './event-dispatcher.service';
import { PublisherService } from './publisher.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessage])],
  providers: [OutboxService, PublisherService, EventDispatcherService],
  exports: [OutboxService],
})
export class OutboxModule {}
