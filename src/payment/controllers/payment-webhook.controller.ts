// src/payment/controllers/payment-webhook.controller.ts
import { Controller, Post, Req, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from '../webhook/webhook.service';

@Controller('webhooks')
export class PaymentWebhookController {
    constructor(private readonly webhookService: WebhookService) { }

    @Post('paypal')
    @HttpCode(200)
    async paypalWebhook(@Req() req: Request) {
        await this.webhookService.handlePayPalWebhook(req.body);
        return { received: true };
    }
}