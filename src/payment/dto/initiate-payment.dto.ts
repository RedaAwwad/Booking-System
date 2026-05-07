// src/payment/dto/initiate-payment.dto.ts
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum PaymentProvider {
    PAYPAL = 'PAYPAL',
    CASH_ON_DELIVERY = 'CASH_ON_DELIVERY',
}

export class InitiatePaymentDto {
    @IsUUID()
    bookingId: string;

    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsString()
    @IsOptional()
    currency?: string = 'USD';

    @IsEnum(PaymentProvider)
    provider: PaymentProvider;

    @IsString()
    email: string;
}