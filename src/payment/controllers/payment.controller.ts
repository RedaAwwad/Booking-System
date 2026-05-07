// src/payment/controllers/payment.controller.ts
import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    Param,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { CapturePaymentDto } from '../dto/capture-payment.dto';

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('initiate')
    async initiatePayment(@Body() dto: InitiatePaymentDto) {
        return this.paymentService.initiatePayment(dto);
    }

    @Get('capture')
    async capturePayment(@Query('orderId') orderId: string) {
        return this.paymentService.capturePayment(orderId);
    }

    @Get(':orderId/status')
    async getStatus(@Param('orderId') orderId: string) {
        return this.paymentService.getPaymentStatus(orderId);
    }
}