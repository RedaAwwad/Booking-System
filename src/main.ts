import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SanitizePipe } from './common/sanitize/sanitize.pipe';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Suppress the default NestJS logger during bootstrap so Winston takes over immediately
    bufferLogs: true,
  });

  // Replace the built-in NestJS logger with Winston for all Logger() calls in the app
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const logger = new Logger('Bootstrap');

  // ── EJS view engine ──────────────────────────────────────────────────────
  // Used for the developer login page (/login) and PKCE callback (/auth/callback).
  // process.cwd() resolves to the project root whether running via ts-node or compiled.
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('ejs');

  // ── Global prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: [
      '/',
      '/health',
      '/api-docs',
      '/login',           // Developer login page (EJS)
      '/auth/callback',   // Keycloak PKCE callback (EJS)
      '/logout',          // Browser Keycloak SSO logout
    ],
  });

  app.useGlobalPipes(
    new SanitizePipe(), // custom pipe to sanitize inputs from XSS attacks
    new ValidationPipe({
      transform: true, // auto-transform query strings to expected types
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // throw error if unknown props are sent
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: '*', // allow all origins, or specify your frontend URL
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  const config = new DocumentBuilder()
    .setTitle('Booking System API')
    .setDescription(
      'API documentation for fetching flights from different providers',
    )
    .setVersion('1.0')
    .addBearerAuth() // ← Documents the KC bearer token in Swagger
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      ignoreGlobalPrefix: false,
    });
  SwaggerModule.setup('api-docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Server running on port ${process.env.PORT ?? 3000}`);
  logger.log(
    `API documentation available at: http://localhost:${process.env.PORT ?? 3000}/api-docs`,
  );
  logger.log(
    `Developer login page: http://localhost:${process.env.PORT ?? 3000}/login`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
