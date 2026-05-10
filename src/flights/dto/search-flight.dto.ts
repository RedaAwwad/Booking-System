import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum CabinClass {
  ECONOMY = 'economy',
  BUSINESS = 'business',
  FIRST = 'first',
}

export class SearchFlightDto {
  @ApiProperty({
    description: 'IATA code for the origin city or airport',
    example: 'LHR',
  })
  @IsNotEmpty()
  @IsString()
  origin: string;

  @ApiProperty({
    description: 'IATA code for the destination city or airport',
    example: 'JFK',
  })
  @IsNotEmpty()
  @IsString()
  destination: string;

  @ApiProperty({
    description: 'Departure date in YYYY-MM-DD format',
    example: '2024-06-01',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  departure_date: Date;

  @ApiPropertyOptional({
    description: 'Return date in YYYY-MM-DD format for round trips',
    example: '2024-06-15',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  return_date?: Date;

  @ApiProperty({
    description: 'Cabin class for the flight',
    enum: CabinClass,
    example: CabinClass.ECONOMY,
  })
  @IsOptional()
  @IsEnum(CabinClass)
  cabin_class?: CabinClass;

  @ApiProperty({
    description: 'Number of adult passengers',
    minimum: 1,
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  adults_count: number;

  @ApiPropertyOptional({
    description: 'Number of children passengers',
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  children_count?: number;

  @ApiPropertyOptional({
    description: 'Currency code for pricing',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    minimum: 1,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
