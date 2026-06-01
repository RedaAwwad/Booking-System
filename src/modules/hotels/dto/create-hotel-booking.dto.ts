import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsUUID,
  IsEmail,
} from 'class-validator';

export class CreateHotelBookingDto {
  @IsUUID()
  userId: string;

  @IsEmail()
  userEmail: string;

  @IsString()
  hotelId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsString()
  roomType: string;

  @IsNumber()
  guestsCount: number;

  @IsNumber()
  totalPrice: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  paymentMethod: string;
}
