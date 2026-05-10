import { Test, TestingModule } from '@nestjs/testing';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

describe('FlightsController', () => {
  let controller: FlightsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlightsController],
      providers: [FlightsService],
    }).compile();

    controller = module.get<FlightsController>(FlightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
