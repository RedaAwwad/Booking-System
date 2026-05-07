// src/payment/dto/capture-payment.dto.ts
import { IsString } from 'class-validator';

export class CapturePaymentDto {
    @IsString()
    orderId: string;
}