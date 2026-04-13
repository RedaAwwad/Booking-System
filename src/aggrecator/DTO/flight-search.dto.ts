import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumberString, IsOptional } from "class-validator";

export class FlightSearchDto {
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  originLocationCode: string;

  @ApiProperty({ example: 'BKK', description: 'Destination Location Code' })
  @IsNotEmpty()
  destinationLocationCode: string;

  @ApiProperty({ example: '2026-04-23' })
  @IsNotEmpty()
  departureDate: string;

  @ApiProperty({ example: '2026-05-07' })
  @IsNotEmpty()
  returnDate: string;

  @ApiProperty({ example: '1' })
  @IsNotEmpty()
  @IsNumberString()
  adults: number;

  @ApiProperty({ example: '10', required: false })
  @IsOptional()
  max?: number;
}