import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

/**
 * Determines whether the app is running inside a Docker container / CI.
 * In those environments we emit machine-readable JSON so Filebeat can ship it
 * to Logstash without any extra parsing.  Locally we use the pretty NestJS
 * format so the developer console stays readable.
 */
const isDockerOrCI =
  process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';

/** Fields added to every log record — useful for filtering in Kibana */
const defaultMeta = {
  service: 'booking-api',
  // PID helps correlate restarts on the same host
  pid: process.pid,
};

/**
 * JSON formatter used inside Docker.
 * Produces a flat object that Logstash's `json` filter can parse directly:
 * {
 *   "level":     "info",
 *   "message":   "Server started",
 *   "context":   "NestApplication",
 *   "timestamp": "2026-07-20T14:00:00.000Z",
 *   "service":   "booking-api",
 *   "pid":       1
 * }
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }), // include stack traces for Error objects
  winston.format.json(),
);

/**
 * Human-readable coloured format used for local development.
 * Mirrors the NestJS built-in logger output so it looks familiar.
 */
const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  nestWinstonModuleUtilities.format.nestLike('BookingSystem', {
    prettyPrint: true,
    colors: true,
  }),
);

export const winstonConfig: WinstonModuleOptions = {
  defaultMeta,
  transports: [
    new winston.transports.Console({
      // In Docker: JSON to stdout → Filebeat picks it up
      // Locally:   pretty coloured output
      format: isDockerOrCI ? jsonFormat : prettyFormat,
      // info in Docker so Winston/Filebeat captures operational logs (bookings, payments, etc.)
      // debug locally so the terminal shows everything during development
      level: isDockerOrCI ? 'info' : 'debug',
    }),
  ],
};
