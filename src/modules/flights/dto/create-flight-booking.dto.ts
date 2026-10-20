import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsUUID,
  IsEmail,
} from 'class-validator';

export class CreateFlightBookingDto {
  @IsUUID()
  userId: string;

  @IsEmail()
  userEmail: string;

  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsDateString()
  departureDate: string;

  @IsString()
  cabinClass: string;

  @IsNumber()
  adultsCount: number;

  @IsNumber()
  totalPrice: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  provider?: string; // e.g. "duffel", "flightapi"

  @IsString()
  paymentMethod: string;
}
