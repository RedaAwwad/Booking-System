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
  paymentMethod: string;
}
