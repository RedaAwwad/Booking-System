import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Escape, Trim } from 'class-sanitizer';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SearchHotelDto {
  @ApiProperty({
    description: 'City or destination name',
    example: 'New York',
  })
  @Escape()
  @Trim()
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({
    description: 'Check-in date in YYYY-MM-DD format',
    example: '2024-06-01',
  })
  @IsNotEmpty()
  @IsDateString()
  check_in_date: string;

  @ApiProperty({
    description: 'Check-out date in YYYY-MM-DD format',
    example: '2024-06-05',
  })
  @IsNotEmpty()
  @IsDateString()
  check_out_date: string;

  @ApiProperty({
    description: 'Number of adult guests',
    minimum: 1,
    example: 2,
  })
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  adults_count: number;

  @ApiPropertyOptional({
    description: 'Number of rooms required',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  rooms_count?: number;

  @ApiPropertyOptional({
    description: 'Currency code for pricing',
    example: 'USD',
  })
  @Escape()
  @Trim()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    minimum: 1,
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
