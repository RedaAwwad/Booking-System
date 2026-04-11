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
export class SearchFlightsSkyScannerDto {
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  countryCode: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  adults: number;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  childrens: number;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  originSkyId: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  returnDate: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  infants: number;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  cabinClass: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  market: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  currency: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  originEntityId: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  date: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  destinationEntityId: string;
  @ApiProperty({ example: 'SYD', description: 'Origin Location Code' })
  @IsNotEmpty()
  destinationSkyId: string;
}