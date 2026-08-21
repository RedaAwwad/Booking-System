import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

// Use require to avoid type checking issues with winston-logstash-transport
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LogstashTransport } = require('winston-logstash-transport');

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

    const logstashHost = process.env.LOGSTASH_HOST;
    const logstashPort = process.env.LOGSTASH_PORT;

    if (logstashHost && logstashPort) {
      try {
        transports.push(
          new LogstashTransport({
            host: logstashHost,
            port: parseInt(logstashPort, 10),
            trailingLineFeed: true,
          }),
        );
      } catch (err) {
        console.error('Failed to initialize Logstash transport:', err);
      }
    }

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
