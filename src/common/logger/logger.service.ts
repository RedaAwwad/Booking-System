import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';
import { trace } from '@opentelemetry/api';

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
                    batching: false,
                    labels: { job: 'booking-api', app: 'booking-api' },
                    replaceTimestamp: true,
                    format: winston.format.json(),
                    onConnectionError: (err) => console.error('LokiTransport error:', err)
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

    private formatMessageAndMeta(message: any, optionalParams: any[]) {
        let context = 'App';
        let meta: Record<string, any> = {};

        if (optionalParams.length > 0) {
            const last = optionalParams[optionalParams.length - 1];
            if (typeof last === 'string') {
                context = last;
                if (optionalParams.length > 1) {
                    meta = { meta: optionalParams.slice(0, -1) };
                }
            } else {
                meta = { meta: optionalParams };
            }
        }

        let msgString: string;
        if (typeof message === 'object' && message !== null) {
            // Structured event (e.g. SearchEvent): spread its own fields into
            // top-level log metadata instead of JSON.stringify-ing the whole
            // object into `message`. This is what makes each field (origin,
            // cache_hit, duration_ms, ...) independently queryable in Loki
            // instead of buried inside one opaque string.
            const { kind, ...rest } = message;
            msgString = kind ? String(kind) : 'event';
            meta = { ...meta, ...rest };
        } else {
            msgString = String(message ?? '');
        }

        return { msgString, context, meta };
    }

    /** Reads the active OTel span and returns trace_id/span_id to embed in logs. */
    private getTraceContext(): Record<string, string> {
        const span = trace.getActiveSpan();
        if (!span) return {};
        const ctx = span.spanContext();
        return {
            trace_id: ctx.traceId,
            span_id: ctx.spanId,
        };
    }

    log(message: any, ...optionalParams: any[]) {
        const { msgString, context, meta } = this.formatMessageAndMeta(message, optionalParams);
        this.logger.info(msgString, { context, ...meta, ...this.getTraceContext() });
    }

    error(message: any, ...optionalParams: any[]) {
        let stackTrace: string | undefined = undefined;
        let params = optionalParams;
        if (optionalParams.length > 0 && typeof optionalParams[0] === 'string' && optionalParams.length > 1) {
            stackTrace = optionalParams[0];
            params = optionalParams.slice(1);
        }
        const { msgString, context, meta } = this.formatMessageAndMeta(message, params);
        this.logger.error(msgString, { trace: stackTrace, context, ...meta, ...this.getTraceContext() });
    }

    warn(message: any, ...optionalParams: any[]) {
        const { msgString, context, meta } = this.formatMessageAndMeta(message, optionalParams);
        this.logger.warn(msgString, { context, ...meta, ...this.getTraceContext() });
    }

    debug(message: any, ...optionalParams: any[]) {
        const { msgString, context, meta } = this.formatMessageAndMeta(message, optionalParams);
        this.logger.debug(msgString, { context, ...meta, ...this.getTraceContext() });
    }

    verbose(message: any, ...optionalParams: any[]) {
        const { msgString, context, meta } = this.formatMessageAndMeta(message, optionalParams);
        this.logger.verbose(msgString, { context, ...meta, ...this.getTraceContext() });
    }

    fatal(message: any, ...optionalParams: any[]) {
        const { msgString, context, meta } = this.formatMessageAndMeta(message, optionalParams);
        this.logger.error(msgString, { context, ...meta, ...this.getTraceContext() });
    }
}