import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { SanitizePipe } from './sanitize/sanitize.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1', {
    exclude: ['/', '/health', '/api-docs'],
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
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      ignoreGlobalPrefix: true,
    });
  SwaggerModule.setup('api-docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
  console.log('The App is running on port', process.env.PORT ?? 3000);
  console.log(
    'The API documentation is available via: http://localhost:' +
      (process.env.PORT ?? 3000) +
      '/api-docs',
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
