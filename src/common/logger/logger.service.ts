import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';

@Injectable()
export class CustomLogger implements LoggerService {
    private logger: winston.Logger;

    constructor() {
        const transports: winston.transport[] = [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp(),
                    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `[${timestamp}] ${level}: ${context ? `[${context}] ` : ''}${message}${metaStr}`;
                    }),
                ),
            }),
        ];

        const lokiHost = process.env.LOKI_URL;

        if (lokiHost) {
            transports.push(
                new LokiTransport({
                    host: lokiHost,
                    json: true,
                    labels: { app: 'booking-api' },
                    replaceTimestamp: true,
                    onConnectionError: (err) => console.error(err)
                }))
        }
        else console.log("Couldn't load lokiHost env variable")

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
            ),
            defaultMeta: { service: 'booking-api' },
            transports,
        });
    }

    private getContextAndMeta(optionalParams: any[]) {
        let context = 'App';
        let meta = {};
        if (optionalParams.length > 0) {
            const last = optionalParams[optionalParams.length - 1];
            if (typeof last === 'string') {
                context = last;
                if (optionalParams.length > 1) {
                    meta = optionalParams.slice(0, -1);
                }
            } else {
                meta = optionalParams;
            }
        }
        return { context, meta };
    }

    log(message: any, ...optionalParams: any[]) {
        const { context, meta } = this.getContextAndMeta(optionalParams);
        this.logger.info(message, { context, meta });
    }

    error(message: any, ...optionalParams: any[]) {
        let trace: string | undefined = undefined;
        let params = optionalParams;
        if (optionalParams.length > 0 && typeof optionalParams[0] === 'string') {
            trace = optionalParams[0];
            params = optionalParams.slice(1);
        }
        const { context, meta } = this.getContextAndMeta(params);
        this.logger.error(message, { trace, context, meta });
    }

    warn(message: any, ...optionalParams: any[]) {
        const { context, meta } = this.getContextAndMeta(optionalParams);
        this.logger.warn(message, { context, meta });
    }

    debug(message: any, ...optionalParams: any[]) {
        const { context, meta } = this.getContextAndMeta(optionalParams);
        this.logger.debug(message, { context, meta });
    }

    verbose(message: any, ...optionalParams: any[]) {
        const { context, meta } = this.getContextAndMeta(optionalParams);
        this.logger.verbose(message, { context, meta });
    }
}